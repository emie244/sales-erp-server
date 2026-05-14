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
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const res = exception.getResponse() as Record<string, unknown>;

    response.status(status).json({
      code: res.code ?? status,
      data: null,
      message: Array.isArray(res.message)
        ? String((res.message as unknown[])[0])
        : String((res.message as string) ?? exception.message),
      path: request.url,
    });
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const message =
      exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(
      `Unhandled exception: ${message} | path=${request.method} ${request.url}`,
      stack,
    );

    response.status(500).json({
      code: 500,
      data: null,
      message:
        process.env.NODE_ENV === 'production' ? '服务器内部错误' : message,
      path: request.url,
    });
  }
}
