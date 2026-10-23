/**
 * Returns `next` only if it is a same-origin relative path; otherwise the fallback.
 * Blocks open redirects such as `//evil.com`, `/\evil.com`, `https://evil.com` and `javascript:`.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = '/tenants'): string {
  if (!next || typeof next !== 'string') return fallback;
  if (next.length > 2048) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  // Control characters and backslashes are normalised differently by browsers; reject them outright.
  for (const char of next) {
    if (char === '\\' || char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f) return fallback;
  }
  try {
    const base = 'http://local.invalid';
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
