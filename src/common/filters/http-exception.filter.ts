import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const res: any = exception.getResponse();

    response.status(status).json({
      code: res.code ?? status,
      data: null,
      message: Array.isArray(res.message) ? res.message[0] : (res.message ?? exception.message),
      path: request.url,
    });
  }
}
