import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const method = req.method;
    const path = req.path ?? req.url ?? req.originalUrl ?? '';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = ctx.getResponse<Response>();
          const duration = Date.now() - start;
          const status = res.statusCode;
          console.log(`${method} ${path} ${status} ${duration}ms`);
        },
        error: () => {
          const duration = Date.now() - start;
          console.log(`${method} ${path} error ${duration}ms`);
        },
      }),
    );
  }
}
