import { HttpStatus, ValidationPipe, type ValidationError } from '@nestjs/common';
import { type ValidationIssue } from '@saas/contracts';
import { AppException } from '../errors/app-exception';

function flatten(errors: ValidationError[], parent = ''): ValidationIssue[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, messages: Object.values(error.constraints) }] : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/**
 * whitelist + forbidNonWhitelisted reject unknown properties outright, which prevents mass
 * assignment of fields such as `platformRole`, `tenantId` or `status` through request bodies.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: false,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) =>
      new AppException(
        'VALIDATION_ERROR',
        'Request validation failed',
        HttpStatus.BAD_REQUEST,
        flatten(errors),
      ),
  });
}
