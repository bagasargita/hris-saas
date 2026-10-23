import { Global, Injectable, Module } from '@nestjs/common';
import { type AppEnv, loadEnv } from './env';

/** Typed, validated configuration. Injected instead of reading process.env across the codebase. */
@Injectable()
export class AppConfig {
  readonly env: AppEnv;

  constructor() {
    this.env = loadEnv();
  }

  get isProduction(): boolean {
    return this.env.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.env.nodeEnv === 'test';
  }

  /**
   * `__Host-` cookies are bound to the exact origin (Secure, Path=/, no Domain), which blocks
   * cookie injection from sibling subdomains. Falls back to `__Secure-` when a Domain is required.
   */
  cookieName(base: 'sid' | 'csrf'): string {
    if (!this.env.cookie.secure) return base;
    return this.env.cookie.domain ? `__Secure-${base}` : `__Host-${base}`;
  }
}

@Global()
@Module({
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
