import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ApprovalRecord } from './entities/approval-record.entity';
import { FeishuApprovalService } from './feishu-approval.service';
import {
  SalesOrder,
  SalesOrderStatus,
} from '../sales/entities/sales-order.entity';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    @InjectRepository(ApprovalRecord)
    private readonly repo: Repository<ApprovalRecord>,
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    private readonly feishu: FeishuApprovalService,
    @InjectQueue('jushuitan-sync') private readonly syncQueue: Queue,
  ) {}

  async submitForApproval(
    order: SalesOrder,
    feishuUserId: string,
    approvalDefCode: string,
  ): Promise<ApprovalRecord> {
    const instanceCode = await this.feishu.createApprovalInstance({
      approvalCode: approvalDefCode,
      userId: feishuUserId,
      form: {
        客户名称: order.customer?.name || '',
        订单金额: String(order.payAmount),
        商品清单: JSON.stringify(
          order.items.map((i) => ({ sku: i.skuId, qty: i.qty })),
        ),
      },
    });

    const record = this.repo.create({
      salesOrderId: order.id,
      feishuInstanceCode: instanceCode,
      feishuApprovalDefCode: approvalDefCode,
      status: 'pending',
    });

    return this.repo.save(record);
  }

  async handleCallback(instanceCode: string, payload: any) {
    const record = await this.repo.findOne({
      where: { feishuInstanceCode: instanceCode },
    });
    if (!record) {
      this.logger.warn(
        `Approval record not found for instance ${instanceCode}`,
      );
      return;
    }

    const status = this.parseStatus(payload);
    record.status = status;
    record.callbackPayload = payload;
    await this.repo.save(record);

    const order = await this.orderRepo.findOneBy({ id: record.salesOrderId });
    if (!order) return;

    if (status === 'approved') {
      order.status = SalesOrderStatus.APPROVED;
      await this.orderRepo.save(order);
      await this.syncQueue.add('push-order', { orderId: order.id });
      this.logger.log(`Queued push-order for ${order.id}`);
    } else if (status === 'rejected') {
      order.status = SalesOrderStatus.REJECTED;
      await this.orderRepo.save(order);
    }

    this.logger.log(
      `Order ${order.id} status updated to ${order.status} by approval ${instanceCode}`,
    );
  }

  private parseStatus(
    payload: any,
  ): 'pending' | 'approved' | 'rejected' | 'transferred' {
    const raw = payload?.event?.status || payload?.status || 'pending';
    const map: Record<string, any> = {
      PENDING: 'pending',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      TRANSFERRED: 'transferred',
    };
    return map[raw] || 'pending';
  }
}
