/**
 * Shared API-client primitives, safe in both server and client bundles.
 *
 * Deliberately free of `next/headers` (or any other server-only import), so
 * that a client component importing `browserApi` does not drag server-only
 * modules into the browser bundle.
 */

/**
 * The API origin. Genuinely public — it is an origin, not a secret. No
 * credential is ever exposed to the client; the session travels as an
 * httpOnly cookie that JavaScript cannot read.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Where the SERVER reaches the API, when that differs from where the browser
 * does.
 *
 * It differs whenever the two are deployed on hosts with no shared parent
 * domain — `*.vercel.app` talking to `*.up.railway.app`, say. There the session
 * cookie is host-only on the API's domain: the browser sends it to the API
 * quite happily, and the Next.js server never sees it at all, because the
 * request reaching Vercel carries no such cookie. Every server-rendered page
 * then decides the visitor is signed out. Login succeeds, the app navigates to
 * the dashboard, and the dashboard bounces straight back to the sign-in form.
 *
 * The fix is to give the browser a SAME-ORIGIN path — `NEXT_PUBLIC_API_URL=/api`
 * — which `next.config.mjs` rewrites onward. The cookie is then set on the app's
 * own origin, so server components can read it. The server cannot use that
 * relative path (it has no origin to resolve it against), so it keeps the
 * absolute one, which is what this is.
 *
 * Unset, both sides use the same value and nothing changes: that is the local
 * development case, where `http://localhost:4000` works from either side.
 */
export const SERVER_API_URL = process.env.API_ORIGIN ?? API_URL;

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown>; requestId?: string };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    /** Field-level validation detail, where the actionable message usually is. */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Build a request URL.
 *
 * Only relative paths are accepted, so a caller can never redirect this client
 * at another origin — the host always comes from configuration.
 */
export function buildUrl(path: string, base: string = API_URL): string {
  if (!path.startsWith('/')) {
    throw new Error(`API path must start with "/": ${path}`);
  }
  /*
   * Reject protocol-relative paths ("//host/x") and backslashes.
   *
   * Concatenating onto API_URL would in fact keep "//host/x" on the API
   * origin as a path, so this is hardening rather than a fix for a live hole.
   * But protocol-relative forms are a well-known source of origin confusion —
   * they become genuinely dangerous the moment such a value reaches a redirect
   * or a different base — and there is no legitimate API path shaped this way.
   */
  if (path.startsWith('//') || path.includes('\\')) {
    throw new Error(`API path must start with "/" and be origin-relative: ${path}`);
  }
  return `${base}${path}`;
}

export async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const errorBody = body as ApiErrorBody;
    throw new ApiError(
      response.status,
      errorBody.error?.code ?? 'UNKNOWN',
      errorBody.error?.message ?? 'Request failed.',
      errorBody.error?.requestId,
      errorBody.error?.details,
    );
  }
  return body as T;
}

/**
 * Statuses that mean "you cannot see this", as opposed to "something broke".
 *
 * 404 belongs here: under Row-Level Security a resource owned by another
 * organization is genuinely invisible, so the API answers 404 rather than 403.
 * A page that treated only 401/403 as unavailable would turn an ordinary
 * cross-tenant navigation into an unhandled 500.
 */
const UNAVAILABLE_STATUSES: ReadonlySet<number> = new Set([401, 403, 404]);

export function isUnavailable(error: unknown): boolean {
  return error instanceof ApiError && UNAVAILABLE_STATUSES.has(error.status);
}
