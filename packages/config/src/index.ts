import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { ConfigurationError } from '@moka/core';
import {
  envSchemaChecked,
  findLeakyPublicVars,
  findProductionViolations,
  type Env,
} from './env.js';

export { envSchema, findLeakyPublicVars, findProductionViolations } from './env.js';
export type { Env } from './env.js';

let cached: Env | null = null;

/**
 * The nearest `.env`, searching upward from the working directory.
 *
 * dotenv's default is `process.cwd()/.env`, which is wrong in a workspace:
 * Turborepo runs each package's task with that package as the cwd, so
 * `turbo run dev` started the API in `apps/api`, found no `.env` there, and
 * refused to boot with DATABASE_URL, ENCRYPTION_KEY and AUTH_SECRET all
 * "Required" — while a correctly filled `.env` sat at the repository root.
 * The quick start in the README could not have worked.
 *
 * Walking up finds that one file from any package. Returns undefined when
 * there is none, which is the normal case in production: the platform sets
 * real environment variables and there is no file to read.
 */
function findEnvFile(from: string = process.cwd()): string | undefined {
  let dir = from;
  for (;;) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export interface LoadConfigOptions {
  /** Defaults to process.env. Injectable for tests. */
  source?: Record<string, string | undefined>;
  /** Load a .env file first. Disabled in tests. */
  dotenv?: boolean;
  /** Bypass the module-level cache. */
  fresh?: boolean;
}

/**
 * Load and validate configuration. Throws ConfigurationError listing every
 * problem at once, rather than failing one variable at a time.
 */
export function loadConfig(options: LoadConfigOptions = {}): Env {
  if (cached && !options.fresh && !options.source) return cached;

  if (options.dotenv !== false && !options.source) {
    const envFile = findEnvFile();
    loadDotenv(envFile ? { path: envFile } : undefined);
  }

  const source = options.source ?? (process.env as Record<string, string | undefined>);

  const leaky = findLeakyPublicVars(source);
  if (leaky.length > 0) {
    throw new ConfigurationError(
      `Refusing to start: these NEXT_PUBLIC_ variables look like secrets and would be ` +
        `inlined into the browser bundle: ${leaky.join(', ')}`,
    );
  }

  const parsed = envSchemaChecked.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new ConfigurationError(
      `Invalid environment configuration:\n${lines.join('\n')}\n\n` +
        `See .env.example for the full list of variables.`,
    );
  }

  const violations = findProductionViolations(parsed.data);
  if (violations.length > 0) {
    throw new ConfigurationError(
      `Refusing to start in production:\n${violations.map((v) => `  - ${v}`).join('\n')}`,
    );
  }

  if (!options.source) cached = parsed.data;
  return parsed.data;
}

/** Test helper. Not used at runtime. */
export function resetConfigCache(): void {
  cached = null;
}
