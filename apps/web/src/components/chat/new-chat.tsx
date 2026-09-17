'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api-shared';
import { browserApi } from '@/lib/api-browser';
import { setPendingMessage } from '@/lib/chat-handoff';
import { Wordmark } from '@/components/marketing/icons';
import { Composer } from '@/components/chat/composer';

interface CreateResponse {
  thread: { id: string; title: string };
}

/**
 * The empty state of chat.
 *
 * Sending here does two things — create a thread, then ask in it — and the
 * question is carried across the navigation in memory rather than in the URL.
 * See lib/chat-handoff for why that is a module variable and not a query
 * parameter or session storage.
 */
export function NewChat() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start(text: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const { thread } = await browserApi<CreateResponse>('/v1/chat/threads', {
        method: 'POST',
        body: { title: text },
      });
      setPendingMessage(thread.id, text);
      router.push(`/chat/${thread.id}`);
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : 'Could not start a new chat.');
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col justify-center">
      <div className="mx-auto w-full max-w-2xl">
        <div className="text-center">
          <Wordmark className="mx-auto h-11 w-11" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            What can I help with?
          </h1>
        </div>

        <div className="mt-6">
          <Composer onSend={(text) => void start(text)} busy={busy} autoFocus />
        </div>

        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {/*
         * Said once, here, rather than discovered when the assistant declines
         * to read a document. Everything else in the product is grounded in
         * something; this surface is not, and pretending otherwise is how a
         * chat box ends up inventing the contents of a file.
         */}
        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          This assistant sees only the conversation — it cannot open your documents or search the
          web. For those, use{' '}
          <a href="/knowledge" className="font-medium text-accent hover:underline">
            Knowledge
          </a>{' '}
          and{' '}
          <a href="/research" className="font-medium text-accent hover:underline">
            Research
          </a>
          .
        </p>
      </div>
    </div>
  );
}
