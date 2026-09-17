import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { Database, workspaceThreadMessages, workspaceThreads } from '@moka/db';
import { ForbiddenError, NotFoundError, ValidationError, type TenantContext } from '@moka/core';
import type { ChatRequest, Message } from '@moka/ai';
import { DATABASE } from '../../database/database.module.js';

/**
 * Workspace chat — a signed-in member talking to a model (§25).
 *
 * The sibling of `visitor.service.ts`, and almost its opposite. There the
 * caller is a stranger and every limit exists to stop them spending an
 * organization's money; here the caller is a member of the organization whose
 * money it is. So the bounds below are generous where the public ones are
 * tight, and they exist for a different reason: to keep one thread from
 * quietly growing into a context window nobody meant to pay for.
 *
 * WHAT THIS ASSISTANT CAN AND CANNOT DO, AND WHY IT SAYS SO
 *
 * It has no tools. It cannot search the organization's knowledge base, run
 * research, or read a document — those are separate surfaces with their own
 * permissions, retrieval and citation ledgers. The system prompt states that
 * plainly, because a model asked about "your documents" will otherwise answer
 * as though it had looked, and an invented summary of a file the user actually
 * has is worse than a refusal. Grounding lives in Chatbots and Research, where
 * there is evidence to ground against.
 */

/**
 * Bounds for an internal thread.
 *
 * Deliberately NOT `@moka/chat`'s LIMITS, which are sized for an anonymous
 * visitor on a public website. A member pasting a config file into the box is
 * doing something ordinary; the same paste from a stranger is an attack on
 * someone else's bill.
 */
export const THREAD_LIMITS = {
  /** One message. Long enough to paste a file into, short of a book. */
  MAX_MESSAGE_CHARS: 32_000,
  /** Turns replayed to the model. Older turns fall out of the window. */
  MAX_HISTORY_MESSAGES: 40,
  /** Characters of replayed history, whichever bound bites first. */
  MAX_HISTORY_CHARS: 60_000,
  /** Messages in one thread, user and assistant together. */
  MAX_MESSAGES_PER_THREAD: 400,
  /** Title length. The rest of the first message is in the transcript anyway. */
  MAX_TITLE_CHARS: 80,
} as const;

/**
 * What the assistant is told about itself.
 *
 * Short on purpose. A long persona is mostly a way of asking a model to
 * perform a character, and what a working assistant needs is the two or three
 * facts that keep it from lying about its own reach.
 */
export const WORKSPACE_SYSTEM_PROMPT = [
  'You are the assistant inside MOOZA AI, a workspace where a team keeps documents, agents, research runs and chatbots.',
  '',
  'What you can see: this conversation, and nothing else.',
  '',
  'You have no tools and no access to the workspace. You cannot open a document, search the knowledge base, look at a project, browse the web, or run anything. If you are asked about something in this workspace, say you cannot see it and name where it lives — Knowledge for documents, Research for anything that needs the web, Chatbots for answers grounded in sources. Never describe the contents of a file you have not been shown; a plausible summary of a real document is worse than admitting you cannot read it.',
  '',
  'Answer directly. Say when you do not know something. Do not open by restating the question.',
].join('\n');

export interface ThreadSummary {
  id: string;
  title: string;
  modelId: string | null;
  messageCount: number;
  createdAt: Date;
  lastMessageAt: Date;
}

export interface ThreadMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modelId: string | null;
  errorCode: string | null;
  createdAt: Date;
}

@Injectable()
export class WorkspaceChatService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * A thread belongs to a PERSON.
   *
   * An API key authenticates as the organization and carries no user, so there
   * is no one for a thread to belong to and no one whose threads it should be
   * able to read. Refused rather than silently given a null owner.
   */
  private authorOf(context: TenantContext): string {
    if (!context.userId) {
      throw new ForbiddenError(
        'TenantContext has no userId: workspace threads belong to a person, and an ' +
          'API key authenticates as the organization.',
      );
    }
    return context.userId;
  }

  /* ---------------------------------------------------------------------- */
  /* Threads                                                                 */
  /* ---------------------------------------------------------------------- */

  async listThreads(context: TenantContext): Promise<ThreadSummary[]> {
    const userId = this.authorOf(context);

    return this.db.withTenant(context, async (tx) => {
      const rows = await tx
        .select({
          id: workspaceThreads.id,
          title: workspaceThreads.title,
          modelId: workspaceThreads.modelId,
          messageCount: workspaceThreads.messageCount,
          createdAt: workspaceThreads.createdAt,
          lastMessageAt: workspaceThreads.lastMessageAt,
        })
        .from(workspaceThreads)
        .where(
          and(
            eq(workspaceThreads.organizationId, context.organizationId),
            // The per-user filter. RLS stops another TENANT; this stops
            // another member of the same one. See migration 0017.
            eq(workspaceThreads.userId, userId),
          ),
        )
        .orderBy(desc(workspaceThreads.lastMessageAt))
        .limit(200);

      return rows;
    });
  }

  async createThread(
    context: TenantContext,
    input: { title: string; modelId: string | null; projectId: string | null },
  ): Promise<ThreadSummary> {
    const userId = this.authorOf(context);
    const title = titleFrom(input.title);

    return this.db.withTenant(context, async (tx) => {
      const [row] = await tx
        .insert(workspaceThreads)
        .values({
          organizationId: context.organizationId,
          userId,
          title,
          modelId: input.modelId,
          projectId: input.projectId,
        })
        .returning({
          id: workspaceThreads.id,
          title: workspaceThreads.title,
          modelId: workspaceThreads.modelId,
          messageCount: workspaceThreads.messageCount,
          createdAt: workspaceThreads.createdAt,
          lastMessageAt: workspaceThreads.lastMessageAt,
        });

      if (!row) throw new NotFoundError('Thread', 'Insert returned no row.');
      return row;
    });
  }

  /**
   * One thread with its transcript.
   *
   * A thread belonging to another member reads as NOT FOUND rather than
   * forbidden. "You may not read this" confirms it exists, and one member
   * probing ids for another's threads should learn nothing from the answer.
   */
  async getThread(
    context: TenantContext,
    threadId: string,
  ): Promise<{ thread: ThreadSummary; messages: ThreadMessageDto[] }> {
    const userId = this.authorOf(context);

    return this.db.withTenant(context, async (tx) => {
      const thread = await loadThread(tx, context.organizationId, userId, threadId);
      const messages = await tx
        .select({
          id: workspaceThreadMessages.id,
          role: workspaceThreadMessages.role,
          content: workspaceThreadMessages.content,
          modelId: workspaceThreadMessages.modelId,
          errorCode: workspaceThreadMessages.errorCode,
          createdAt: workspaceThreadMessages.createdAt,
        })
        .from(workspaceThreadMessages)
        .where(
          and(
            eq(workspaceThreadMessages.organizationId, context.organizationId),
            eq(workspaceThreadMessages.threadId, threadId),
          ),
        )
        .orderBy(asc(workspaceThreadMessages.createdAt));

      return { thread, messages: messages as ThreadMessageDto[] };
    });
  }

  async renameThread(
    context: TenantContext,
    threadId: string,
    title: string,
  ): Promise<ThreadSummary> {
    const userId = this.authorOf(context);
    const next = titleFrom(title);

    return this.db.withTenant(context, async (tx) => {
      await loadThread(tx, context.organizationId, userId, threadId);
      const [row] = await tx
        .update(workspaceThreads)
        .set({ title: next })
        .where(
          and(
            eq(workspaceThreads.organizationId, context.organizationId),
            eq(workspaceThreads.userId, userId),
            eq(workspaceThreads.id, threadId),
          ),
        )
        .returning({
          id: workspaceThreads.id,
          title: workspaceThreads.title,
          modelId: workspaceThreads.modelId,
          messageCount: workspaceThreads.messageCount,
          createdAt: workspaceThreads.createdAt,
          lastMessageAt: workspaceThreads.lastMessageAt,
        });

      if (!row) throw new NotFoundError('Thread');
      return row;
    });
  }

  /** Deletes the transcript with it, by cascade. */
  async deleteThread(context: TenantContext, threadId: string): Promise<void> {
    const userId = this.authorOf(context);

    await this.db.withTenant(context, async (tx) => {
      const deleted = await tx
        .delete(workspaceThreads)
        .where(
          and(
            eq(workspaceThreads.organizationId, context.organizationId),
            eq(workspaceThreads.userId, userId),
            eq(workspaceThreads.id, threadId),
          ),
        )
        .returning({ id: workspaceThreads.id });

      if (deleted.length === 0) throw new NotFoundError('Thread');
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Turns                                                                   */
  /* ---------------------------------------------------------------------- */

  /**
   * Record the user's message and build the request that answers it.
   *
   * Written BEFORE the model runs, deliberately. A turn that times out or
   * fails still leaves the question in the transcript — losing what somebody
   * typed because the provider was slow is the one failure mode a chat UI must
   * not have.
   */
  async openTurn(
    context: TenantContext,
    threadId: string,
    message: string,
  ): Promise<{ thread: ThreadSummary; userMessage: ThreadMessageDto; request: ChatRequest }> {
    const userId = this.authorOf(context);
    const content = message.trim();

    if (!content) throw new ValidationError({ message: 'The message is empty.' });
    if (content.length > THREAD_LIMITS.MAX_MESSAGE_CHARS) {
      throw new ValidationError({
        message: `A message may be at most ${THREAD_LIMITS.MAX_MESSAGE_CHARS} characters.`,
      });
    }

    return this.db.withTenant(context, async (tx) => {
      const thread = await loadThread(tx, context.organizationId, userId, threadId);

      if (thread.messageCount >= THREAD_LIMITS.MAX_MESSAGES_PER_THREAD) {
        throw new ValidationError({
          message: `This thread has reached ${THREAD_LIMITS.MAX_MESSAGES_PER_THREAD} messages. Start a new one.`,
        });
      }

      const history = await tx
        .select({
          role: workspaceThreadMessages.role,
          content: workspaceThreadMessages.content,
          errorCode: workspaceThreadMessages.errorCode,
        })
        .from(workspaceThreadMessages)
        .where(
          and(
            eq(workspaceThreadMessages.organizationId, context.organizationId),
            eq(workspaceThreadMessages.threadId, threadId),
          ),
        )
        .orderBy(asc(workspaceThreadMessages.createdAt));

      const [userMessage] = await tx
        .insert(workspaceThreadMessages)
        .values({
          organizationId: context.organizationId,
          threadId,
          role: 'user',
          content,
        })
        .returning({
          id: workspaceThreadMessages.id,
          role: workspaceThreadMessages.role,
          content: workspaceThreadMessages.content,
          modelId: workspaceThreadMessages.modelId,
          errorCode: workspaceThreadMessages.errorCode,
          createdAt: workspaceThreadMessages.createdAt,
        });

      if (!userMessage) throw new NotFoundError('Message', 'Insert returned no row.');

      await tx
        .update(workspaceThreads)
        .set({ messageCount: sql`${workspaceThreads.messageCount} + 1`, lastMessageAt: new Date() })
        .where(
          and(
            eq(workspaceThreads.organizationId, context.organizationId),
            eq(workspaceThreads.id, threadId),
          ),
        );

      return {
        thread,
        userMessage: userMessage as ThreadMessageDto,
        request: {
          model: thread.modelId,
          system: WORKSPACE_SYSTEM_PROMPT,
          messages: [...windowHistory(history), { role: 'user', content } as Message],
        },
      };
    });
  }

  /**
   * Record what came back.
   *
   * `errorCode` is written rather than thrown away: a thread that shows "the
   * provider refused this turn" where the answer should be is honest, and a
   * thread that silently skips the turn is not.
   */
  async closeTurn(
    context: TenantContext,
    threadId: string,
    result: {
      content: string;
      modelId: string | null;
      inputTokens: number;
      outputTokens: number;
      errorCode: string | null;
    },
  ): Promise<ThreadMessageDto> {
    const userId = this.authorOf(context);

    return this.db.withTenant(context, async (tx) => {
      await loadThread(tx, context.organizationId, userId, threadId);

      const [row] = await tx
        .insert(workspaceThreadMessages)
        .values({
          organizationId: context.organizationId,
          threadId,
          role: 'assistant',
          content: result.content,
          modelId: result.modelId,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          errorCode: result.errorCode,
        })
        .returning({
          id: workspaceThreadMessages.id,
          role: workspaceThreadMessages.role,
          content: workspaceThreadMessages.content,
          modelId: workspaceThreadMessages.modelId,
          errorCode: workspaceThreadMessages.errorCode,
          createdAt: workspaceThreadMessages.createdAt,
        });

      if (!row) throw new NotFoundError('Message', 'Insert returned no row.');

      await tx
        .update(workspaceThreads)
        .set({ messageCount: sql`${workspaceThreads.messageCount} + 1`, lastMessageAt: new Date() })
        .where(
          and(
            eq(workspaceThreads.organizationId, context.organizationId),
            eq(workspaceThreads.id, threadId),
          ),
        );

      return row as ThreadMessageDto;
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

type Tx = Parameters<Parameters<Database['withTenant']>[1]>[0];

async function loadThread(
  tx: Tx,
  organizationId: string,
  userId: string,
  threadId: string,
): Promise<ThreadSummary> {
  const [row] = await tx
    .select({
      id: workspaceThreads.id,
      title: workspaceThreads.title,
      modelId: workspaceThreads.modelId,
      messageCount: workspaceThreads.messageCount,
      createdAt: workspaceThreads.createdAt,
      lastMessageAt: workspaceThreads.lastMessageAt,
    })
    .from(workspaceThreads)
    .where(
      and(
        eq(workspaceThreads.organizationId, organizationId),
        eq(workspaceThreads.userId, userId),
        eq(workspaceThreads.id, threadId),
      ),
    )
    .limit(1);

  if (!row) throw new NotFoundError('Thread');
  return row;
}

/**
 * A title from the first thing the user said.
 *
 * Cut at a word boundary where one is near the limit, so a truncated title
 * reads like a phrase rather than like a bug.
 */
export function titleFrom(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return 'New chat';
  if (clean.length <= THREAD_LIMITS.MAX_TITLE_CHARS) return clean;

  const cut = clean.slice(0, THREAD_LIMITS.MAX_TITLE_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > THREAD_LIMITS.MAX_TITLE_CHARS - 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The most recent slice of a thread that fits both bounds.
 *
 * Trimmed from the END backwards, so what survives is the part the user is
 * actually referring to. Failed turns are dropped: an assistant message with
 * an error code is a note to the human about our plumbing, and replaying it
 * only invites the model to discuss the outage.
 */
export function windowHistory(
  messages: readonly { role: string; content: string; errorCode: string | null }[],
): Message[] {
  const kept: Message[] = [];
  let chars = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (message.errorCode) continue;
    if (kept.length >= THREAD_LIMITS.MAX_HISTORY_MESSAGES) break;
    if (chars + message.content.length > THREAD_LIMITS.MAX_HISTORY_CHARS) break;
    chars += message.content.length;
    kept.push({ role: message.role as Message['role'], content: message.content });
  }

  return kept.reverse();
}
