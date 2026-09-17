'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { browserApi } from '@/lib/api-browser';
import { PlusIcon } from '@/components/marketing/icons';

export interface ThreadRow {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
}

/**
 * The list of past threads.
 *
 * Shown beside the conversation on a wide screen and above it on a phone,
 * where a permanent rail would take the width the conversation needs. On a
 * phone it is a collapsed disclosure rather than a list: someone who opened
 * chat wants to type, not to browse what they typed last week.
 */
export function ThreadRail({ threads }: { threads: ThreadRow[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(id: string): Promise<void> {
    setBusyId(id);
    try {
      await browserApi(`/v1/chat/threads/${id}`, { method: 'DELETE' });
      // Leaving the thread you just deleted on screen would be a ghost.
      if (pathname === `/chat/${id}`) router.push('/chat');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const list = (
    <ul className="space-y-0.5">
      {threads.map((thread) => {
        const current = pathname === `/chat/${thread.id}`;
        return (
          <li key={thread.id} className="group relative">
            <Link
              href={`/chat/${thread.id}`}
              onClick={() => setOpen(false)}
              aria-current={current ? 'page' : undefined}
              className={`block truncate rounded-lg py-2.5 pr-9 pl-3 text-sm transition lg:py-2 ${
                current
                  ? 'bg-accent-soft font-medium text-accent'
                  : 'text-ink/75 hover:bg-black/[0.04] hover:text-ink'
              }`}
            >
              {thread.title}
            </Link>
            <button
              type="button"
              onClick={() => void remove(thread.id)}
              disabled={busyId === thread.id}
              /*
               * Always present for a touch device, which has no hover to
               * reveal it with; faded until hovered on a pointer device so a
               * long list is not a column of delete buttons.
               */
              className="absolute top-1/2 right-1 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition hover:bg-black/[0.06] hover:text-danger disabled:opacity-40 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
            >
              <span className="sr-only">Delete “{thread.title}”</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M5 7h14M10 7V5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V7M7 7l.8 11a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7" />
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Phone: a disclosure above the conversation. */}
      <div className="mb-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-white text-sm font-medium transition hover:bg-black/[0.03]"
          >
            <PlusIcon className="h-4 w-4" />
            New chat
          </Link>
          {threads.length > 0 ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex h-10 items-center rounded-xl border border-line bg-white px-3 text-sm text-muted transition hover:bg-black/[0.03]"
            >
              History
              <span className="ml-1.5 text-xs">({threads.length})</span>
            </button>
          ) : null}
        </div>
        {open ? (
          <div className="mt-2 max-h-[45vh] overflow-y-auto rounded-xl border border-line bg-white p-1.5">
            {list}
          </div>
        ) : null}
      </div>

      {/* Wide: a permanent rail. */}
      <aside className="hidden w-[240px] shrink-0 lg:block">
        <div className="sticky top-8">
          <Link
            href="/chat"
            className="mb-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white text-sm font-medium transition hover:bg-black/[0.03]"
          >
            <PlusIcon className="h-4 w-4" />
            New chat
          </Link>
          {threads.length === 0 ? (
            <p className="px-3 text-xs leading-relaxed text-muted">
              Threads you start appear here. They are yours — other members of this organization do
              not see them.
            </p>
          ) : (
            <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto">{list}</div>
          )}
        </div>
      </aside>
    </>
  );
}
