import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations, users } from './identity.js';
import { projects } from './projects.js';

/**
 * The signed-in user's own chat threads (migration 0017).
 *
 * NOT the same thing as `chat_conversations` in ./chat.ts, and the distinction
 * is worth holding on to. That table is a STRANGER talking to a chatbot
 * published on a customer's website: it needs a chatbot, a deployment and a
 * visitor token, and its rows appear in the staff handoff inbox. These are a
 * member of the organization talking to a model in the workspace — no bot, no
 * deployment, nobody waiting to take over.
 *
 * Called "threads" rather than "conversations" for exactly that reason: two
 * types named the same thing get mixed up at the call site eventually, and the
 * one that gets mixed up here is the one facing the open internet.
 */

export const workspaceThreads = pgTable(
  'workspace_threads',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /**
     * Whose thread it is.
     *
     * RLS isolates by organization, not by user — `withTenant` binds only the
     * organization (see migration 0002). Per-user scoping is applied in the
     * query layer, in one service, and this column is what it filters on.
     */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),

    /** The first thing the user said, trimmed. Never model-generated. */
    title: text('title').notNull(),
    /** A model the user pinned, or null to let the router choose per turn. */
    modelId: text('model_id'),

    messageCount: integer('message_count').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('workspace_threads_user_activity_idx').on(
      t.organizationId,
      t.userId,
      t.lastMessageAt.desc(),
    ),
    check('workspace_threads_title_present', sql`length(btrim(${t.title})) > 0`),
  ],
);

export const workspaceThreadMessages = pgTable(
  'workspace_thread_messages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => workspaceThreads.id, { onDelete: 'cascade' }),

    /** 'user' | 'assistant' */
    role: text('role').notNull(),
    content: text('content').notNull(),

    /**
     * Which model actually answered. Per message, not per thread: the router
     * can fall back mid-thread, and "which model said this" is the first
     * question asked about an answer somebody disputes.
     */
    modelId: text('model_id'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    /** Set when the turn failed, so a broken thread shows where it broke. */
    errorCode: text('error_code'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('workspace_thread_messages_thread_idx').on(t.organizationId, t.threadId, t.createdAt),
  ],
);
