import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { type ApiErrorBody, type ErrorCode } from '@saas/contracts';
import { type Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { AppException } from '../errors/app-exception';
import { type AppRequest } from '../http/request-context';

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  501: 'NOT_IMPLEMENTED',
};

/** Renders every error as ApiErrorBody. Unknown errors are logged with stack and returned as a generic 500. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<AppRequest>();
    const requestId = typeof req.id === 'string' ? req.id : undefined;

    const body = this.toBody(exception);
    if (requestId) body.error.requestId = requestId;

    if (body.error.statusCode >= 500) {
      this.logger.error(
        { err: exception instanceof Error ? exception : new Error(String(exception)), requestId },
        'Unhandled error',
      );
    }
    if (!res.headersSent) {
      res.status(body.error.statusCode).json(body);
    }
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof AppException) {
      return this.body(exception.getStatus(), exception.code, exception.message, exception.details);
    }
    if (exception instanceof ThrottlerException) {
      return this.body(
        HttpStatus.TOO_MANY_REQUESTS,
        'RATE_LIMITED',
        'Too many requests. Please try again later.',
      );
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
      const message = status >= 500 ? 'Internal server error' : this.httpMessage(exception);
      return this.body(status, code, message);
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return this.body(
          HttpStatus.CONFLICT,
          'CONFLICT',
          'A resource with these values already exists',
        );
      }
      if (exception.code === 'P2025') {
        return this.body(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Resource not found');
      }
      if (exception.code === 'P2034') {
        return this.body(
          HttpStatus.CONFLICT,
          'CONFLICT',
          'The resource was modified concurrently. Please retry.',
        );
      }
    }
    return this.body(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Internal server error');
  }

  private httpMessage(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object' && 'message' in response) {
      const { message } = response;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.filter((m) => typeof m === 'string').join('; ');
    }
    return exception.message;
  }

  private body(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: ApiErrorBody['error']['details'],
  ): ApiErrorBody {
    return { error: { code, message, statusCode, ...(details ? { details } : {}) } };
  }
}
