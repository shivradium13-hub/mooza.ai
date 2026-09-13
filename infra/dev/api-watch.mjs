#!/usr/bin/env node
/**
 * Development watcher for apps/api.
 *
 * WHY THIS EXISTS RATHER THAN `tsx watch src/main.ts`.
 *
 * NestJS resolves a constructor's dependencies from the type metadata that
 * TypeScript's `emitDecoratorMetadata` writes into the output. tsx compiles
 * with esbuild, which does not implement that option, so every injected class
 * arrived as `undefined` and the API died on boot:
 *
 *   Nest can't resolve dependencies of the AuthController (?, +, Symbol(RATE_LIMITER)).
 *
 * It looked like a missing provider. It was a missing compiler feature — and
 * it meant the README's `pnpm dev` could never start the API, while
 * `pnpm build` (plain `tsc`, which does emit the metadata) was always fine.
 *
 * So this runs the real compiler in watch mode and restarts the process on
 * each successful emit. Two processes rather than one, no new dependency, and
 * the same `tsc` that produces the production build.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const apiDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'apps',
  'api',
);

/** `shell: true` so the platform resolves the .cmd shims pnpm writes on Windows. */
function run(command, args, name) {
  const child = spawn(command, args, { cwd: apiDir, stdio: 'inherit', shell: true });
  child.on('exit', (code, signal) => {
    if (signal) return;
    console.error(`[api-watch] ${name} exited with code ${code}`);
    process.exit(code ?? 1);
  });
  return child;
}

const children = [
  // --preserveWatchOutput keeps the log readable: tsc otherwise clears the
  // screen on every rebuild, taking the server's own output with it.
  run('tsc', ['-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], 'tsc --watch'),
  // node --watch restarts on emit. It tolerates dist/ not existing yet.
  run('node', ['--watch', 'dist/main.js'], 'node --watch'),
];

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of children) child.kill(signal);
    process.exit(0);
  });
}
