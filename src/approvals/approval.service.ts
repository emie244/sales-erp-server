import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as fs from 'fs';
import * as path from 'path';
import {
  ApprovalRecord,
  ApprovalType,
} from './entities/approval-record.entity';
import { FeishuApprovalService } from './feishu-approval.service';
import { ApprovalFormBuilder } from './approval-form.builder';
import {
  SalesOrder,
  SalesOrderStatus,
} from '../sales/entities/sales-order.entity';
import {
  PrepaymentRecord,
  PrepaymentStatus,
} from '../prepayments/entities/prepayment-record.entity';
import { Customer } from '../customers/entities/customer.entity';
import { User } from '../users/entities/user.entity';
import {
  PaymentRecord,
  PaymentType,
} from '../payments/entities/payment-record.entity';

interface CollectionRecord {
  amount: number;
  method: string;
  remark?: string;
  attachments?: string[];
}

interface CollectionApprovalData {
  records: CollectionRecord[];
  prepaymentDeducted?: number;
}

import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../purchase-orders/entities/purchase-order.entity';
import { FeishuMessageService } from '../integrations/feishu-message.service';
import { PurchaseOrderStatusLogsService } from '../purchase-orders/purchase-order-status-logs.service';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    @InjectRepository(ApprovalRecord)
    private readonly repo: Repository<ApprovalRecord>,
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    @InjectRepository(PrepaymentRecord)
    private readonly prepaymentRepo: Repository<PrepaymentRecord>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRepo: Repository<PaymentRecord>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepo: Repository<PurchaseOrder>,
    private readonly feishu: FeishuApprovalService,
    private readonly formBuilder: ApprovalFormBuilder,
    @InjectQueue('jushuitan-sync') private readonly syncQueue: Queue,
    private readonly dataSource: DataSource,
    private readonly messageService: FeishuMessageService,
    private readonly statusLogsService: PurchaseOrderStatusLogsService,
  ) {}

  async submitForApproval(
    order: SalesOrder,
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ): Promise<ApprovalRecord> {
    const form = await this.formBuilder.build(approvalDefCode, order);

    const instanceCode = await this.feishu.createApprovalInstance({
      approvalCode: approvalDefCode,
      userId: feishuUserId,
      userIdType: feishuUserIdType || 'user_id',
      form,
    });

    const record = this.repo.create({
      salesOrderId: order.id,
      type: ApprovalType.SALES_ORDER,
      feishuInstanceCode: instanceCode,
      feishuApprovalDefCode: approvalDefCode,
      status: 'pending',
    });

    return this.repo.save(record);
  }

  async submitPrepaymentForApproval(
    prepayment: PrepaymentRecord,
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ): Promise<ApprovalRecord> {
    // 上传收款凭证到飞书获取 file_token
    let receiptFileTokens: string[] = [];
    if (prepayment.receiptUrl) {
      try {
        const filename = prepayment.receiptUrl.split('/').pop() || 'file';
        const filePath = path.join(
          process.cwd(),
          prepayment.receiptUrl.replace(/^\//, ''),
        );
        if (fs.existsSync(filePath)) {
          const buffer = fs.readFileSync(filePath);
          const token = await this.feishu.uploadFile(buffer, filename, 'image');
          receiptFileTokens = [token];
        } else {
          this.logger.warn(`Receipt file not found: ${filePath}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to upload receipt to Feishu: ${msg}`);
      }
    }

    const paymentDateStr = prepayment.paymentDate
      ? new Date(prepayment.paymentDate).toISOString()
      : '';

    const form = await this.formBuilder.buildPrepaymentForm(approvalDefCode, {
      customerName: prepayment.customer?.name || '',
      amount: Number(prepayment.amount),
      paymentMethod: prepayment.paymentMethod || '',
      paymentDate: paymentDateStr,
      remark: prepayment.remark || '',
      receiptFileTokens,
    });

    const instanceCode = await this.feishu.createApprovalInstance({
      approvalCode: approvalDefCode,
      userId: feishuUserId,
      userIdType: feishuUserIdType || 'user_id',
      form,
    });

    const record = this.repo.create({
      prepaymentRecordId: prepayment.id,
      type: ApprovalType.PREPAYMENT,
      feishuInstanceCode: instanceCode,
      feishuApprovalDefCode: approvalDefCode,
      status: 'pending',
    });

    prepayment.status = PrepaymentStatus.PENDING;
    prepayment.approvalInstanceCode = instanceCode;
    await this.prepaymentRepo.save(prepayment);

    return this.repo.save(record);
  }

  async submitCollectionForApproval(
    order: SalesOrder,
    collectionData: CollectionApprovalData,
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ): Promise<ApprovalRecord> {
    const records = collectionData.records || [];

    // 上传每条记录的附件到飞书获取 file_token
    const recordsWithTokens = [];
    for (const rec of records) {
      const tokens: string[] = [];
      const attachments = rec.attachments as string[];
      if (attachments?.length) {
        try {
          const definition =
            await this.formBuilder.getDefinition(approvalDefCode);
          const widget = definition.find(
            (w: unknown) => (w as Record<string, unknown>).name === '回款凭证',
          );
          const w = widget as Record<string, unknown> | undefined;
          const uploadType =
            w?.type === 'image' || w?.type === 'imageV2'
              ? 'image'
              : 'attachment';
          for (const url of attachments) {
            try {
              const filename = url.split('/').pop() || 'file';
              const filePath = path.join(process.cwd(), url.replace(/^\//, ''));
              if (!fs.existsSync(filePath)) {
                this.logger.warn(`Attachment file not found: ${filePath}`);
                continue;
              }
              const buffer = fs.readFileSync(filePath);
              const token = await this.feishu.uploadFile(
                buffer,
                filename,
                uploadType,
              );
              tokens.push(token);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              this.logger.warn(
                `Failed to upload attachment ${url} to Feishu: ${msg}`,
              );
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to process attachments: ${msg}`);
        }
      }
      recordsWithTokens.push({
        ...rec,
        attachmentTokens: tokens,
      });
    }

    const remainingAmount =
      order.payAmount -
      (order.collectedAmount || 0) -
      (order.prepaymentDeducted || 0);

    const form = await this.formBuilder.buildCollectionForm(approvalDefCode, {
      orderId: order.id,
      customerName: order.customer?.name || '',
      orderTotalAmount: order.totalAmount,
      remainingAmount,
      records: recordsWithTokens,
      remark: order.remark,
    });

    const instanceCode = await this.feishu.createApprovalInstance({
      approvalCode: approvalDefCode,
      userId: feishuUserId,
      userIdType: feishuUserIdType || 'user_id',
      form,
    });

    const record = this.repo.create({
      salesOrderId: order.id,
      type: ApprovalType.COLLECTION,
      feishuInstanceCode: instanceCode,
      feishuApprovalDefCode: approvalDefCode,
      status: 'pending',
    });

    // 保存回款信息到订单，同时保存原状态以便驳回时恢复
    order.collectionData = {
      ...(collectionData as unknown as Record<string, unknown>),
      originalStatus: order.status,
    } as SalesOrder['collectionData'];
    await this.orderRepo.save(order);

    return this.repo.save(record);
  }

  async handleCallback(instanceCode: string, payload: Record<string, unknown>) {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const record = await manager.findOne(ApprovalRecord, {
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
      await manager.save(record);

      // Pass manager to handle methods for transactional consistency
      if (record.type === ApprovalType.SALES_ORDER) {
        await this.handleSalesOrderApproval(record, status, manager);
      } else if (record.type === ApprovalType.COLLECTION) {
        await this.handleCollectionApproval(record, status, manager);
      } else if (record.type === ApprovalType.PREPAYMENT) {
        await this.handlePrepaymentApproval(record, status, manager);
      } else if (record.type === ApprovalType.PURCHASE_ORDER) {
        await this.handlePurchaseOrderApproval(record, status, manager);
      }
    });
  }

  private async handleSalesOrderApproval(
    record: ApprovalRecord,
    status: string,
    manager?: EntityManager,
  ) {
    const orderRepo = manager
      ? manager.getRepository(SalesOrder)
      : this.orderRepo;
    const order = await orderRepo.findOneBy({ id: record.salesOrderId });
    if (!order) return;

    if (status === 'approved') {
      order.status = SalesOrderStatus.APPROVED;
      await orderRepo.save(order);
      await this.syncQueue.add('push-order', { orderId: order.id });
      this.logger.log(`Queued push-order for ${order.id}`);
    } else if (
      status === 'rejected' ||
      status === 'cancelled' ||
      status === 'reverted'
    ) {
      order.status = SalesOrderStatus.REJECTED;
      await orderRepo.save(order);
    }

    this.logger.log(
      `Order ${order.id} status updated to ${order.status} by approval ${record.feishuInstanceCode}`,
    );

    // 发送飞书消息通知
    const creator = await this.userRepo.findOneBy({ id: order.creatorId });
    if (creator?.feishuOpenId) {
      if (status === 'approved') {
        this.messageService
          .notifyOrderApproved(
            creator.feishuOpenId,
            order.id.slice(0, 8),
            Number(order.totalAmount || 0),
          )
          .catch(() => {});
      } else if (status === 'rejected' || status === 'cancelled') {
        this.messageService
          .notifyOrderRejected(creator.feishuOpenId, order.id.slice(0, 8))
          .catch(() => {});
      }
    }
  }

  private async handleCollectionApproval(
    record: ApprovalRecord,
    status: string,
    manager?: EntityManager,
  ) {
    const orderRepo = manager
      ? manager.getRepository(SalesOrder)
      : this.orderRepo;
    const customerRepo = manager
      ? manager.getRepository(Customer)
      : this.customerRepo;
    const paymentRepo = manager
      ? manager.getRepository(PaymentRecord)
      : this.paymentRepo;

    const order = await orderRepo.findOne({
      where: { id: record.salesOrderId },
      relations: ['customer'],
    });
    if (!order) return;

    if (status === 'approved') {
      // 执行回款逻辑
      const collectionData = order.collectionData;
      if (collectionData?.records?.length) {
        let totalCollectedAmount = 0;
        let totalPrepaymentDeducted = 0;

        for (const rec of collectionData.records) {
          const amount = Number(rec.amount || 0);
          const isPrepayment = rec.method === 'prepayment';

          if (isPrepayment) {
            totalPrepaymentDeducted += amount;
          } else {
            totalCollectedAmount += amount;
          }

          // 创建回款记录
          const payment = paymentRepo.create({
            salesOrderId: order.id,
            amount,
            method: rec.method || '',
            receivedAt: new Date(),
            receivedBy: order.creatorId || 'system',
            remark: rec.remark || '',
            type: isPrepayment
              ? PaymentType.PREPAYMENT
              : PaymentType.COLLECTION,
            attachments: rec.attachments || [],
          });
          await paymentRepo.save(payment);
        }

        // 扣减预付款余额
        if (totalPrepaymentDeducted > 0 && order.customer) {
          order.customer.prepaymentBalance =
            Number(order.customer.prepaymentBalance || 0) -
            totalPrepaymentDeducted;
          await customerRepo.save(order.customer);
        }

        // 更新订单收款状态
        order.collectedAmount =
          Number(order.collectedAmount || 0) + totalCollectedAmount;
        order.prepaymentDeducted =
          Number(order.prepaymentDeducted || 0) + totalPrepaymentDeducted;
        order.collectionData = null; // 清空临时回款数据

        // 如果全部回款完成
        const totalCollected =
          Number(order.collectedAmount || 0) +
          Number(order.prepaymentDeducted || 0);
        if (totalCollected >= Number(order.payAmount || 0) - 0.01) {
          order.status = SalesOrderStatus.COMPLETED;
        } else {
          // 恢复为原来的状态（approved/synced_jst/shipped）
          order.status =
            collectionData?.originalStatus || SalesOrderStatus.APPROVED;
        }
      }

      await orderRepo.save(order);
      this.logger.log(
        `Collection approved for order ${order.id}, collected: ${order.collectedAmount}`,
      );

      // 发送飞书消息通知
      const collectionCreator = await this.userRepo.findOneBy({
        id: order.creatorId,
      });
      if (collectionCreator?.feishuOpenId) {
        this.messageService
          .notifyCollectionApproved(
            collectionCreator.feishuOpenId,
            order.id.slice(0, 8),
            Number(order.collectedAmount || 0),
          )
          .catch(() => {});
      }
    } else if (
      status === 'rejected' ||
      status === 'cancelled' ||
      status === 'reverted'
    ) {
      // 回款驳回/撤销：恢复原来的状态并清空临时回款数据
      const originalStatus = order.collectionData?.originalStatus;
      if (originalStatus) {
        order.status = originalStatus;
      }
      order.collectionData = null;
      await orderRepo.save(order);
      this.logger.log(`Collection ${status} for order ${order.id}`);
    }
  }

  private async handlePrepaymentApproval(
    record: ApprovalRecord,
    status: string,
    manager?: EntityManager,
  ) {
    const prepaymentRepo = manager
      ? manager.getRepository(PrepaymentRecord)
      : this.prepaymentRepo;
    const customerRepo = manager
      ? manager.getRepository(Customer)
      : this.customerRepo;

    const prepayment = await prepaymentRepo.findOne({
      where: { id: record.prepaymentRecordId },
      relations: ['customer'],
    });
    if (!prepayment) return;

    if (status === 'approved') {
      prepayment.status = PrepaymentStatus.APPROVED;
      // 增加客户预付款余额
      if (prepayment.customer) {
        prepayment.customer.prepaymentBalance =
          Number(prepayment.customer.prepaymentBalance || 0) +
          Number(prepayment.amount || 0);
        await customerRepo.save(prepayment.customer);
      }
    } else if (
      status === 'rejected' ||
      status === 'cancelled' ||
      status === 'reverted'
    ) {
      prepayment.status = PrepaymentStatus.REJECTED;
    }

    await prepaymentRepo.save(prepayment);
    this.logger.log(
      `Prepayment ${prepayment.id} status updated to ${prepayment.status}`,
    );
  }

  async submitPurchaseOrderForApproval(
    order: PurchaseOrder,
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ): Promise<ApprovalRecord> {
    const form = await this.formBuilder.buildPurchaseOrderForm(
      approvalDefCode,
      order,
    );

    const instanceCode = await this.feishu.createApprovalInstance({
      approvalCode: approvalDefCode,
      userId: feishuUserId,
      userIdType: feishuUserIdType || 'user_id',
      form,
    });

    const record = this.repo.create({
      purchaseOrderId: order.id,
      type: ApprovalType.PURCHASE_ORDER,
      feishuInstanceCode: instanceCode,
      feishuApprovalDefCode: approvalDefCode,
      status: 'pending',
    });

    return this.repo.save(record);
  }

  private async handlePurchaseOrderApproval(
    record: ApprovalRecord,
    status: string,
    manager?: EntityManager,
  ) {
    const orderRepo = manager
      ? manager.getRepository(PurchaseOrder)
      : this.purchaseOrderRepo;

    const order = await orderRepo.findOneBy({ id: record.purchaseOrderId });
    if (!order) return;

    const fromStatus = order.status;

    if (status === 'approved') {
      order.status = PurchaseOrderStatus.APPROVED;
      await orderRepo.save(order);
      this.logger.log(`Purchase order ${order.id} approved`);
    } else if (
      status === 'rejected' ||
      status === 'cancelled' ||
      status === 'reverted'
    ) {
      order.status = PurchaseOrderStatus.DRAFT;
      order.approvalInstanceCode = null;
      await orderRepo.save(order);
      this.logger.log(
        `Purchase order ${order.id} ${status === 'cancelled' || status === 'reverted' ? 'cancelled/reverted' : 'rejected'}, back to draft`,
      );
    } else if (status === 'transferred') {
      this.logger.log(`Purchase order ${order.id} approval transferred`);
      return;
    } else if (status === 'pending') {
      this.logger.log(`Purchase order ${order.id} approval pending`);
      return;
    }

    const remarkMap: Record<string, string> = {
      approved: '审批通过',
      rejected: '审批驳回',
      cancelled: '审批撤销',
      reverted: '审批撤销',
    };
    await this.statusLogsService.create(
      {
        purchaseOrderId: order.id,
        fromStatus,
        toStatus: order.status,
        remark: remarkMap[status] || status,
      },
      manager,
    );
  }

  async findAll(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['salesOrder'],
    });
  }

  async findOne(instanceCode: string) {
    return this.repo.findOne({
      where: { feishuInstanceCode: instanceCode },
      relations: ['salesOrder'],
    });
  }

  async approve(instanceCode: string) {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const record = await manager.findOne(ApprovalRecord, {
        where: { feishuInstanceCode: instanceCode },
      });
      if (!record) throw new NotFoundException('Record not found');
      record.status = 'approved';
      await manager.save(record);

      await this.handleApprovalByType(record, 'approved', manager);
      return { message: 'approved' };
    });
  }

  async reject(instanceCode: string) {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const record = await manager.findOne(ApprovalRecord, {
        where: { feishuInstanceCode: instanceCode },
      });
      if (!record) throw new NotFoundException('Record not found');
      record.status = 'rejected';
      await manager.save(record);

      await this.handleApprovalByType(record, 'rejected', manager);
      return { message: 'rejected' };
    });
  }

  private async handleApprovalByType(
    record: ApprovalRecord,
    status: string,
    manager?: EntityManager,
  ) {
    if (record.type === ApprovalType.SALES_ORDER) {
      await this.handleSalesOrderApproval(record, status, manager);
    } else if (record.type === ApprovalType.COLLECTION) {
      await this.handleCollectionApproval(record, status, manager);
    } else if (record.type === ApprovalType.PREPAYMENT) {
      await this.handlePrepaymentApproval(record, status, manager);
    } else if (record.type === ApprovalType.PURCHASE_ORDER) {
      await this.handlePurchaseOrderApproval(record, status, manager);
    }
  }

  private parseStatus(
    payload: Record<string, unknown>,
  ):
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'transferred'
    | 'cancelled'
    | 'reverted' {
    const ev = payload?.event as Record<string, unknown>;
    const raw =
      (ev?.status as string) || (payload?.status as string) || 'pending';
    const map: Record<
      string,
      | 'pending'
      | 'approved'
      | 'rejected'
      | 'transferred'
      | 'cancelled'
      | 'reverted'
    > = {
      PENDING: 'pending',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      TRANSFERRED: 'transferred',
      CANCELLED: 'cancelled',
      CANCELED: 'cancelled',
      REVERTED: 'reverted',
    };
    return map[raw] || 'pending';
  }
}
