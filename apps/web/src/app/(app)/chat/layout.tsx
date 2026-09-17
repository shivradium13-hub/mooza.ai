import { serverApiOrNull } from '@/lib/api-server';
import { ThreadRail, type ThreadRow } from '@/components/chat/thread-rail';

interface ThreadsResponse {
  threads: ThreadRow[];
}

/**
 * The chat shell.
 *
 * The thread list is fetched HERE rather than in the application layout, so
 * the ten pages that are not chat do not pay for a query they never render.
 * Chat is the one surface where a history rail earns its request.
 */
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const data = await serverApiOrNull<ThreadsResponse>('/v1/chat/threads');

  return (
    <div className="lg:flex lg:gap-8">
      <ThreadRail threads={data?.threads ?? []} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
