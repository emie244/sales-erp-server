import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { OperationLogsService } from './operation-logs.service';

@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  constructor(private readonly logsService: OperationLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;
    const path = request.route?.path || request.url;
    const ip = request.ip;

    // 只记录修改类操作
    const readonlyMethods = ['GET', 'HEAD'];
    if (readonlyMethods.includes(method)) {
      return next.handle();
    }

    const action = `${method} ${path}`;
    const resource = this.extractResource(path);
    const resourceId = request.params?.id || null;
    const tenantId = user?.tenantId || null;

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logsService
            .create({
              userId: user?.userId || null,
              userName: user?.username || null,
              action,
              resource,
              resourceId,
              details: {
                body: this.sanitizeBody(request.body),
                durationMs: Date.now() - startTime,
              },
              ip,
              status: 'success',
              tenantId,
            })
            .catch(() => {}); // 日志记录失败不影响主流程
        },
        error: (err) => {
          this.logsService
            .create({
              userId: user?.userId || null,
              userName: user?.username || null,
              action,
              resource,
              resourceId,
              details: {
                body: this.sanitizeBody(request.body),
                durationMs: Date.now() - startTime,
              },
              ip,
              status: 'error',
              errorMessage: err.message || String(err),
              tenantId,
            })
            .catch(() => {});
        },
      }),
    );
  }

  private extractResource(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts[0] || 'unknown';
  }

  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;
    const sanitized = { ...(body as Record<string, unknown>) };
    // 移除敏感字段
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.client_secret;
    return sanitized;
  }
}
