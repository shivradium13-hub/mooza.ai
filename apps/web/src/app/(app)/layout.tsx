import { redirect } from 'next/navigation';
import { serverApiOrNull } from '@/lib/api-server';
import { AppSidebar } from '@/components/app-sidebar';

interface MeResponse {
  user: { id: string };
  organizations: Array<{ organizationId: string; name: string; slug: string; role: string }>;
  activeOrganizationId: string | null;
}

/**
 * Authenticated shell.
 *
 * The session is checked on the SERVER before any of this renders. There is no
 * client-side "redirect if not logged in" flash, and no protected content is
 * ever sent to an unauthenticated browser.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await serverApiOrNull<MeResponse>('/v1/auth/me');
  if (!me) redirect('/login');

  const active = me.organizations.find((o) => o.organizationId === me.activeOrganizationId);

  return (
    <div className="min-h-screen bg-chalk lg:flex">
      <AppSidebar organizations={me.organizations} activeOrganizationId={me.activeOrganizationId} />

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
          {active ? null : (
            <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No organization is selected for this session.
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
