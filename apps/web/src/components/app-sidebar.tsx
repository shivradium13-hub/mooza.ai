'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  PlusIcon,
  ProjectIcon,
  ResearchIcon,
  SearchIcon,
  SparkIcon,
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
    items: [
      { href: '/chat', label: 'Chat', Icon: SparkIcon },
      { href: '/dashboard', label: 'Dashboard', Icon: DashboardIcon },
    ],
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

/**
 * What "New" can actually start.
 *
 * Each one is a page whose create form — or, for chat, whose message box — is
 * the first thing on it, so the button lands on the thing rather than near it.
 *
 * Chat leads because it is what someone opening this menu most often wants,
 * and Research sits under it because the two are easy to confuse: chat has no
 * tools and cites nothing, research reads pages and cites what it read. The
 * one-line descriptions carry that difference at the point of choosing.
 */
const CREATE = [
  { href: '/chat', label: 'New chat', body: 'Just the conversation. No sources.', Icon: SparkIcon },
  {
    href: '/research',
    label: 'Ask research',
    body: 'Answered from pages actually fetched.',
    Icon: ResearchIcon,
  },
  {
    href: '/knowledge',
    label: 'Add knowledge',
    body: 'Upload or paste a document.',
    Icon: KnowledgeIcon,
  },
  { href: '/agents', label: 'New agent', body: 'Typed tools, with approval.', Icon: AgentIcon },
  { href: '/chatbots', label: 'New chatbot', body: 'Grounded in your documents.', Icon: ChatIcon },
  { href: '/projects', label: 'New project', body: 'Somewhere to scope work.', Icon: ProjectIcon },
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
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const footerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const active = organizations.find((o) => o.organizationId === activeOrganizationId);

  /*
   * Eleven destinations is past the point where scanning beats typing on a
   * phone, so the list filters. Matching the GROUP HEADING as well as the label
   * is deliberate: "admin" should find Credentials, Members and Settings even
   * though none of them contains the word.
   */
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return GROUPS;
    return GROUPS.map((group) => {
      if (group.heading?.toLowerCase().includes(needle)) return group;
      return { ...group, items: group.items.filter((i) => i.label.toLowerCase().includes(needle)) };
    }).filter((group) => group.items.length > 0);
  }, [query]);

  /*
   * While the drawer is over the page, the page behind it must not scroll.
   * Without this a swipe meant for the menu scrolls the dashboard underneath,
   * and closing the drawer leaves you somewhere you never navigated to.
   *
   * Escape closes whatever is on top: the New menu if it is up, otherwise the
   * drawer. Either one covers the screen, and a cover with no keyboard way out
   * is a trap.
   */
  useEffect(() => {
    if (!open && !createOpen) return;

    /*
     * Only what actually covers the screen locks it. The drawer and the sheet
     * do; the desktop popover is a small thing in the corner of a page still
     * being read, and freezing that page — plus the reflow when the scrollbar
     * goes — would be a side effect nobody asked for.
     */
    const covering = open || window.matchMedia('(max-width: 1023px)').matches;
    const previousOverflow = document.body.style.overflow;
    if (covering) document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (createOpen) setCreateOpen(false);
      else setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      if (covering) document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, createOpen]);

  /*
   * On a phone the New menu is dismissed by its scrim. On a wide screen there
   * is no scrim to tap — the page behind it is still in use — so an outside
   * click closes it instead, which is what every other popover on the web does.
   *
   * Both the button and the sheet are excluded, the sheet because it lives
   * outside the drawer: closing on its own mousedown would unmount the link
   * before the click that follows could navigate.
   */
  useEffect(() => {
    if (!createOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (footerRef.current?.contains(target) || sheetRef.current?.contains(target)) return;
      setCreateOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [createOpen]);

  /** Everything the drawer was showing is dismissed together. */
  function closeDrawer() {
    setOpen(false);
    setCreateOpen(false);
    setQuery('');
  }

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

  /* One list, rendered in two places: a sheet on a phone, a popover on a desktop. */
  const createItems = CREATE.map(({ href, label, body, Icon }) => (
    <Link
      key={href}
      href={href}
      role="menuitem"
      onClick={closeDrawer}
      className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-black/[0.04]"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted">{body}</span>
      </span>
    </Link>
  ));

  return (
    <>
      {/* Mobile: a bar with a disclosure, since a fixed sidebar would eat the screen. */}
      <div className="flex h-14 items-center gap-3 border-b border-line bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => (open ? closeDrawer() : setOpen(true))}
          aria-expanded={open}
          aria-controls="app-nav"
          className="-ml-1 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line"
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

        {/* Starting something is the commonest reason to touch this bar, so it
            is one tap from every page rather than two behind the menu. */}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          aria-haspopup="menu"
          aria-expanded={createOpen}
          className="btn-brand -mr-1 ml-auto inline-flex h-11 w-11 items-center justify-center rounded-lg"
        >
          <span className="sr-only">New</span>
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>

      {/*
       * The scrim. Tapping it closes the drawer, which is what a thumb reaches
       * for first. `lg:hidden` because above that the sidebar is permanent and
       * there is nothing to dim.
       */}
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeDrawer}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      ) : null}

      <aside
        id="app-nav"
        className={`${
          open ? 'flex' : 'hidden'
        } fixed inset-y-0 left-0 z-50 w-[86%] max-w-[320px] shrink-0 flex-col overflow-hidden border-r border-line bg-white shadow-2xl lg:sticky lg:top-0 lg:z-auto lg:flex lg:h-screen lg:w-[270px] lg:max-w-none lg:shadow-none`}
      >
        {/* Phone: the drawer's own header, because the page's top bar is now
            behind the scrim and cannot be reached. */}
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3 lg:hidden">
          <Wordmark className="h-7 w-7" />
          <span className="text-[17px] font-semibold tracking-tight">
            Mooza<span className="brand-text">.ai</span>
          </span>
          <button
            type="button"
            onClick={closeDrawer}
            className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-black/[0.05] hover:text-ink"
          >
            <span className="sr-only">Close navigation</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="hidden items-center gap-2.5 px-5 pt-5 pb-1 lg:flex">
          <Wordmark className="h-7 w-7" />
          <Link href="/dashboard" className="text-[17px] font-semibold tracking-tight">
            Mooza<span className="brand-text">.ai</span>
          </Link>
        </div>

        <div className="space-y-2 px-3 pt-3">
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

          <div className="relative">
            <label htmlFor="nav-search" className="sr-only">
              Filter navigation
            </label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id="nav-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-line bg-white pr-3 pl-9 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {groups.length === 0 ? (
            <p className="px-3 text-sm text-muted">Nothing here matches “{query.trim()}”.</p>
          ) : null}
          {groups.map((group, index) => (
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
                        onClick={closeDrawer}
                        className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition lg:py-2 ${
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

        {/* Pinned, so the things reached for most stay under the thumb however
            far the list above has been scrolled. */}
        <div ref={footerRef} className="relative border-t border-line p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={createOpen}
              className="btn-brand inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
            >
              <PlusIcon className="h-4 w-4" />
              New
            </button>
            <Link
              href="/settings"
              onClick={closeDrawer}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition hover:bg-black/[0.04] hover:text-ink"
            >
              <span className="sr-only">Settings</span>
              <SettingsIcon className="h-[18px] w-[18px]" />
            </Link>
          </div>

          <div className="mt-2 flex items-center gap-2 px-1 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
              {(active?.name ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{active?.name ?? 'No organization'}</p>
              <p className="truncate text-xs text-muted capitalize">{active?.role ?? '—'}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={busy}
              className="shrink-0 rounded-lg px-2 py-2 text-sm text-muted transition hover:bg-black/[0.04] hover:text-ink disabled:opacity-50"
            >
              Sign out
            </button>
          </div>

          {/* Wide screens only: the menu belongs to the button that opened it,
              so it rises out of it. The phone gets a sheet instead, below —
              it cannot live in here, because the drawer is display:none when
              the plus in the top bar is what was pressed. */}
          {createOpen ? (
            <div
              role="menu"
              aria-label="New"
              className="absolute inset-x-3 bottom-full mb-2 hidden rounded-2xl border border-line bg-white p-2 shadow-xl lg:block"
            >
              {createItems}
            </div>
          ) : null}
        </div>
      </aside>

      {/* The phone sheet, outside the drawer so the plus in the top bar can
          raise it while the drawer is shut. */}
      {createOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setCreateOpen(false)}
            className="fixed inset-0 z-[55] bg-black/40 lg:hidden"
          />
          <div
            ref={sheetRef}
            role="menu"
            aria-label="New"
            className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl border-t border-line bg-white p-2 pb-5 shadow-2xl lg:hidden"
          >
            <p className="px-3 pt-1 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">
              New
            </p>
            {createItems}
          </div>
        </>
      ) : null}
    </>
  );
}
