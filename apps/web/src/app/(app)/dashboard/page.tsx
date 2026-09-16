import Link from 'next/link';
import { serverApiOrNull } from '@/lib/api-server';
import {
  AgentIcon,
  ChatIcon,
  KnowledgeIcon,
  ResearchIcon,
  Wordmark,
} from '@/components/marketing/icons';

interface OrganizationResponse {
  organization: { id: string; name: string; slug: string; createdAt: string };
}
interface ProjectsResponse {
  projects: Array<{ id: string; name: string; slug: string }>;
}
interface MembersResponse {
  members: Array<{ id: string; name: string; role: string }>;
}

/** Where someone can actually start. Each one is a page that exists. */
const ACTIONS = [
  {
    href: '/knowledge',
    Icon: KnowledgeIcon,
    title: 'Upload a document',
    body: 'Parsed, chunked and searchable in the same request.',
  },
  {
    href: '/agents',
    Icon: AgentIcon,
    title: 'Build an agent',
    body: 'Typed tools, an allowlist, and a human approval step.',
  },
  {
    href: '/research',
    Icon: ResearchIcon,
    title: 'Run research',
    body: 'Every citation a lookup into pages actually fetched.',
  },
  {
    href: '/chatbots',
    Icon: ChatIcon,
    title: 'Ground a chatbot',
    body: 'Answers from your documents, pinned to your origins.',
  },
];

export default async function DashboardPage() {
  // Each call is independently permission-gated by the API. A viewer, for
  // example, receives 403 for members and simply sees no member count —
  // the page degrades rather than failing.
  const [org, projects, members] = await Promise.all([
    serverApiOrNull<OrganizationResponse>('/v1/organization'),
    serverApiOrNull<ProjectsResponse>('/v1/projects'),
    serverApiOrNull<MembersResponse>('/v1/organization/members'),
  ]);

  return (
    <div className="py-6">
      <div className="mx-auto max-w-2xl text-center">
        <Wordmark className="mx-auto h-12 w-12" />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          What should we build?
        </h1>
        <p className="mt-3 text-base text-muted">
          {org?.organization.name
            ? `Everything here belongs to ${org.organization.name} and to nothing else.`
            : 'Your workspace for documents, agents, research and chatbots.'}
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
        {ACTIONS.map(({ href, Icon, title, body }) => (
          <Link
            key={href}
            href={href}
            className="group flex gap-4 rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight">{title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">{body}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
        <Stat label="Projects" value={projects?.projects.length ?? 0} href="/projects" />
        <Stat label="Members" value={members?.members.length ?? 0} href="/members" />
        <Stat label="Usage" value="View" href="/usage" />
      </div>

      {/*
       * Stated on the dashboard rather than discovered halfway through a task.
       * Both are still true: see the README's "deliberately not working" note.
       */}
      <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-line bg-white p-5">
        <p className="text-sm font-semibold tracking-tight">Two things to know</p>
        <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted">
          <li>
            <span className="text-ink">No model call happens without a provider credential.</span>{' '}
            Add one per organization in{' '}
            <Link href="/credentials" className="font-medium text-accent hover:underline">
              Credentials
            </Link>
            . Instance-wide keys are refused in production.
          </li>
          <li>
            <span className="text-ink">Retrieval is lexical, not semantic.</span> Vector search
            needs the pgvector extension; where it is not installed, search is full-text and
            trigram, and says so rather than implying more.
          </li>
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number | string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-line bg-white px-5 py-4 transition hover:border-accent/40"
    >
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}
