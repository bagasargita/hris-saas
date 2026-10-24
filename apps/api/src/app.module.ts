import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AUTH_RATE_LIMIT_KEY } from './common/decorators/auth-rate-limit';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CsrfGuard } from './common/guards/csrf.guard';
import { SessionAuthGuard } from './common/guards/session-auth.guard';
import { NoStoreInterceptor } from './common/interceptors/no-store.interceptor';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { AppConfig, AppConfigModule } from './config/app-config';
import { PrismaModule } from './database/prisma.service';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { HealthModule } from './modules/health/health.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { MailModule } from './modules/mail/mail.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { PlatformModule } from './modules/platform/platform.module';
import { RolesModule } from './modules/roles/roles.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.isTest ? 'silent' : config.env.logLevel,
          genReqId: (req, res) => {
            const incoming = req.headers['x-request-id'];
            const id =
              typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
                ? incoming
                : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: {
            paths: [
              'req.headers.cookie',
              'req.headers.authorization',
              'req.headers["x-csrf-token"]',
              'res.headers["set-cookie"]',
              '*.password',
              '*.currentPassword',
              '*.newPassword',
              '*.token',
            ],
            censor: '[REDACTED]',
          },
          autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
          ...(config.env.nodeEnv === 'development'
            ? {
                transport: {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                },
              }
            : {}),
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.env.throttle.ttlMs,
            limit: config.env.throttle.defaultLimit,
          },
          {
            name: 'auth',
            ttl: config.env.throttle.ttlMs,
            limit: config.env.throttle.authLimit,
            skipIf: (context) =>
              Reflect.getMetadata(AUTH_RATE_LIMIT_KEY, context.getHandler()) !== true,
          },
        ],
      }),
    }),
    PrismaModule,
    MailModule,
    AuditLogsModule,
    PermissionsModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    MembershipsModule,
    RolesModule,
    InvitationsModule,
    AttendanceModule,
    BillingModule,
    PlatformModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: NoStoreInterceptor },
    // Order matters: rate limit first, then authenticate, then verify CSRF bound to the session.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
