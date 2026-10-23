export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  FORBIDDEN: 'FORBIDDEN',
  CSRF_INVALID: 'CSRF_INVALID',
  TENANT_ACCESS_DENIED: 'TENANT_ACCESS_DENIED',
  PRIVILEGE_ESCALATION: 'PRIVILEGE_ESCALATION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_TOKEN: 'INVALID_TOKEN',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ValidationIssue {
  field: string;
  messages: string[];
}

/** Body of every non-2xx response produced by the API. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    statusCode: number;
    requestId?: string;
    details?: ValidationIssue[];
  };
}
