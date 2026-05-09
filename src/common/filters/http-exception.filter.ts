import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
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
