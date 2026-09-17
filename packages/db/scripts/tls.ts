import { readFile } from 'node:fs/promises';
import tls from 'node:tls';
import type pg from 'pg';

/**
 * TLS for an administrative connection, matching what the application uses.
 *
 * The migration runner used to have none, which meant administering a managed
 * Postgres over a public endpoint happened either unverified or not at all —
 * while the application beside it verified the chain against a private CA.
 * These connections are the more privileged of the two; they should not be the
 * less protected ones.
 *
 * `DATABASE_SSL` turns it on. `DATABASE_CA_CERT` (a PEM) or
 * `DATABASE_CA_CERT_FILE` (a path to one) supplies the authority for a
 * certificate the system does not already trust, which is the normal case for
 * Railway, RDS and DigitalOcean. Verification stays FULL either way: the chain
 * is checked and the hostname must match. There is deliberately no switch here
 * for `rejectUnauthorized: false`.
 */
export async function tlsOptions(url: string): Promise<{ ssl?: pg.ClientConfig['ssl'] }> {
  if (!/^(1|true|yes)$/i.test(process.env.DATABASE_SSL ?? '')) return {};

  /*
   * An `sslmode` in the URL SILENTLY WINS over the object built here, CA and
   * all. The failure it produces — "self-signed certificate in certificate
   * chain", from a connection that was handed a perfectly good CA — sends you
   * looking at the certificate rather than at the query string. Refused with
   * the reason, because a baffling error an hour from now is worse than a
   * clear one immediately.
   */
  if (/[?&]sslmode=/i.test(url)) {
    throw new Error(
      'The connection string carries an sslmode parameter, which overrides the TLS ' +
        'settings this script applies — including the CA certificate, which would then be ' +
        'ignored. Remove sslmode from DATABASE_MIGRATION_URL and use DATABASE_SSL together ' +
        'with DATABASE_CA_CERT (or DATABASE_CA_CERT_FILE) instead.',
    );
  }

  const inline = process.env.DATABASE_CA_CERT?.trim();
  const file = process.env.DATABASE_CA_CERT_FILE?.trim();
  const ca = inline || (file ? await readFile(file, 'utf8') : undefined);

  /*
   * `DATABASE_TLS_SERVERNAME` — the name to verify the certificate AGAINST,
   * when it differs from the name being dialled.
   *
   * The case this exists for: a managed Postgres issues its certificate for
   * its internal name (`postgres-ssl.railway.internal`), and migrations are
   * run from a laptop through a public TCP proxy (`x.proxy.rlwy.net:39196`)
   * that forwards raw bytes to that same server. Verification then fails on
   * the hostname alone — correctly, because the two names really are
   * different — and the only options left are to say which name is expected
   * or to stop verifying at all.
   *
   * THIS IS NOT `rejectUnauthorized: false`. The chain is still checked
   * against the CA above, and the certificate must still carry this name; all
   * that changes is WHICH name is required. The connection still cannot be
   * answered by anything that is not holding a key the CA signed for it.
   */
  const servername = process.env.DATABASE_TLS_SERVERNAME?.trim();

  return {
    ssl: {
      rejectUnauthorized: true,
      ...(ca ? { ca } : {}),
      // `servername` alone only moves SNI: node-postgres passes the dialled
      // host to the identity check separately, so the check still fails on the
      // proxy's name. The name to verify has to be stated to the checker too.
      ...(servername
        ? {
            servername,
            checkServerIdentity: (_host: string, cert: tls.PeerCertificate) =>
              tls.checkServerIdentity(servername, cert),
          }
        : {}),
    },
  };
}
