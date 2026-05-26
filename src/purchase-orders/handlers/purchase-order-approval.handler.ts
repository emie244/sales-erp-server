import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalHandler } from '../../approvals/approval-handler.interface';
import { ApprovalRecord } from '../../approvals/entities/approval-record.entity';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../entities/purchase-order.entity';
import { PurchaseOrderStatusLogsService } from '../purchase-order-status-logs.service';

@Injectable()
export class PurchaseOrderApprovalHandler implements ApprovalHandler {
  private readonly logger = new Logger(PurchaseOrderApprovalHandler.name);

  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepo: Repository<PurchaseOrder>,
    private readonly statusLogsService: PurchaseOrderStatusLogsService,
  ) {}

  async buildForm(_ctx: unknown): Promise<unknown> {
    throw new Error(
      'PurchaseOrderApprovalHandler does not build forms directly',
    );
  }

  async onSubmitted(_record: ApprovalRecord): Promise<void> {
    // No side effect on submission
  }

  async onApproved(record: ApprovalRecord): Promise<void> {
    await this.transition(
      record.purchaseOrderId!,
      PurchaseOrderStatus.APPROVED,
      '审批通过',
    );
  }

  async onRejected(record: ApprovalRecord): Promise<void> {
    const order = await this.purchaseOrderRepo.findOneBy({
      id: record.purchaseOrderId,
    });
    if (!order) return;

    const fromStatus = order.status;
    order.status = PurchaseOrderStatus.REJECTED;
    order.approvalInstanceCode = null;
    await this.purchaseOrderRepo.save(order);

    await this.statusLogsService.create({
      purchaseOrderId: order.id,
      fromStatus,
      toStatus: order.status,
      remark: '审批驳回',
    });

    this.logger.log(`Purchase order ${order.id} rejected`);
  }

  async onCancelled(record: ApprovalRecord): Promise<void> {
    await this.transition(
      record.purchaseOrderId!,
      PurchaseOrderStatus.REVERTED,
      '审批撤销',
    );
  }

  private async transition(
    orderId: string,
    toStatus: PurchaseOrderStatus,
    remark: string,
  ): Promise<void> {
    const order = await this.purchaseOrderRepo.findOneBy({ id: orderId });
    if (!order) return;

    const fromStatus = order.status;
    order.status = toStatus;
    if (toStatus === PurchaseOrderStatus.REVERTED) {
      order.approvalInstanceCode = null;
    }
    await this.purchaseOrderRepo.save(order);

    await this.statusLogsService.create({
      purchaseOrderId: order.id,
      fromStatus,
      toStatus: order.status,
      remark,
    });

    this.logger.log(`Purchase order ${order.id} ${remark}`);
  }
}
