import { Injectable, Logger } from '@nestjs/common';
import { ApprovalHandler } from '../../approvals/approval-handler.interface';
import { ApprovalRecord } from '../../approvals/entities/approval-record.entity';
import { OrderLifecycle } from '../services/order-lifecycle.service';
import { FeishuMessageService } from '../../integrations/feishu-message.service';
import { User } from '../../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface SalesOrderApprovalFormContext {
  order: { id: string; customer?: { name: string } | null; items?: unknown[] };
  approvalDefCode: string;
}

@Injectable()
export class SalesOrderApprovalHandler implements ApprovalHandler {
  private readonly logger = new Logger(SalesOrderApprovalHandler.name);

  constructor(
    private readonly orderLifecycle: OrderLifecycle,
    private readonly messageService: FeishuMessageService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async buildForm(_ctx: unknown): Promise<unknown> {
    // Form building is delegated to ApprovalFormBuilder by ApprovalService
    // This handler focuses on side effects only
    throw new Error('SalesOrderApprovalHandler does not build forms directly');
  }

  async onSubmitted(_record: ApprovalRecord): Promise<void> {
    // No side effect on submission for sales orders
  }

  async onApproved(record: ApprovalRecord): Promise<void> {
    const order = await this.orderLifecycle.approve(record.salesOrderId!, {
      approvalRecordId: record.id,
    });

    const creator = await this.userRepo.findOneBy({ id: order.creatorId });
    if (creator?.feishuOpenId) {
      this.messageService
        .notifyOrderApproved(
          creator.feishuOpenId,
          order.id.slice(0, 8),
          Number(order.totalAmount || 0),
        )
        .catch(() => {});
    }

    this.logger.log(
      `Order ${order.id} approved via handler ${record.feishuInstanceCode}`,
    );
  }

  async onRejected(record: ApprovalRecord): Promise<void> {
    const order = await this.orderLifecycle.reject(record.salesOrderId!, {
      reason: 'Approval rejected',
    });

    const creator = await this.userRepo.findOneBy({ id: order.creatorId });
    if (creator?.feishuOpenId) {
      this.messageService
        .notifyOrderRejected(creator.feishuOpenId, order.id.slice(0, 8))
        .catch(() => {});
    }

    this.logger.log(
      `Order ${order.id} rejected via handler ${record.feishuInstanceCode}`,
    );
  }

  async onCancelled(record: ApprovalRecord): Promise<void> {
    // Same as rejected for sales orders
    await this.onRejected(record);
  }
}
