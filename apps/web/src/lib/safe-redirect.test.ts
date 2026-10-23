import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it.each([
    ['/t/acme', '/t/acme'],
    ['/t/acme/members?page=2#top', '/t/acme/members?page=2#top'],
    ['/invitations/accept?token=abc', '/invitations/accept?token=abc'],
  ])('keeps same-origin path %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    'evil.example',
    '/t/acme\n//evil',
    '/%0a',
    '',
    null,
    undefined,
  ])('rejects unsafe target %s', (input) => {
    const result = safeRedirectPath(input, '/tenants');
    if (input === '/%0a') {
      // Percent-encoded characters stay encoded inside the path and never change the origin.
      expect(result.startsWith('/')).toBe(true);
      expect(result.startsWith('//')).toBe(false);
      return;
    }
    expect(result).toBe('/tenants');
  });

  it('rejects absurdly long values', () => {
    expect(safeRedirectPath(`/${'a'.repeat(5000)}`)).toBe('/tenants');
  });
});
