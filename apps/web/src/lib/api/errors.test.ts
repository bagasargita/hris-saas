import { describe, expect, it } from 'vitest';
import { ApiError, errorMessage, toApiError } from './errors';

describe('toApiError', () => {
  it('maps the standard error envelope including field details', () => {
    const error = toApiError(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid',
        statusCode: 400,
        details: [{ field: 'email', messages: ['email must be an email'] }],
      },
    });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.fieldErrors()).toEqual({ email: 'email must be an email' });
  });

  it('never surfaces raw bodies of unexpected responses', () => {
    const error = toApiError(502, '<html>Bad gateway</html>');
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).not.toContain('html');
  });
});

describe('errorMessage', () => {
  it('hides server error details behind a generic message', () => {
    expect(errorMessage(new ApiError(500, 'INTERNAL_ERROR', 'stack trace here'))).toBe(
      'Terjadi kesalahan. Silakan coba lagi.',
    );
  });

  it('shows client error messages from the API', () => {
    expect(errorMessage(new ApiError(409, 'CONFLICT', 'This workspace URL is already taken'))).toBe(
      'This workspace URL is already taken',
    );
  });

  it('explains network and rate limit failures', () => {
    expect(errorMessage(new ApiError(0, 'NETWORK_ERROR', 'x'))).toMatch(/terhubung ke server/);
    expect(errorMessage(new ApiError(429, 'RATE_LIMITED', 'x'))).toMatch(/Terlalu banyak/);
  });
});
