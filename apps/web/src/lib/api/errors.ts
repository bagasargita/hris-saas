import type { ApiErrorBody, ErrorCode, ValidationIssue } from '@saas/contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly details: ValidationIssue[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const issue of this.details) {
      const first = issue.messages[0];
      if (first) result[issue.field] = first;
    }
    return result;
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== 'object' || !('error' in value)) return false;
  const { error } = value;
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

export function toApiError(status: number, body: unknown): ApiError {
  if (isApiErrorBody(body)) {
    const { code, message, details, requestId } = body.error;
    return new ApiError(status, code, message, details ?? [], requestId);
  }
  return new ApiError(
    status,
    status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
    'Respons tidak terduga dari server',
  );
}

/** Human-friendly message for toasts; never exposes stack traces or raw server output. */
export function errorMessage(
  error: unknown,
  fallback = 'Terjadi kesalahan. Silakan coba lagi.',
): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR')
      return 'Tidak dapat terhubung ke server. Periksa koneksi Anda dan coba lagi.';
    if (error.code === 'RATE_LIMITED')
      return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
    if (error.status >= 500) return fallback;
    return error.message;
  }
  return fallback;
}
