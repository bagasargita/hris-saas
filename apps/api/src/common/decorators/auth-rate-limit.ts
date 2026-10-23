import { SetMetadata } from '@nestjs/common';

export const AUTH_RATE_LIMIT_KEY = 'throttle:auth';

/** Applies the stricter `auth` throttler (THROTTLE_AUTH_LIMIT per IP per window) to a route. */
export const AuthRateLimit = () => SetMetadata(AUTH_RATE_LIMIT_KEY, true);
