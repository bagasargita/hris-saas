import 'server-only';
import { redirect } from 'next/navigation';
import type { MeResponse } from '@saas/contracts';
import { getCurrentUser } from './api/server';

/** Server-side guard for app pages. Redirects to login when the API does not recognise the session. */
export async function requireUser(returnTo: string): Promise<MeResponse> {
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return me;
}
