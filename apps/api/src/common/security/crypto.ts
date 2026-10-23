import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256-bit URL-safe random token for sessions, email links and invitations. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * SHA-256 is appropriate for high-entropy random tokens (not passwords): it lets us look tokens up
 * by hash so a database leak does not expose usable session or reset tokens.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function hmacSha256(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
