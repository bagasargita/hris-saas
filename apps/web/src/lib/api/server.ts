import 'server-only';
import { cookies, headers } from 'next/headers';
import type { MeResponse, TenantContextResponse } from '@saas/contracts';
import { ApiError, toApiError } from './errors';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/**
 * Server Component fetch to the API, forwarding the user's cookies. Authorization is still decided
 * by the API on every call; this only lets the server render with the user's real permissions.
 */
export async function serverFetch<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const requestId = (await headers()).get('x-request-id');
  let res: Response;
  try {
    res = await fetch(`${API_INTERNAL_URL}/api/v1${path}`, {
      headers: {
        Accept: 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(requestId ? { 'X-Request-Id': requestId } : {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'API unreachable');
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

/** Current user or null when not signed in. Other failures propagate to the error boundary. */
export async function getCurrentUser(): Promise<MeResponse | null> {
  try {
    return await serverFetch<MeResponse>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Tenant context or null when the API denies access (non-member, suspended or unknown tenant). */
export async function getTenantContext(tenantId: string): Promise<TenantContextResponse | null> {
  try {
    return await serverFetch<TenantContextResponse>(`/tenants/${encodeURIComponent(tenantId)}/me`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null;
    throw error;
  }
}
