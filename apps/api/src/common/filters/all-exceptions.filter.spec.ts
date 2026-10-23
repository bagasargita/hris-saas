import {
  type ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '../../generated/prisma/client';
import { AppException } from '../errors/app-exception';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, headersSent: false }),
      getRequest: () => ({ id: 'req-123' }),
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { statusCode: status.mock.calls[0]?.[0] as number, body: json.mock.calls[0]?.[0] };
}

describe('AllExceptionsFilter', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('renders AppException with its code, details and the request id', () => {
    const { statusCode, body } = run(
      new AppException('VALIDATION_ERROR', 'Request validation failed', HttpStatus.BAD_REQUEST, [
        { field: 'email', messages: ['email must be an email'] },
      ]),
    );
    expect(statusCode).toBe(400);
    expect(body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        statusCode: 400,
        requestId: 'req-123',
        details: [{ field: 'email', messages: ['email must be an email'] }],
      },
    });
  });

  it('maps framework HttpExceptions to stable codes', () => {
    expect(run(new NotFoundException()).body.error.code).toBe('NOT_FOUND');
    expect(run(new BadRequestException('bad')).body.error).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'bad',
    });
  });

  it('maps throttling to 429 RATE_LIMITED', () => {
    expect(run(new ThrottlerException())).toMatchObject({
      statusCode: 429,
      body: { error: { code: 'RATE_LIMITED' } },
    });
  });

  it('maps Prisma unique violations to 409 without leaking constraint details', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      {
        code: 'P2002',
        clientVersion: 'test',
      },
    );
    const { statusCode, body } = run(error);
    expect(statusCode).toBe(409);
    expect(JSON.stringify(body)).not.toContain('email');
  });

  it('hides unexpected error details behind a generic 500', () => {
    const { statusCode, body } = run(new Error('connection string postgres://secret@db'));
    expect(statusCode).toBe(500);
    expect(body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      statusCode: 500,
      requestId: 'req-123',
    });
  });
});
