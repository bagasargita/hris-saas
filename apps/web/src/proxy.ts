import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIES = ['__Host-sid', '__Secure-sid', 'sid'];

/**
 * Optimistic check only: redirects visitors without any session cookie away from app pages.
 * It does not validate the session. Every page and API call is authorized by the API itself.
 */
export function proxy(request: NextRequest) {
  const hasSessionCookie = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSessionCookie) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const login = new URL('/login', request.url);
  login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/tenants/:path*', '/t/:path*', '/account/:path*', '/admin/:path*'],
};
