import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Response } from 'express';
import { type Observable } from 'rxjs';

/** API responses are personalized; forbid shared caches (CDNs, proxies) from storing them. */
@Injectable()
export class NoStoreInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    return next.handle();
  }
}
