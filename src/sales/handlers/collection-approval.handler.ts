import { Injectable, Logger } from '@nestjs/common';
import { ApprovalHandler } from '../../approvals/approval-handler.interface';
import { ApprovalRecord } from '../../approvals/entities/approval-record.entity';
import { CollectionLifecycle } from '../services/collection-lifecycle.service';
import { FeishuMessageService } from '../../integrations/feishu-message.service';
import { User } from '../../users/entities/user.entity';
import { SalesOrder } from '../entities/sales-order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class CollectionApprovalHandler implements ApprovalHandler {
  private readonly logger = new Logger(CollectionApprovalHandler.name);

  constructor(
    private readonly collectionLifecycle: CollectionLifecycle,
    private readonly messageService: FeishuMessageService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
  ) {}

  async buildForm(_ctx: unknown): Promise<unknown> {
    throw new Error('CollectionApprovalHandler does not build forms directly');
  }

  async onSubmitted(_record: ApprovalRecord): Promise<void> {
    // Collection data is already saved to order by CollectionLifecycle.submitCollection
  }

  async onApproved(record: ApprovalRecord): Promise<void> {
    await this.collectionLifecycle.approveCollection(record.salesOrderId!);

    const order = await this.orderRepo.findOneBy({ id: record.salesOrderId });
    if (order) {
      const creator = await this.userRepo.findOneBy({ id: order.creatorId });
      if (creator?.feishuOpenId) {
        this.messageService
          .notifyCollectionApproved(
            creator.feishuOpenId,
            order.id.slice(0, 8),
            Number(order.collectedAmount || 0),
          )
          .catch(() => {});
      }
    }

    this.logger.log(
      `Collection approved for order ${record.salesOrderId}`,
    );
  }

  async onRejected(record: ApprovalRecord): Promise<void> {
    await this.collectionLifecycle.rejectCollection(record.salesOrderId!);
    this.logger.log(`Collection rejected for order ${record.salesOrderId}`);
  }

  async onCancelled(record: ApprovalRecord): Promise<void> {
    await this.onRejected(record);
  }
}
