import { notFound } from 'next/navigation';
import { serverApiOrNull } from '@/lib/api-server';
import { ThreadView, type ThreadMessage } from '@/components/chat/thread-view';

interface ThreadResponse {
  thread: { id: string; title: string; messageCount: number };
  messages: ThreadMessage[];
}

/**
 * One thread, server-rendered from its stored transcript.
 *
 * `serverApiOrNull` returns null for 404 AND for 403, which under
 * Row-Level Security is the same answer to the same question: this is not
 * yours to read. Both become the app's own not-found page rather than an
 * error, so probing thread ids tells nobody anything.
 */
export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await serverApiOrNull<ThreadResponse>(`/v1/chat/threads/${id}`);
  if (!data) notFound();

  return (
    <div>
      <h1 className="sr-only">{data.thread.title}</h1>
      <ThreadView threadId={data.thread.id} initialMessages={data.messages} />
    </div>
  );
}
