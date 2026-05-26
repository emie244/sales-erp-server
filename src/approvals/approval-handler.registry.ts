import { Injectable } from '@nestjs/common';
import { ApprovalHandler } from './approval-handler.interface';

@Injectable()
export class ApprovalHandlerRegistry {
  private readonly handlers = new Map<string, ApprovalHandler>();

  register(type: string, handler: ApprovalHandler): void {
    this.handlers.set(type, handler);
  }

  get(type: string): ApprovalHandler | undefined {
    return this.handlers.get(type);
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }
}
