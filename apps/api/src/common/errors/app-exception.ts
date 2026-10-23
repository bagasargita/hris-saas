import { HttpException, HttpStatus } from '@nestjs/common';
import { type ErrorCode, type ValidationIssue } from '@saas/contracts';

/** Domain-level error with a stable machine-readable code. Rendered by AllExceptionsFilter. */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details?: ValidationIssue[],
  ) {
    super(message, status);
  }

  static badRequest(message: string, code: ErrorCode = 'BAD_REQUEST'): AppException {
    return new AppException(code, message, HttpStatus.BAD_REQUEST);
  }

  static unauthenticated(message = 'Authentication required'): AppException {
    return new AppException('UNAUTHENTICATED', message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(
    message = 'You do not have permission to perform this action',
    code: ErrorCode = 'FORBIDDEN',
  ): AppException {
    return new AppException(code, message, HttpStatus.FORBIDDEN);
  }

  static notFound(message = 'Resource not found'): AppException {
    return new AppException('NOT_FOUND', message, HttpStatus.NOT_FOUND);
  }

  static conflict(message: string): AppException {
    return new AppException('CONFLICT', message, HttpStatus.CONFLICT);
  }

  static invalidToken(message = 'This link is invalid or has expired'): AppException {
    return new AppException('INVALID_TOKEN', message, HttpStatus.BAD_REQUEST);
  }
}
