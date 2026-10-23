import { type Server } from 'node:http';
import request, { type Response } from 'supertest';
import type TestAgent from 'supertest/lib/agent';

/**
 * Browser-like client: keeps cookies, sends the Origin header and echoes the CSRF cookie in
 * X-CSRF-Token for state-changing requests, exactly like the web app's Axios client.
 */
export class TestClient {
  private readonly agent: TestAgent;
  private csrfToken: string | null = null;

  constructor(
    server: Server,
    private readonly origin: string,
  ) {
    this.agent = request.agent(server);
  }

  get(path: string, headers: Record<string, string> = {}): Promise<Response> {
    let req = this.agent.get(path).set('Origin', this.origin);
    for (const [key, value] of Object.entries(headers)) req = req.set(key, value);
    return req.then((res) => this.capture(res));
  }

  post(path: string, body?: object): Promise<Response> {
    return this.unsafe('post', path, body);
  }

  put(path: string, body?: object): Promise<Response> {
    return this.unsafe('put', path, body);
  }

  patch(path: string, body?: object): Promise<Response> {
    return this.unsafe('patch', path, body);
  }

  delete(path: string): Promise<Response> {
    return this.unsafe('delete', path);
  }

  /** Sends a state-changing request without any CSRF header, to test the guard. */
  rawPost(path: string, body: object, headers: Record<string, string> = {}): Promise<Response> {
    let req = this.agent.post(path).send(body);
    for (const [key, value] of Object.entries(headers)) req = req.set(key, value);
    return req;
  }

  async refreshCsrf(): Promise<string> {
    const res = await this.agent.get('/api/v1/auth/csrf');
    const token = (res.body as { csrfToken?: string }).csrfToken;
    if (!token) throw new Error('no csrf token issued');
    this.csrfToken = token;
    return token;
  }

  get currentCsrfToken(): string | null {
    return this.csrfToken;
  }

  private async unsafe(
    method: 'post' | 'put' | 'patch' | 'delete',
    path: string,
    body?: object,
  ): Promise<Response> {
    const token = this.csrfToken ?? (await this.refreshCsrf());
    let req = this.agent[method](path).set('Origin', this.origin).set('X-CSRF-Token', token);
    if (body !== undefined) req = req.send(body);
    return this.capture(await req);
  }

  /** Mirrors the browser reading the rotated CSRF cookie after login/logout. */
  private capture(res: Response): Response {
    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
    const csrf = setCookie?.find((c) => c.startsWith('csrf='));
    if (csrf) this.csrfToken = decodeURIComponent(csrf.split(';')[0]?.slice('csrf='.length) ?? '');
    return res;
  }
}
