/**
 * Reference data only: roles, permissions, and the plan catalogue.
 *
 * WHY THIS EXISTS SEPARATELY FROM seed.ts.
 *
 * `seed.ts` does two unrelated jobs. It mirrors the code-defined roles,
 * permissions and plans into the database — which EVERY deployment needs,
 * because `organization_members.role_key` is a foreign key into `roles` — and
 * it also creates two demo organizations whose owners share a password printed
 * in the repository.
 *
 * Those cannot both run against production. The demo fixtures must not (the
 * password is public), and `seed.ts` refuses outright when NODE_ENV is
 * production. But skipping the seed entirely leaves `roles` empty, and then
 * the very first sign-up fails deep in the stack with
 *
 *   insert or update on table "organization_members" violates foreign key
 *   constraint "organization_members_role_key_fkey"
 *
 * which reads as a bug in registration rather than as missing reference data.
 * A fresh deployment could not create its first account.
 *
 * So this script runs the half that is not a fixture, and is safe in
 * production. Idempotent, like the seed it borrows from.
 */
import { config as loadDotenv } from 'dotenv';
import pg from 'pg';
import { seedPlans, seedRolesAndPermissions } from './seed.js';
import { tlsOptions } from './tls.js';

loadDotenv();

async function main(): Promise<void> {
  const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_MIGRATION_URL (or DATABASE_URL) is not set.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url, ...(await tlsOptions(url)) });
  await client.connect();

  try {
    console.warn('Seeding reference data…');
    await seedRolesAndPermissions(client);
    await seedPlans(client);
    console.warn('');
    console.warn('Reference data seeded. No tenant fixtures were created.');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
