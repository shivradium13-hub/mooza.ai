'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api-shared';
import { postEventStream } from '@/lib/sse';
import { takePendingMessage } from '@/lib/chat-handoff';
import { Wordmark } from '@/components/marketing/icons';
import { Composer } from '@/components/chat/composer';
import { Markdown } from '@/components/chat/markdown';

export interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modelId: string | null;
  errorCode: string | null;
  createdAt: string;
}

/**
 * One chat thread.
 *
 * THE TRANSCRIPT ON SCREEN IS NOT THE SOURCE OF TRUTH — the thread in the
 * database is. What is rendered while a turn runs is an optimistic copy: the
 * user's message appears the instant they send it, and the reply is assembled
 * from the deltas as they arrive. When the turn closes, the server's own rows
 * replace both, so what is on screen after a turn is what a reload would show.
 * Without that, a client-side bug quietly shows people a conversation their
 * thread does not contain.
 */
export function ThreadView({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: ThreadMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  /** The reply being streamed, before it becomes a row. */
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const foot = useRef<HTMLDivElement>(null);

  // Follow the answer as it is written. `block: 'end'` rather than a scroll
  // container of our own, so the page scrolls the way the rest of the app does.
  useEffect(() => {
    foot.current?.scrollIntoView({ block: 'end', behavior: draft === null ? 'auto' : 'smooth' });
  }, [messages.length, draft]);

  const send = useCallback(
    async (text: string) => {
      setError(null);
      setBusy(true);
      setDraft('');

      const optimistic: ThreadMessage = {
        id: `pending-${Date.now()}`,
        role: 'user',
        content: text,
        modelId: null,
        errorCode: null,
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current, optimistic]);

      const controller = new AbortController();
      abort.current = controller;

      try {
        await postEventStream(
          `/v1/chat/threads/${threadId}/messages/stream`,
          { message: text },
          {
            signal: controller.signal,
            onEvent: (event, data) => {
              if (event === 'opened') {
                // Swap the optimistic message for the stored one, so its id
                // and timestamp are the real ones from here on.
                const stored = data.userMessage as ThreadMessage | undefined;
                if (stored) {
                  setMessages((current) =>
                    current.map((m) => (m.id === optimistic.id ? stored : m)),
                  );
                }
              } else if (event === 'text') {
                setDraft((current) => (current ?? '') + String(data.text ?? ''));
              } else if (event === 'error') {
                setError(String(data.message ?? 'The turn failed.'));
              } else if (event === 'done') {
                const stored = data.message as ThreadMessage | undefined;
                if (stored) setMessages((current) => [...current, stored]);
                setDraft(null);
              }
            },
          },
        );
      } catch (err) {
        if (controller.signal.aborted) {
          // Stopping is a choice, not a failure. The partial reply was still
          // written server-side, so reload shows what was received.
          router.refresh();
        } else {
          setError(
            err instanceof ApiError ? err.message : 'The connection to the model was lost.',
          );
        }
      } finally {
        setDraft(null);
        setBusy(false);
        abort.current = null;
        // Refreshes the thread list in the rail, and reconciles this thread
        // with what was actually stored.
        router.refresh();
      }
    },
    [router, threadId],
  );

  /*
   * The first message of a new thread was typed on the previous route. It is
   * handed over in memory (see lib/chat-handoff) and taken exactly once —
   * `takePendingMessage` clears it, so React's double-invoked effects in
   * development cannot send it twice.
   */
  useEffect(() => {
    const pending = takePendingMessage(threadId);
    if (pending) void send(pending);
  }, [threadId, send]);

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      <div className="flex-1 space-y-6 pb-4">
        {messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}

        {draft !== null ? (
          <div className="flex gap-3">
            <Avatar />
            <div className="min-w-0 flex-1 pt-0.5 text-[15px] sm:text-sm">
              {draft ? <Markdown text={draft} /> : <Thinking />}
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div ref={foot} />
      </div>

      {/*
       * Sticky rather than fixed: fixed would need the page's own padding
       * compensated for at every breakpoint, and would sit over the footer of
       * a short thread. Sticky stops at the bottom of the conversation when
       * there is not enough of it to scroll.
       */}
      <div className="sticky bottom-0 -mx-1 bg-chalk/95 px-1 pt-2 pb-3 backdrop-blur">
        <Composer onSend={(text) => void send(text)} busy={busy} onStop={() => abort.current?.abort()} />
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ThreadMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent-soft px-4 py-2.5 text-[15px] whitespace-pre-wrap text-ink sm:text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1 pt-0.5 text-[15px] sm:text-sm">
        {message.errorCode ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {message.content}
          </p>
        ) : (
          <Markdown text={message.content} />
        )}
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <span className="mt-0.5 shrink-0">
      <Wordmark className="h-7 w-7" />
    </span>
  );
}

/** Three dots. Says "waiting", which is all that is known before the first token. */
function Thinking() {
  return (
    <span className="inline-flex items-center gap-1 py-1.5" aria-label="Writing a reply">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}
