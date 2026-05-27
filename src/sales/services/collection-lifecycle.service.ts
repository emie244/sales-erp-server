import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrder, SalesOrderStatus } from '../entities/sales-order.entity';
import { PaymentRecord, PaymentType } from '../../payments/entities/payment-record.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { InvoiceRecord } from '../../invoices/entities/invoice-record.entity';
import { ApprovalService } from '../../approvals/approval.service';
import { OrderLifecycle } from './order-lifecycle.service';
import { VouchersService } from '../../vouchers/vouchers.service';
import { CreateCollectionDto } from '../dto/create-collection.dto';

export interface CollectionSubmitContext {
  feishuUserId: string;
  approvalDefCode: string;
  feishuUserIdType?: string;
}

@Injectable()
export class CollectionLifecycle {
  private readonly logger = new Logger(CollectionLifecycle.name);

  constructor(
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRepo: Repository<PaymentRecord>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(InvoiceRecord)
    private readonly invoiceRepo: Repository<InvoiceRecord>,
    private readonly approvalService: ApprovalService,
    private readonly orderLifecycle: OrderLifecycle,
    private readonly vouchersService: VouchersService,
  ) {}

  async submitCollection(
    orderId: string,
    dto: CreateCollectionDto,
    ctx: CollectionSubmitContext,
  ): Promise<SalesOrder> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['customer', 'items'],
    });
    if (!order) throw new NotFoundException('Order not found');

    if (!['approved', 'synced_jst', 'shipped'].includes(order.status)) {
      throw new BadRequestException('订单状态不允许回款');
    }

    const records = dto.records || [];
    const totalCollection = records.reduce(
      (sum, r) => sum + (r.amount || 0),
      0,
    );
    const prepaymentDeducted = records
      .filter((r) => r.method === 'prepayment')
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    const remainingAmount =
      order.payAmount - order.collectedAmount - order.prepaymentDeducted;
    if (totalCollection > remainingAmount + 0.01) {
      throw new BadRequestException(
        `回款金额超过剩余应收款。剩余应收: ¥${remainingAmount.toFixed(2)}`,
      );
    }

    if (prepaymentDeducted > 0 && order.customer) {
      if (order.customer.prepaymentBalance < prepaymentDeducted) {
        throw new BadRequestException('客户预付款余额不足');
      }
    }

    await this.approvalService.submitCollectionForApproval(
      order,
      { records, prepaymentDeducted },
      ctx.feishuUserId,
      ctx.approvalDefCode,
      ctx.feishuUserIdType,
    );

    order.status = SalesOrderStatus.PENDING_APPROVAL;
    order.collectionData = {
      records,
      prepaymentDeducted,
      originalStatus:
        order.status === SalesOrderStatus.PENDING_APPROVAL
          ? 'approved'
          : order.status,
    } as SalesOrder['collectionData'];

    return this.orderRepo.save(order);
  }

  async approveCollection(orderId: string): Promise<void> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['customer'],
    });
    if (!order) return;

    const collectionData = order.collectionData;
    if (!collectionData?.records?.length) return;

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

      const payment = this.paymentRepo.create({
        salesOrderId: order.id,
        amount,
        method: rec.method || '',
        receivedAt: new Date(),
        receivedBy: order.creatorId || 'system',
        remark: rec.remark || '',
        type: isPrepayment ? PaymentType.PREPAYMENT : PaymentType.COLLECTION,
        attachments: rec.attachments || [],
        invoiceIds: rec.invoiceIds || null,
      });
      await this.paymentRepo.save(payment);

      // 发票核销
      if (rec.invoiceIds?.length && amount > 0) {
        await this.applyInvoicePayment(rec.invoiceIds, amount);
      }
    }

    if (totalPrepaymentDeducted > 0 && order.customer) {
      order.customer.prepaymentBalance =
        Number(order.customer.prepaymentBalance || 0) -
        totalPrepaymentDeducted;
      await this.customerRepo.save(order.customer);
    }

    order.collectedAmount =
      Number(order.collectedAmount || 0) + totalCollectedAmount;
    order.prepaymentDeducted =
      Number(order.prepaymentDeducted || 0) + totalPrepaymentDeducted;
    order.collectionData = null;

    await this.orderRepo.save(order);
    await this.orderLifecycle.checkCompletion(order.id);

    // 自动生成收款凭证（不阻塞回款流程）
    try {
      const totalAmount = totalCollectedAmount + totalPrepaymentDeducted;
      if (totalAmount > 0) {
        const items: any[] = [];
        if (totalCollectedAmount > 0) {
          items.push({
            accountCode: '1002',
            accountName: '银行存款',
            debitAmount: totalCollectedAmount,
            creditAmount: 0,
          });
        }
        if (totalPrepaymentDeducted > 0) {
          items.push({
            accountCode: '2203',
            accountName: '预收账款',
            debitAmount: totalPrepaymentDeducted,
            creditAmount: 0,
          });
        }
        items.push({
          accountCode: '1122',
          accountName: '应收账款',
          debitAmount: 0,
          creditAmount: totalAmount,
        });

        await this.vouchersService.create({
          voucherNo: '',
          voucherDate: new Date().toISOString(),
          type: 'receipt' as any,
          description: `销售订单回款: ${order.orderNo || order.id}`,
          totalAmount,
          sourceType: 'sales_order',
          sourceId: order.id,
          items,
        } as any);
        this.logger.log(
          `Auto-generated receipt voucher for order ${order.id}`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to auto-generate receipt voucher for order ${order.id}: ${err.message}`,
      );
    }

    this.logger.log(
      `Collection approved for order ${order.id}, collected: ${order.collectedAmount}`,
    );
  }

  private async applyInvoicePayment(invoiceIds: string[], amount: number) {
    let remaining = amount;
    for (const invoiceId of invoiceIds) {
      if (remaining <= 0.001) break;
      const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
      if (!invoice) continue;
      const invoiceRemaining = Number(invoice.remainingAmount || 0);
      if (invoiceRemaining <= 0.001) continue;
      const applyAmount = Math.min(remaining, invoiceRemaining);
      invoice.paidAmount = Number(invoice.paidAmount || 0) + applyAmount;
      invoice.remainingAmount = invoiceRemaining - applyAmount;
      await this.invoiceRepo.save(invoice);
      remaining -= applyAmount;
    }
    if (remaining > 0.001) {
      this.logger.warn(`发票核销后仍有剩余 ¥${remaining.toFixed(2)}未分配`);
    }
  }

  async rejectCollection(orderId: string): Promise<void> {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order || !order.collectionData) return;

    const originalStatus = order.collectionData.originalStatus;
    if (originalStatus) {
      order.status = originalStatus as SalesOrderStatus;
    }
    order.collectionData = null;
    await this.orderRepo.save(order);

    this.logger.log(`Collection rejected for order ${order.id}`);
  }

  async updateCollection(
    orderId: string,
    dto: CreateCollectionDto,
  ): Promise<SalesOrder> {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== SalesOrderStatus.REJECTED || !order.collectionData) {
      throw new BadRequestException('订单状态不允许编辑回款信息');
    }

    const records = dto.records || [];
    const totalCollection = records.reduce(
      (sum, r) => sum + (r.amount || 0),
      0,
    );

    const remainingAmount =
      order.payAmount - order.collectedAmount - order.prepaymentDeducted;
    if (totalCollection > remainingAmount + 0.01) {
      throw new BadRequestException(
        `回款金额超过剩余应收款。剩余应收: ¥${remainingAmount.toFixed(2)}`,
      );
    }

    order.collectionData = {
      ...order.collectionData,
      records,
    } as SalesOrder['collectionData'];

    return this.orderRepo.save(order);
  }
}
