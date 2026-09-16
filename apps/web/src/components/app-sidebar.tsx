'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserApi } from '@/lib/api-browser';
import {
  AgentIcon,
  ChatIcon,
  DashboardIcon,
  InboxIcon,
  KeyIcon,
  KnowledgeIcon,
  LedgerIcon,
  ProjectIcon,
  ResearchIcon,
  SettingsIcon,
  UsersIcon,
  Wordmark,
} from '@/components/marketing/icons';

interface Organization {
  organizationId: string;
  name: string;
  slug: string;
  role: string;
}

/**
 * The application's navigation.
 *
 * A SIDEBAR RATHER THAN A TOP BAR, because there are eleven destinations. Laid
 * along the top they were an unlabelled row of small links that ran out of
 * width; down the side each one gets an icon, a readable label, and — more
 * usefully — a heading that says what kind of thing it is. Four short groups
 * are scannable in a way that eleven equal siblings never were.
 */
const GROUPS: Array<{
  heading: string | null;
  items: Array<{ href: string; label: string; Icon: typeof DashboardIcon }>;
}> = [
  {
    heading: null,
    items: [{ href: '/dashboard', label: 'Dashboard', Icon: DashboardIcon }],
  },
  {
    heading: 'Workspace',
    items: [
      { href: '/projects', label: 'Projects', Icon: ProjectIcon },
      { href: '/knowledge', label: 'Knowledge', Icon: KnowledgeIcon },
    ],
  },
  {
    heading: 'Build',
    items: [
      { href: '/agents', label: 'Agents', Icon: AgentIcon },
      { href: '/research', label: 'Research', Icon: ResearchIcon },
      { href: '/chatbots', label: 'Chatbots', Icon: ChatIcon },
    ],
  },
  {
    heading: 'Operate',
    items: [
      { href: '/inbox', label: 'Inbox', Icon: InboxIcon },
      { href: '/usage', label: 'Usage', Icon: LedgerIcon },
    ],
  },
  {
    heading: 'Administration',
    items: [
      { href: '/credentials', label: 'Credentials', Icon: KeyIcon },
      { href: '/members', label: 'Members', Icon: UsersIcon },
      { href: '/settings', label: 'Settings', Icon: SettingsIcon },
    ],
  },
];

export function AppSidebar({
  organizations,
  activeOrganizationId,
}: {
  organizations: Organization[];
  activeOrganizationId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const active = organizations.find((o) => o.organizationId === activeOrganizationId);

  /*
   * Switching sends an organization id to the API. Safe, because the API
   * re-verifies membership server-side before writing it to the session — the
   * list rendered here is a convenience, never the authority.
   */
  async function switchTo(organizationId: string) {
    if (organizationId === activeOrganizationId) return;
    setBusy(true);
    try {
      await browserApi('/v1/auth/switch-organization', {
        method: 'POST',
        body: { organizationId },
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await browserApi('/v1/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const nav = (
    <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {GROUPS.map((group, index) => (
        <div key={group.heading ?? `group-${index}`}>
          {group.heading ? (
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-muted uppercase">
              {group.heading}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, Icon }) => {
              const current = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={current ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                      current
                        ? 'bg-accent-soft font-medium text-accent'
                        : 'text-ink/75 hover:bg-black/[0.04] hover:text-ink'
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile: a bar with a disclosure, since a fixed sidebar would eat the screen. */}
      <div className="flex h-14 items-center gap-3 border-b border-line bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="app-nav"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line"
        >
          <span className="sr-only">{open ? 'Close navigation' : 'Open navigation'}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            aria-hidden="true"
            className="h-5 w-5"
          >
            {open ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Wordmark className="h-6 w-6" />
          <span className="text-[15px] font-semibold tracking-tight">
            Mooza<span className="brand-text">.ai</span>
          </span>
        </Link>
      </div>

      <aside
        id="app-nav"
        className={`${
          open ? 'flex' : 'hidden'
        } w-full shrink-0 flex-col border-r border-line bg-white lg:flex lg:h-screen lg:w-[270px] lg:sticky lg:top-0`}
      >
        <div className="hidden items-center gap-2.5 px-5 pt-5 pb-1 lg:flex">
          <Wordmark className="h-7 w-7" />
          <Link href="/dashboard" className="text-[17px] font-semibold tracking-tight">
            Mooza<span className="brand-text">.ai</span>
          </Link>
        </div>

        <div className="px-3 pt-3">
          <label htmlFor="org-switcher" className="sr-only">
            Active organization
          </label>
          <select
            id="org-switcher"
            disabled={busy || organizations.length === 0}
            value={activeOrganizationId ?? ''}
            onChange={(e) => void switchTo(e.target.value)}
            className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent disabled:opacity-50"
          >
            {organizations.length === 0 ? <option value="">No organizations</option> : null}
            {organizations.map((org) => (
              <option key={org.organizationId} value={org.organizationId}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        {nav}

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
              {(active?.name ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{active?.name ?? 'No organization'}</p>
              <p className="truncate text-xs text-muted capitalize">{active?.role ?? '—'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={busy}
            className="mt-1 w-full rounded-lg px-2 py-2 text-left text-sm text-muted transition hover:bg-black/[0.04] hover:text-ink disabled:opacity-50"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
