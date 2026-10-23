import { VersioningType } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppConfig } from './config/app-config';

/** HTTP-level configuration shared by main.ts and the integration test harness. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.env.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // JSON API: only Swagger UI renders HTML, and it is served from 'self'.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cookieParser());

  const allowed = new Set(config.env.allowedOrigins);
  app.enableCors({
    origin: (origin, callback) => callback(null, origin === undefined || allowed.has(origin)),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  if (config.env.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('SaaS Platform API')
        .setDescription(
          'Multi-tenant REST API. Authenticate via POST /api/v1/auth/login (session cookie). ' +
            'State-changing requests need the X-CSRF-Token header (GET /api/v1/auth/csrf).',
        )
        .setVersion('1.0')
        .addCookieAuth(config.cookieName('sid'))
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
  }
}
