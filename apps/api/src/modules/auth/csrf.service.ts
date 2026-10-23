import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { generateToken, hmacSha256, safeEqual } from '../../common/security/crypto';

const ANONYMOUS_BINDING = 'anonymous';

/**
 * Signed double-submit CSRF tokens (OWASP "signed double-submit cookie").
 *
 * token = nonce "." HMAC(secret, binding "." nonce), where binding is the session id (or a fixed
 * value before login). The browser echoes the cookie value in the X-CSRF-Token header. The signature
 * prevents an attacker who can plant cookies (e.g. from a sibling subdomain) from forging a token
 * valid for the victim's session.
 */
@Injectable()
export class CsrfService {
  constructor(private readonly config: AppConfig) {}

  issue(sessionId: string | null): string {
    const nonce = generateToken(18);
    return `${nonce}.${this.sign(sessionId, nonce)}`;
  }

  verify(token: string, sessionId: string | null): boolean {
    const [nonce, signature, ...rest] = token.split('.');
    if (!nonce || !signature || rest.length > 0) return false;
    return safeEqual(signature, this.sign(sessionId, nonce));
  }

  private sign(sessionId: string | null, nonce: string): string {
    return hmacSha256(this.config.env.csrfSecret, `${sessionId ?? ANONYMOUS_BINDING}.${nonce}`);
  }
}
