import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const body =
      typeof exceptionResponse === 'object'
        ? (exceptionResponse as Record<string, unknown>)
        : { message: exceptionResponse };

    const payload: Record<string, unknown> = {
      statusCode: status,
      message: (body.message as string) ?? exception.message,
      timestamp: new Date().toISOString(),
    };
    if (body.errors !== undefined) {
      payload.errors = body.errors;
    }

    this.logger.warn(
      `${req.method} ${req.path} ${status} - ${JSON.stringify(body)}`,
    );
    res.status(status).json(payload);
  }
}
