import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { CsrfResponse } from '@saas/contracts';
import { ApiError, toApiError } from './errors';

const CSRF_COOKIE_NAMES = ['__Host-csrf', '__Secure-csrf', 'csrf'] as const;
const SAFE_METHODS = new Set(['get', 'head', 'options']);

export function readCsrfCookie(
  cookieString: string = typeof document === 'undefined' ? '' : document.cookie,
): string | null {
  const cookies = new Map<string, string>();
  for (const part of cookieString.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    cookies.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  for (const name of CSRF_COOKIE_NAMES) {
    const value = cookies.get(name);
    if (value) return decodeURIComponent(value);
  }
  return null;
}

/** Browser client. Always same-origin (`/api/v1`, rewritten by Next.js), so the session cookie is first-party. */
export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 20_000,
  headers: { Accept: 'application/json' },
});

let csrfRequest: Promise<string> | null = null;

async function fetchCsrfToken(): Promise<string> {
  csrfRequest ??= axios
    .get<CsrfResponse>('/api/v1/auth/csrf', { withCredentials: true })
    .then((res) => res.data.csrfToken)
    .finally(() => {
      csrfRequest = null;
    });
  return csrfRequest;
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  _csrfRetried?: boolean;
}

api.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (!SAFE_METHODS.has(method) && !config.headers.has('X-CSRF-Token')) {
    const token = readCsrfCookie() ?? (await fetchCsrfToken());
    config.headers.set('X-CSRF-Token', token);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!(error instanceof AxiosError)) throw error;
    if (!error.response) {
      throw new ApiError(0, 'NETWORK_ERROR', 'Network error');
    }
    const apiError = toApiError(error.response.status, error.response.data);
    const config = error.config as RetryableConfig | undefined;

    // The CSRF guard runs before any handler, so a CSRF rejection guarantees nothing was executed.
    // That makes exactly one retry with a fresh token safe even for non-idempotent requests.
    if (apiError.code === 'CSRF_INVALID' && config && !config._csrfRetried) {
      config._csrfRetried = true;
      const token = await fetchCsrfToken();
      config.headers.set('X-CSRF-Token', token);
      return api.request(config);
    }
    throw apiError;
  },
);

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return (await api.get<T>(url, config)).data;
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return (await api.post<T>(url, body, config)).data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return (await api.patch<T>(url, body)).data;
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  return (await api.put<T>(url, body)).data;
}

export async function apiDelete(url: string): Promise<void> {
  await api.delete(url);
}
