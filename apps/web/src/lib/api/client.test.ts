import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, readCsrfCookie } from './client';
import { ApiError } from './errors';

function response(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  return { data, status, statusText: String(status), headers: {}, config, request: {} };
}

function rejectWith(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  return Promise.reject(
    new AxiosError(
      `HTTP ${status}`,
      'ERR_BAD_RESPONSE',
      config,
      {},
      response(config, status, data),
    ),
  );
}

describe('readCsrfCookie', () => {
  it('prefers the __Host- prefixed cookie and decodes it', () => {
    expect(readCsrfCookie('csrf=plain; __Host-csrf=a%2Eb')).toBe('a.b');
  });

  it('falls back to the development cookie name', () => {
    expect(readCsrfCookie('theme=dark; csrf=token-1')).toBe('token-1');
  });

  it('returns null when no csrf cookie exists', () => {
    expect(readCsrfCookie('sid=secret')).toBeNull();
  });
});

describe('api client', () => {
  const calls: InternalAxiosRequestConfig[] = [];
  let originalAdapter: typeof api.defaults.adapter;

  beforeEach(() => {
    calls.length = 0;
    originalAdapter = api.defaults.adapter;
    document.cookie = 'csrf=cookie-token';
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    document.cookie = 'csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('sends the CSRF cookie value as X-CSRF-Token on unsafe requests only', async () => {
    const adapter: AxiosAdapter = (config) => {
      calls.push(config);
      return Promise.resolve(response(config, 200, { ok: true }));
    };
    api.defaults.adapter = adapter;

    await api.get('/things');
    await api.post('/things', { a: 1 });

    expect(AxiosHeaders.from(calls[0]?.headers).get('X-CSRF-Token')).toBeUndefined();
    expect(AxiosHeaders.from(calls[1]?.headers).get('X-CSRF-Token')).toBe('cookie-token');
  });

  it('normalises API error bodies into ApiError', async () => {
    api.defaults.adapter = (config) =>
      rejectWith(config, 403, {
        error: {
          code: 'TENANT_ACCESS_DENIED',
          message: 'No access',
          statusCode: 403,
          requestId: 'r1',
        },
      });

    const error = await api.get('/tenants/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: 'TENANT_ACCESS_DENIED', requestId: 'r1' });
  });

  it('retries exactly once after a CSRF rejection, with a fresh token', async () => {
    const fetchCsrf = vi
      .spyOn(axios, 'get')
      .mockResolvedValue({ data: { csrfToken: 'fresh-token' } });
    let attempts = 0;
    api.defaults.adapter = (config) => {
      attempts += 1;
      calls.push(config);
      if (attempts === 1)
        return rejectWith(config, 403, {
          error: { code: 'CSRF_INVALID', message: 'Invalid', statusCode: 403 },
        });
      return Promise.resolve(response(config, 200, { ok: true }));
    };

    const res = await api.post('/auth/logout');
    expect(res.status).toBe(200);
    expect(attempts).toBe(2);
    expect(AxiosHeaders.from(calls[1]?.headers).get('X-CSRF-Token')).toBe('fresh-token');
    fetchCsrf.mockRestore();
  });

  it('does not retry other failures of non-idempotent requests', async () => {
    let attempts = 0;
    api.defaults.adapter = (config) => {
      attempts += 1;
      return rejectWith(config, 500, {
        error: { code: 'INTERNAL_ERROR', message: 'Boom', statusCode: 500 },
      });
    };
    await expect(api.post('/tenants', { name: 'x' })).rejects.toBeInstanceOf(ApiError);
    expect(attempts).toBe(1);
  });

  it('gives up after one CSRF retry', async () => {
    const fetchCsrf = vi
      .spyOn(axios, 'get')
      .mockResolvedValue({ data: { csrfToken: 'fresh-token' } });
    let attempts = 0;
    api.defaults.adapter = (config) => {
      attempts += 1;
      return rejectWith(config, 403, {
        error: { code: 'CSRF_INVALID', message: 'Invalid', statusCode: 403 },
      });
    };
    await expect(api.post('/auth/logout')).rejects.toMatchObject({ code: 'CSRF_INVALID' });
    expect(attempts).toBe(2);
    fetchCsrf.mockRestore();
  });
});
