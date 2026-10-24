import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Server-side address of the NestJS API. Never exposed to the browser: the browser always calls
 * same-origin `/api/v1/*`, which is rewritten here. This keeps cookies first-party and avoids CORS.
 */
const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; a nonce-based CSP is documented as a hardening step.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // OSM tiles + Leaflet default marker assets (CDN).
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com",
  "font-src 'self' data:",
  // Nominatim place search / reverse geocode (browser fetch).
  `connect-src 'self' https://nominatim.openstreetmap.org${isDev ? ' ws: wss:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Geolocation is required for attendance clock-in/out (same-origin only).
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
  ...(isDev
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@saas/contracts'],
  rewrites: () =>
    Promise.resolve([{ source: '/api/v1/:path*', destination: `${apiInternalUrl}/api/v1/:path*` }]),
  headers: () => Promise.resolve([{ source: '/:path*', headers: securityHeaders }]),
};

export default nextConfig;
