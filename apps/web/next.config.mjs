import { findLeakyPublicVars } from '@moka/config';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * BUILD-TIME SECRET GUARD
 *
 * `@moka/config` refuses to start the API if a `NEXT_PUBLIC_` variable looks
 * like a secret. That guard runs in `loadConfig()` — which the WEB app never
 * calls, because it has no server config of its own.
 *
 * That left a real gap, and hosting makes it worse rather than better. On a
 * platform like Vercel, environment variables are set in a dashboard by
 * whoever has access, and anything prefixed `NEXT_PUBLIC_` is inlined into the
 * JavaScript bundle served to every visitor. A `NEXT_PUBLIC_ENCRYPTION_KEY`
 * added by someone in a hurry would be published to the internet by the next
 * deploy, with nothing anywhere refusing.
 *
 * So the same check runs here, at build time, using the same function — one
 * definition of "looks like a secret", not two that drift.
 *
 * It throws rather than warns. A warning in build output is a line nobody
 * reads in a log nobody opens; a failed deploy is a conversation.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const leaky = findLeakyPublicVars(process.env);
if (leaky.length > 0) {
  throw new Error(
    `Refusing to build: these NEXT_PUBLIC_ variables look like secrets and would be ` +
      `inlined into the browser bundle, where every visitor can read them: ${leaky.join(', ')}.\n\n` +
      `Rename them without the NEXT_PUBLIC_ prefix and read them on the server, or — if the ` +
      `value really is public — rename it so it does not read as a secret.`,
  );
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * SAME-ORIGIN API PROXY
 *
 * Set `API_ORIGIN` and requests to `/api/*` are forwarded to the API, so the
 * browser only ever talks to this app's own origin.
 *
 * WHY THAT MATTERS, AND WHAT BREAKS WITHOUT IT. The session cookie is issued by
 * the API without a `Domain`, so it is host-only. When the two are deployed on
 * hosts with no shared parent — `*.vercel.app` and `*.up.railway.app` — the
 * browser holds that cookie for the API's host alone. It sends it to the API
 * quite happily, so signing in appears to work, and the Next.js server never
 * receives it, because the request arriving here carries no such cookie. Every
 * server-rendered page then concludes the visitor is signed out: login returns
 * 201, the app navigates to the dashboard, and the dashboard redirects
 * straight back to the sign-in form with nothing logged anywhere to say why.
 *
 * Proxying puts the `Set-Cookie` on this origin, which is the only thing that
 * makes it readable by a server component.
 *
 * This is the fallback, not the ideal. Two subdomains of one domain — say
 * `app.example.com` and `api.example.com` with `COOKIE_DOMAIN=.example.com` —
 * fix the same problem without routing every API call through this server.
 * Leave `API_ORIGIN` unset for that arrangement, and in local development,
 * where both sides already share `localhost`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const apiOrigin = process.env.API_ORIGIN?.replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(apiOrigin
    ? {
        async rewrites() {
          return [{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }];
        },
      }
    : {}),
  // Workspace packages ship TypeScript-aware dual builds; Next compiles them
  // in-process rather than requiring a separate watch build during dev.
  transpilePackages: ['@moka/core'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
