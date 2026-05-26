import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, DataSource, EntityManager } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import {
  ApprovalRecord,
  ApprovalType,
} from './entities/approval-record.entity';
import { FeishuApprovalService } from './feishu-approval.service';
import { ApprovalFormBuilder } from './approval-form.builder';
import {
  PrepaymentRecord,
  PrepaymentStatus,
} from '../prepayments/entities/prepayment-record.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';
import { ApprovalHandlerRegistry } from './approval-handler.registry';

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

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    @InjectRepository(ApprovalRecord)
    private readonly repo: Repository<ApprovalRecord>,
    @InjectRepository(PrepaymentRecord)
    private readonly prepaymentRepo: Repository<PrepaymentRecord>,
    private readonly feishu: FeishuApprovalService,
    private readonly formBuilder: ApprovalFormBuilder,
    private readonly dataSource: DataSource,
    private readonly registry: ApprovalHandlerRegistry,
    private readonly config: ConfigService,
  ) {}

  private skipFeishu(): boolean {
    return this.config.get<string>('SKIP_FEISHU_APPROVAL') === 'true';
  }

  async submitForApproval(
    order: { id: string; customer?: unknown; items?: unknown[] },
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ): Promise<ApprovalRecord> {
    const form = await this.formBuilder.build(approvalDefCode, order as any);

    const instanceCode = this.skipFeishu()
      ? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : await this.feishu.createApprovalInstance({
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
      customerName: (prepayment as any).customer?.name || '',
      amount: Number(prepayment.amount),
      paymentMethod: prepayment.paymentMethod || '',
      paymentDate: paymentDateStr,
      remark: prepayment.remark || '',
      receiptFileTokens,
    });

    const instanceCode = this.skipFeishu()
      ? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : await this.feishu.createApprovalInstance({
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
    order: { id: string; customer?: { name?: string } | null; totalAmount: number; payAmount: number; collectedAmount: number; prepaymentDeducted: number; remark?: string | null; collectionData?: any },
    collectionData: CollectionApprovalData,
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ): Promise<ApprovalRecord> {
    const records = collectionData.records || [];
    this.logger.log(
      `Submitting collection approval for order=${order.id}, records=${records.length}`,
    );

    const recordsWithTokens = [];
    for (const rec of records) {
      const tokens: string[] = [];
      const attachments = rec.attachments as string[];
      if (attachments?.length) {
        try {
          const definition =
            await this.formBuilder.getDefinition(approvalDefCode);
          const widget = definition.find(
            (w: any) => w.name === '回款凭证',
          ) as any;
          const uploadType =
            widget?.type === 'image' || widget?.type === 'imageV2'
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
      remark: order.remark ?? undefined,
    });

    const instanceCode = this.skipFeishu()
      ? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : await this.feishu.createApprovalInstance({
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

    return this.repo.save(record);
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

    const instanceCode = this.skipFeishu()
      ? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : await this.feishu.createApprovalInstance({
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
    });

    // Route to handler outside transaction to keep side effects separate
    const record = await this.repo.findOne({
      where: { feishuInstanceCode: instanceCode },
    });
    if (!record) return;

    const handler = this.registry.get(record.type);
    if (!handler) {
      this.logger.warn(`No handler registered for type ${record.type}`);
      return;
    }

    try {
      if (record.status === 'approved') {
        await handler.onApproved(record);
      } else if (record.status === 'rejected') {
        await handler.onRejected(record);
      } else if (record.status === 'cancelled' || record.status === 'reverted') {
        await handler.onCancelled(record);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Handler failed for ${record.type} ${record.feishuInstanceCode}: ${msg}`,
      );
      throw err;
    }
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
      return { message: 'approved' };
    }).then(async () => {
      const record = await this.repo.findOne({
        where: { feishuInstanceCode: instanceCode },
      });
      if (record) {
        const handler = this.registry.get(record.type);
        if (handler) await handler.onApproved(record);
      }
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
      return { message: 'rejected' };
    }).then(async () => {
      const record = await this.repo.findOne({
        where: { feishuInstanceCode: instanceCode },
      });
      if (record) {
        const handler = this.registry.get(record.type);
        if (handler) await handler.onRejected(record);
      }
      return { message: 'rejected' };
    });
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
