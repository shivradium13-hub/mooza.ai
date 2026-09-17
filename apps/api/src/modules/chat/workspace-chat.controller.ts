import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppError, ErrorCode, Permission, ValidationError, type TenantContext } from '@moka/core';
import { stripTenantKeys } from '@moka/tenancy';
import { ProviderError, ProviderErrorCode } from '@moka/ai';
import { GatewayService } from '../ai/gateway.service.js';
import { CurrentTenant, RequestId, RequirePermission } from '../../common/decorators.js';
import { RATE_LIMITER, enforceRateLimit, type RateLimiter } from '../../common/rate-limit.js';
import { getLogger } from '../../common/logger.js';
import { THREAD_LIMITS, WorkspaceChatService, titleFrom } from './workspace-chat.service.js';

/**
 * Workspace chat (§25).
 *
 * Mounted at `v1/chat/threads` rather than `v1/chat/conversations`, which is
 * the staff handoff inbox for the PUBLIC chatbot. Two different things called
 * chat, kept apart by their names as well as by their tables — see the note in
 * schema/workspace-chat.ts.
 *
 * `CHAT_USE` rather than `PROJECT_CREATE`: a turn spends the organization's
 * provider credit, and a reader of this file should not have to know that
 * "create a project" had come to mean "may bill a model call".
 *
 * ONE TURN, TWO ENDPOINTS, ONE PATH THROUGH THE SERVICE. `messages` answers in
 * a single response and `messages/stream` answers over SSE, but both open the
 * turn and close it with the same two service calls. The question is written
 * to the transcript before the model runs either way, so a turn that dies
 * halfway leaves the thread honest rather than losing what somebody typed.
 */

const idSchema = z.string().uuid();

const createSchema = z.object({
  /** The thread's name. Normally the first message, sent with it below. */
  title: z.string().max(500).optional(),
  message: z.string().max(THREAD_LIMITS.MAX_MESSAGE_CHARS).optional(),
  modelId: z.string().max(100).nullish(),
  projectId: z.string().uuid().nullish(),
});

const renameSchema = z.object({ title: z.string().min(1).max(500) });

const messageSchema = z.object({
  message: z.string().min(1).max(THREAD_LIMITS.MAX_MESSAGE_CHARS),
});

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError({
      fields: result.error.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`),
    });
  }
  return result.data;
}

/**
 * A code for the transcript when a turn fails.
 *
 * Provider errors already carry a normalised code; anything else becomes
 * `internal`, because an exception's message is not something to write into a
 * row that will be rendered back to a browser.
 */
function errorCodeFor(error: unknown): string {
  if (error instanceof ProviderError) return error.code;
  if (error instanceof AppError) return error.code;
  return 'internal';
}

/**
 * What the user is shown in place of an answer. Never an upstream string.
 *
 * Matched against the ENUMS rather than against string literals. Writing the
 * codes out by hand is how this shipped once already saying "this turn could
 * not be completed" to someone whose only problem was an unconfigured API key
 * — the one failure here with an obvious fix, reported as the one with none.
 */
function failureTextFor(code: string): string {
  if (code === ProviderErrorCode.NO_CREDENTIAL || code === ProviderErrorCode.AUTHENTICATION) {
    return 'No usable provider credential is configured for this organization, so there is no model to answer with. Add one in Credentials.';
  }
  if (code === ErrorCode.QUOTA_EXCEEDED) {
    return 'This organization is out of credit for model calls. Usage shows where it went.';
  }
  if (code === ProviderErrorCode.RATE_LIMITED || code === ErrorCode.RATE_LIMITED) {
    return 'The model provider is rate limiting requests right now. Try again shortly.';
  }
  if (code === ProviderErrorCode.UNAVAILABLE) {
    return 'The model provider is down or did not respond in time. The question above was kept; try sending it again.';
  }
  if (code === ProviderErrorCode.CONTEXT_LENGTH) {
    return 'This thread is now longer than the model can read in one go. Start a new one to carry on.';
  }
  if (code === ProviderErrorCode.CONTENT_FILTERED) {
    return 'The provider declined to answer this one. Nothing is wrong with the thread; rephrasing usually works.';
  }
  return 'This turn could not be completed. The question above was kept; try sending it again.';
}

@Controller('v1/chat/threads')
export class WorkspaceChatController {
  constructor(
    private readonly threads: WorkspaceChatService,
    private readonly gateway: GatewayService,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  @RequirePermission(Permission.CHAT_USE)
  @Get()
  async list(@CurrentTenant() tenant: TenantContext) {
    return { threads: await this.threads.listThreads(tenant) };
  }

  /**
   * Open a thread.
   *
   * The first message may ride along, because "new chat" and "ask this" are one
   * action from the user's side — but it is only STORED here, not answered. The
   * client then calls the stream endpoint, which is the one place a turn runs.
   * Answering here as well would mean two code paths that produce a turn.
   */
  @RequirePermission(Permission.CHAT_USE)
  @Post()
  async create(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    const input = parse(createSchema, stripTenantKeys((body ?? {}) as Record<string, unknown>));
    const seed = input.title ?? input.message ?? 'New chat';

    return {
      thread: await this.threads.createThread(tenant, {
        title: titleFrom(seed),
        modelId: input.modelId ?? null,
        projectId: input.projectId ?? null,
      }),
    };
  }

  @RequirePermission(Permission.CHAT_USE)
  @Get(':id')
  async get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.threads.getThread(tenant, parse(idSchema, id));
  }

  @RequirePermission(Permission.CHAT_USE)
  @Patch(':id')
  async rename(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = parse(renameSchema, body);
    return { thread: await this.threads.renameThread(tenant, parse(idSchema, id), input.title) };
  }

  @RequirePermission(Permission.CHAT_USE)
  @Delete(':id')
  async remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    await this.threads.deleteThread(tenant, parse(idSchema, id));
    return { ok: true };
  }

  /**
   * One turn, answered in a single response.
   *
   * The plain path. Kept alongside the stream for callers that are not a
   * browser — a script, a test, a client behind a proxy that eats SSE — and
   * because a chat whose only path is a stream has no way to work when the
   * stream does not.
   */
  @RequirePermission(Permission.CHAT_USE)
  @Post(':id/messages')
  async send(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    const threadId = parse(idSchema, id);
    const input = parse(messageSchema, stripTenantKeys((body ?? {}) as Record<string, unknown>));
    await this.limit(tenant);

    const { request, userMessage } = await this.threads.openTurn(tenant, threadId, input.message);

    try {
      const result = await this.gateway.chat(tenant, request, { requestId });
      const assistant = await this.threads.closeTurn(tenant, threadId, {
        content: result.text,
        modelId: result.modelId,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        errorCode: null,
      });
      return { userMessage, message: assistant };
    } catch (error) {
      const code = errorCodeFor(error);
      const assistant = await this.threads.closeTurn(tenant, threadId, {
        content: failureTextFor(code),
        modelId: null,
        inputTokens: 0,
        outputTokens: 0,
        errorCode: code,
      });
      return { userMessage, message: assistant };
    }
  }

  /**
   * One turn, over Server-Sent Events.
   *
   * SSE for the reasons given on `/v1/ai/chat/stream`: one-directional
   * traffic, survives proxies that mangle upgrades, reconnects natively.
   *
   * THE ANSWER IS PERSISTED FROM WHAT WAS ACTUALLY SENT — the deltas are
   * accumulated here and written at the end, so what the thread stores is what
   * the user watched appear. A stream that dies mid-sentence stores the half
   * sentence, with the error beside it, rather than nothing.
   */
  @RequirePermission(Permission.CHAT_USE)
  @Post(':id/messages/stream')
  async sendStream(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res() reply: FastifyReply,
    @RequestId() requestId: string,
  ): Promise<void> {
    const threadId = parse(idSchema, id);
    const input = parse(messageSchema, stripTenantKeys((body ?? {}) as Record<string, unknown>));
    await this.limit(tenant);

    // Before a byte is written, so a rejection here is still an HTTP error
    // with a status the client can read rather than an event inside a 200.
    const { request, userMessage } = await this.threads.openTurn(tenant, threadId, input.message);

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Without this nginx buffers the whole response and the stream arrives
      // in one lump at the end, which looks exactly like a hang.
      'x-accel-buffering': 'no',
    });

    const send = (event: string, data: unknown): void => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('opened', { userMessage });

    let text = '';
    let modelId: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;
    let errorCode: string | null = null;

    try {
      for await (const event of this.gateway.stream(tenant, request, { requestId })) {
        switch (event.type) {
          case 'start':
            modelId = event.modelId;
            send('start', { model: event.modelId, provider: event.providerId });
            break;
          case 'text':
            text += event.text;
            send('text', { text: event.text });
            break;
          case 'done':
            inputTokens = event.usage.inputTokens;
            outputTokens = event.usage.outputTokens;
            break;
          case 'error':
            // Already normalised by the adapter; never upstream prose.
            errorCode = event.code;
            send('error', { code: event.code, message: event.message });
            break;
          default:
            break;
        }
      }
    } catch (error) {
      errorCode = errorCodeFor(error);
      getLogger().error(
        { err: error, threadId, requestId },
        'Workspace chat stream failed mid-turn.',
      );
      send('error', { code: errorCode, message: failureTextFor(errorCode) });
    }

    // A turn that produced nothing is still a turn. Writing the failure text
    // keeps the transcript readable instead of leaving a question hanging with
    // no reply under it.
    if (!text && errorCode) text = failureTextFor(errorCode);

    try {
      const assistant = await this.threads.closeTurn(tenant, threadId, {
        content: text,
        modelId,
        inputTokens,
        outputTokens,
        errorCode,
      });
      send('done', { message: assistant });
    } catch (error) {
      getLogger().error({ err: error, threadId }, 'Could not persist a workspace chat reply.');
      send('error', { code: 'internal', message: 'The reply could not be saved to this thread.' });
    }

    reply.raw.end();
  }

  /**
   * Per USER, not per organization.
   *
   * An organization-wide bucket would let one person's loop lock their
   * colleagues out of chat, which is a denial of service with a friendly face.
   * The organization's real ceiling is its credit balance, checked in the
   * gateway; this only stops one runaway client.
   */
  private async limit(tenant: TenantContext): Promise<void> {
    await enforceRateLimit(
      this.limiter,
      `chat:thread:${tenant.userId ?? tenant.organizationId}`,
      30,
      60,
    );
  }
}
