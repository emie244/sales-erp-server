import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
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
import { FeishuMessageService } from '../integrations/feishu-message.service';

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
    private readonly feishu: FeishuApprovalService,
    private readonly formBuilder: ApprovalFormBuilder,
    @InjectQueue('jushuitan-sync') private readonly syncQueue: Queue,
    private readonly dataSource: DataSource,
    private readonly messageService: FeishuMessageService,
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
    const form = [
      {
        id: 'customer_name',
        type: 'input',
        value: prepayment.customer?.name || '',
      },
      { id: 'amount', type: 'amount', value: Number(prepayment.amount) },
      {
        id: 'payment_method',
        type: 'input',
        value: prepayment.paymentMethod || '',
      },
      { id: 'payment_date', type: 'date', value: prepayment.paymentDate || '' },
      { id: 'remark', type: 'textarea', value: prepayment.remark || '' },
    ];

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
    collectionData: any,
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ): Promise<ApprovalRecord> {
    const form = [
      { id: 'order_id', type: 'input', value: order.id },
      { id: 'customer_name', type: 'input', value: order.customer?.name || '' },
      { id: 'amount', type: 'amount', value: Number(collectionData.amount) },
      {
        id: 'prepayment_deducted',
        type: 'amount',
        value: Number(collectionData.prepaymentDeducted || 0),
      },
      {
        id: 'method',
        type: 'input',
        value: collectionData.method || '',
      },
      { id: 'remark', type: 'textarea', value: collectionData.remark || '' },
    ];

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
      ...collectionData,
      originalStatus: order.status,
    };
    await this.orderRepo.save(order);

    return this.repo.save(record);
  }

  async handleCallback(instanceCode: string, payload: any) {
    await this.dataSource.transaction(async (manager: any) => {
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
      }
    });
  }

  private async handleSalesOrderApproval(
    record: ApprovalRecord,
    status: string,
    manager?: any,
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
    } else if (status === 'rejected') {
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
        this.messageService.notifyOrderApproved(
          creator.feishuOpenId,
          order.id.slice(0, 8),
          Number(order.totalAmount || 0),
        ).catch(() => {});
      } else if (status === 'rejected') {
        this.messageService.notifyOrderRejected(
          creator.feishuOpenId,
          order.id.slice(0, 8),
        ).catch(() => {});
      }
    }
  }

  private async handleCollectionApproval(
    record: ApprovalRecord,
    status: string,
    manager?: any,
  ) {
    const orderRepo = manager
      ? manager.getRepository(SalesOrder)
      : this.orderRepo;
    const customerRepo = manager
      ? manager.getRepository(Customer)
      : this.customerRepo;

    const order = await orderRepo.findOne({
      where: { id: record.salesOrderId },
      relations: ['customer'],
    });
    if (!order) return;

    if (status === 'approved') {
      // 执行回款逻辑
      const collectionData = order.collectionData;
      if (collectionData) {
        const prepaymentDeducted = collectionData.prepaymentDeducted || 0;

        // 扣减预付款余额
        if (prepaymentDeducted > 0 && order.customer) {
          order.customer.prepaymentBalance =
            Number(order.customer.prepaymentBalance || 0) - prepaymentDeducted;
          await customerRepo.save(order.customer);
        }

        // 更新订单收款状态
        order.collectedAmount =
          Number(order.collectedAmount || 0) +
          Number(collectionData.amount || 0);
        order.prepaymentDeducted =
          Number(order.prepaymentDeducted || 0) + prepaymentDeducted;
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
      const collectionCreator = await this.userRepo.findOneBy({ id: order.creatorId });
      if (collectionCreator?.feishuOpenId && order.collectionData) {
        this.messageService.notifyCollectionApproved(
          collectionCreator.feishuOpenId,
          order.id.slice(0, 8),
          Number(order.collectionData.amount || 0),
        ).catch(() => {});
      }
    } else if (status === 'rejected') {
      // 回款驳回：恢复原来的状态并清空临时回款数据
      const originalStatus = order.collectionData?.originalStatus;
      if (originalStatus) {
        order.status = originalStatus;
      }
      order.collectionData = null;
      await orderRepo.save(order);
      this.logger.log(`Collection rejected for order ${order.id}`);
    }
  }

  private async handlePrepaymentApproval(
    record: ApprovalRecord,
    status: string,
    manager?: any,
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
    } else if (status === 'rejected') {
      prepayment.status = PrepaymentStatus.REJECTED;
    }

    await prepaymentRepo.save(prepayment);
    this.logger.log(
      `Prepayment ${prepayment.id} status updated to ${prepayment.status}`,
    );
  }

  async findAll(status?: string) {
    const where: any = {};
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
    const record = await this.repo.findOneBy({
      feishuInstanceCode: instanceCode,
    });
    if (!record) throw new NotFoundException('Record not found');
    record.status = 'approved';
    await this.repo.save(record);

    await this.handleApprovalByType(record, 'approved');
    return { message: 'approved' };
  }

  async reject(instanceCode: string) {
    const record = await this.repo.findOneBy({
      feishuInstanceCode: instanceCode,
    });
    if (!record) throw new NotFoundException('Record not found');
    record.status = 'rejected';
    await this.repo.save(record);

    await this.handleApprovalByType(record, 'rejected');
    return { message: 'rejected' };
  }

  private async handleApprovalByType(record: ApprovalRecord, status: string) {
    if (record.type === ApprovalType.SALES_ORDER) {
      await this.handleSalesOrderApproval(record, status);
    } else if (record.type === ApprovalType.COLLECTION) {
      await this.handleCollectionApproval(record, status);
    } else if (record.type === ApprovalType.PREPAYMENT) {
      await this.handlePrepaymentApproval(record, status);
    }
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
