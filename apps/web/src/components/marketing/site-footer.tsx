import Link from 'next/link';
import { Wordmark } from './icons';

/**
 * Footer link columns.
 *
 * Every entry points at something that exists. A marketing footer full of
 * dead links to a careers page and a blog nobody has written is the first
 * thing that tells a visitor the rest of the page may be aspirational too.
 */
const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { href: '/product#knowledge', label: 'Knowledge engine' },
      { href: '/product#agents', label: 'Agents' },
      { href: '/product#research', label: 'Research' },
      { href: '/product#chatbots', label: 'Chatbots' },
    ],
  },
  {
    heading: 'Platform',
    links: [
      { href: '/product#gateway', label: 'AI gateway' },
      { href: '/security#vault', label: 'Credential vault' },
      { href: '/security#isolation', label: 'Tenant isolation' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/security', label: 'Security' },
      { href: '/pricing#faq', label: 'FAQ' },
      { href: '/login', label: 'Sign in' },
      { href: '/signup', label: 'Create an account' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2.5" aria-label="MOOZA AI home">
              <Wordmark className="h-7 w-7" />
              <span className="text-[17px] font-semibold tracking-tight">
                Mooza<span className="brand-text">.ai</span>
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              One workspace for your documents, your agents and your models — with the audit trail
              that makes it usable at work.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-xs font-semibold tracking-[0.12em] text-ink uppercase">
                {column.heading}
              </h2>
              {/* Roomier rows on a phone: a 20px line of text is a poor thumb target,
                  and these sit in a stack where the neighbour is easy to hit. */}
              <ul className="mt-3 space-y-0.5 sm:mt-4 sm:space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="-mx-2 block rounded-md px-2 py-2.5 text-sm text-muted transition hover:text-ink sm:mx-0 sm:px-0 sm:py-0"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MOOZA AI. All rights reserved.</p>
          <p>Built to be auditable: every model call, retrieval and approval is on the record.</p>
        </div>
      </div>
    </footer>
  );
}
