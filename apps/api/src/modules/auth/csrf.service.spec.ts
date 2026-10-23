import { type AppConfig } from '../../config/app-config';
import { CsrfService } from './csrf.service';

function service(secret = 'test-secret-that-is-long-enough-123456'): CsrfService {
  const config = { env: { csrfSecret: secret } } as unknown as AppConfig;
  return new CsrfService(config);
}

describe('CsrfService', () => {
  it('verifies a token issued for the same session', () => {
    const csrf = service();
    const token = csrf.issue('session-a');
    expect(csrf.verify(token, 'session-a')).toBe(true);
  });

  it('rejects a token issued for another session', () => {
    const csrf = service();
    expect(csrf.verify(csrf.issue('session-a'), 'session-b')).toBe(false);
  });

  it('rejects an anonymous token once a session exists (forces rotation after login)', () => {
    const csrf = service();
    expect(csrf.verify(csrf.issue(null), 'session-a')).toBe(false);
  });

  it('rejects tokens signed with a different secret', () => {
    const token = service('another-secret-that-is-long-enough-000').issue(null);
    expect(service().verify(token, null)).toBe(false);
  });

  it.each(['', 'nodot', 'a.b.c', '.sig', 'nonce.'])('rejects malformed token %p', (token) => {
    expect(service().verify(token, null)).toBe(false);
  });

  it('issues a different token every time', () => {
    const csrf = service();
    expect(csrf.issue(null)).not.toEqual(csrf.issue(null));
  });
});
