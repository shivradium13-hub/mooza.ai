import { Global, Logger, Module } from '@nestjs/common';
import { loadConfig } from '@moka/config';
import { AuditService } from './audit.service.js';
import { DisabledRateLimiter, InMemoryRateLimiter, RATE_LIMITER } from './rate-limit.js';

/**
 * Cross-cutting services used by every feature module.
 *
 * Global because auditing must be available everywhere without each module
 * re-importing it — an audit call that is inconvenient to reach is an audit
 * call that gets omitted.
 */
@Global()
@Module({
  providers: [
    AuditService,
    {
      provide: RATE_LIMITER,
      useFactory: (): InMemoryRateLimiter | DisabledRateLimiter => {
        const config = loadConfig();
        if (!config.RATE_LIMIT_DISABLED) return new InMemoryRateLimiter();

        /*
         * Loud, and on every boot rather than once. A disabled limiter is
         * invisible in normal use — everything simply works — so the only
         * thing standing between "we turned it off for the demo" and a
         * production login endpoint with no brute-force protection is this
         * line being in the log where somebody reads it.
         */
        new Logger('RateLimit').warn(
          'RATE_LIMIT_DISABLED is set: every rate limit is off, including the ' +
            'login limits that blunt credential stuffing. Do not run this with real accounts.',
        );
        return new DisabledRateLimiter();
      },
    },
  ],
  exports: [AuditService, RATE_LIMITER],
})
export class CommonModule {}
