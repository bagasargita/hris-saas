# Authentication

## Sessions

- Opaque, server-side sessions. On login the API generates 32 random bytes, sets them in an `HttpOnly`
  cookie and stores only the SHA-256 hash. A database leak does not reveal usable session tokens.
- Cookie: `__Host-sid` in production (`Secure`, `Path=/`, no `Domain`), `__Secure-sid` when `COOKIE_DOMAIN` is
  set, `sid` in local HTTP development. Always `HttpOnly; SameSite=Lax`.
- Expiry: idle TTL (`SESSION_IDLE_TTL_HOURS`, default 7 days, sliding, refreshed at most every 5 minutes) and an
  absolute TTL (`SESSION_ABSOLUTE_TTL_DAYS`, default 30 days) that is never extended.
- Every request re-reads the session **and the user's status**: suspending a user, resetting a password,
  logging out or revoking a session takes effect on the next request.
- Logging in rotates the session (an existing session cookie is revoked) to prevent session fixation.
- Users can list their sessions and revoke any of them (`/account/security`).

## CSRF

Signed double-submit token (OWASP):

- `GET /api/v1/auth/csrf` issues `token = nonce "." HMAC-SHA256(CSRF_SECRET, sessionId|"anonymous" "." nonce)`
  and sets it in a readable `csrf` cookie (`__Host-csrf` in production).
- The browser echoes it in `X-CSRF-Token` on every `POST/PUT/PATCH/DELETE`. The guard requires header ==
  cookie **and** a valid signature bound to the current session, so a token issued before login is useless
  after login, and an attacker who can plant cookies cannot forge one.
- If an `Origin` (or `Referer`) header is present it must be in `CORS_ORIGINS`.
- Login and logout rotate the token.
- The web client retries a request **once** after `CSRF_INVALID`, with a fresh token. This is safe for
  non-idempotent requests because the CSRF guard rejects before any handler runs. No other failures are
  retried for mutations.

## Passwords

- Argon2id (`m=19456 KiB, t=2, p=1`, the OWASP baseline). Hashes are upgraded on login when parameters change.
- Length 10–128. No composition rules (NIST 800-63B).
- Unknown emails run a dummy verification so response time does not reveal whether an account exists.

## Flows

| Flow                | Endpoint(s)                                  | Anti-enumeration                                                                                                                                    |
| ------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register            | `POST /auth/register` → 202                  | Same response for new and existing emails; existing accounts get an "account exists" email instead.                                                 |
| Verify email        | `POST /auth/verify-email {token}`            | Token is single-use, 24 h, hashed at rest. The web page requires a click (POST) so mail scanners cannot consume it.                                 |
| Resend verification | `POST /auth/resend-verification` → 202       | Always 202.                                                                                                                                         |
| Login               | `POST /auth/login`                           | Unknown email and wrong password return the same `401 INVALID_CREDENTIALS`. Unverified/suspended state is only revealed after the correct password. |
| Logout              | `POST /auth/logout` → 204                    | Revokes the session server-side and clears cookies.                                                                                                 |
| Forgot password     | `POST /auth/forgot-password` → 202           | Always 202; no email is sent for unknown accounts.                                                                                                  |
| Reset password      | `POST /auth/reset-password {token,password}` | Token single-use, 1 h. Revokes **all** sessions and marks the email verified.                                                                       |
| Change password     | `POST /users/me/password`                    | Requires the current password; revokes all other sessions.                                                                                          |
| Current user        | `GET /auth/me`                               | Returns the user, memberships and active tenant.                                                                                                    |
| Switch tenant       | `POST /auth/active-tenant {tenantId}`        | Membership verified before it is stored on the session.                                                                                             |

Tokens always travel in request bodies, never in API URLs, so they do not end up in access logs. Pages that
receive tokens in their URL set `Referrer-Policy: no-referrer`.

## Rate limiting

- `default` throttler for all routes (`THROTTLE_DEFAULT_LIMIT` per `THROTTLE_TTL_SECONDS`).
- `auth` throttler (`THROTTLE_AUTH_LIMIT`, default 10/min per IP) on login, register, password reset,
  verification and invitation token endpoints.
- `TRUST_PROXY` must match the real proxy topology or every client will share one IP bucket (or spoof it).

## Logging

Pino with request ids (`X-Request-Id` is honoured when it is a safe value and echoed back). Cookies,
`Authorization`, `X-CSRF-Token`, `Set-Cookie`, passwords and tokens are redacted.
