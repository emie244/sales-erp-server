import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrder } from '../entities/sales-order.entity';
import { SalesOrderItem } from '../entities/sales-order-item.entity';
import { ApprovalRecord } from '../../approvals/entities/approval-record.entity';
import { PaymentRecord } from '../../payments/entities/payment-record.entity';
import { DeliveryOrder } from '../../deliveries/entities/delivery-order.entity';
import { ProductionOrder } from '../../production-orders/entities/production-order.entity';

export interface OrderQueryFilters {
  status?: string;
  type?: string;
  customerId?: string;
  creatorId?: string;
  salespersonId?: string;
  migrationSource?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  tenantId?: string;
}

@Injectable()
export class SalesOrderQueryService {
  constructor(
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    @InjectRepository(ApprovalRecord)
    private readonly approvalRepo: Repository<ApprovalRecord>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRepo: Repository<PaymentRecord>,
    @InjectRepository(DeliveryOrder)
    private readonly deliveryRepo: Repository<DeliveryOrder>,
    @InjectRepository(ProductionOrder)
    private readonly productionOrderRepo: Repository<ProductionOrder>,
  ) {}

  async findAll(
    page: number = 1,
    pageSize: number = 20,
    filters?: OrderQueryFilters,
  ) {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.salesperson', 'salesperson')
      .leftJoinAndSelect('order.items', 'items')
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (filters?.status) {
      const statuses = filters.status.split(',').filter(Boolean);
      if (statuses.length === 1) {
        qb.andWhere('order.status = :status', { status: statuses[0] });
      } else if (statuses.length > 1) {
        qb.andWhere('order.status IN (:...statuses)', { statuses });
      }
    }

    if (filters?.type) {
      qb.andWhere('order.type = :type', { type: filters.type });
    }

    if (filters?.customerId) {
      qb.andWhere('order.customerId = :customerId', {
        customerId: filters.customerId,
      });
    }

    if (filters?.creatorId) {
      qb.andWhere('order.creatorId = :creatorId', {
        creatorId: filters.creatorId,
      });
    }

    if (filters?.salespersonId) {
      qb.andWhere('order.salespersonId = :salespersonId', {
        salespersonId: filters.salespersonId,
      });
    }

    if (filters?.migrationSource) {
      if (filters.migrationSource === 'none') {
        qb.andWhere('order.migrationSource IS NULL');
      } else {
        qb.andWhere('order.migrationSource = :migrationSource', {
          migrationSource: filters.migrationSource,
        });
      }
    }

    if (filters?.keyword) {
      const keyword = `%${filters.keyword}%`;
      qb.andWhere(
        `(order.orderNo LIKE :keyword OR order.remark LIKE :keyword OR order.consignee LIKE :keyword OR order.expressNo LIKE :keyword OR customer.name LIKE :keyword)`,
        { keyword },
      );
    }

    if (filters?.dateFrom) {
      qb.andWhere('order.createdAt >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }

    if (filters?.dateTo) {
      qb.andWhere('order.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }

    if (filters?.minAmount !== undefined) {
      qb.andWhere('order.totalAmount >= :minAmount', {
        minAmount: filters.minAmount,
      });
    }

    if (filters?.maxAmount !== undefined) {
      qb.andWhere('order.totalAmount <= :maxAmount', {
        maxAmount: filters.maxAmount,
      });
    }

    if (filters?.tenantId) {
      qb.andWhere('order.tenantId = :tenantId', {
        tenantId: filters.tenantId,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async findOne(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['customer', 'items', 'creator', 'salesperson'],
    });
    if (!order) throw new NotFoundException('Sales order not found');

    const [approvalRecords, deliveryOrders, paymentRecords, productionOrders] =
      await Promise.all([
        this.approvalRepo.find({
          where: { salesOrderId: id },
          order: { createdAt: 'DESC' },
        }),
        this.deliveryRepo.find({
          where: { salesOrderId: id },
          order: { createdAt: 'DESC' },
        }),
        this.paymentRepo.find({
          where: { salesOrderId: id },
          order: { receivedAt: 'DESC' },
        }),
        this.productionOrderRepo.find({
          where: { salesOrderId: id },
          order: { createdAt: 'DESC' },
        }),
      ]);

    return {
      ...order,
      approvalRecords,
      deliveryOrders,
      paymentRecords,
      productionOrders,
    };
  }

  async getAgingReport(tenantId?: string) {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .where('order.invoiced_amount > 0')
      .andWhere('order.status IN (:...statuses)', {
        statuses: ['shipped', 'completed'],
      });

    if (tenantId) {
      qb.andWhere('order.tenantId = :tenantId', { tenantId });
    }

    const orders = await qb.getMany();

    const customerMap = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        current: number;
        days1to30: number;
        days31to60: number;
        days61to90: number;
        days90plus: number;
        total: number;
      }
    >();

    const now = new Date();

    for (const order of orders) {
      const paid = Number(order.collectedAmount || 0);
      const invoiced = Number(order.invoicedAmount || 0);
      const outstanding = invoiced - paid;
      if (outstanding <= 0.001) continue;

      const dueDate = order.paymentDueDate
        ? new Date(order.paymentDueDate)
        : order.invoiceDate
          ? new Date(order.invoiceDate)
          : null;
      if (!dueDate) continue;

      const diffMs = now.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const cid = order.customerId;
      const cname = (order.customer as any)?.name || '-';

      if (!customerMap.has(cid)) {
        customerMap.set(cid, {
          customerId: cid,
          customerName: cname,
          current: 0,
          days1to30: 0,
          days31to60: 0,
          days61to90: 0,
          days90plus: 0,
          total: 0,
        });
      }

      const entry = customerMap.get(cid)!;
      if (diffDays <= 0) {
        entry.current += outstanding;
      } else if (diffDays <= 30) {
        entry.days1to30 += outstanding;
      } else if (diffDays <= 60) {
        entry.days31to60 += outstanding;
      } else if (diffDays <= 90) {
        entry.days61to90 += outstanding;
      } else {
        entry.days90plus += outstanding;
      }
      entry.total += outstanding;
    }

    return Array.from(customerMap.values()).sort((a, b) => b.total - a.total);
  }

  async getOverdueOrders(
    page: number = 1,
    pageSize: number = 20,
    tenantId?: string,
  ) {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .where('order.payment_due_date IS NOT NULL')
      .andWhere('order.payment_due_date < CURRENT_DATE')
      .andWhere('order.status IN (:...statuses)', {
        statuses: ['shipped', 'completed'],
      })
      .andWhere(
        '(order.invoiced_amount - COALESCE(order.collected_amount, 0)) > 0.001',
      )
      .orderBy('order.payment_due_date', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (tenantId) {
      qb.andWhere('order.tenantId = :tenantId', { tenantId });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async getCustomerStatement(customerId?: string) {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .where('order.status IN (:...statuses)', {
        statuses: ['approved', 'synced_jst', 'shipped', 'completed'],
      })
      .select([
        'customer.id as customer_id',
        'customer.name as customer_name',
        'SUM(order.pay_amount) as total_pay_amount',
        'SUM(COALESCE(order.collected_amount, 0)) as total_collected',
        'SUM(COALESCE(order.prepayment_deducted, 0)) as total_prepayment',
        'SUM(COALESCE(order.invoiced_amount, 0)) as total_invoiced',
      ])
      .groupBy('customer.id, customer.name');

    if (customerId) {
      qb.andWhere('order.customer_id = :customerId', { customerId });
    }

    const rows = await qb.getRawMany();

    const summary = rows.map((r: any) => ({
      customerId: r.customer_id,
      customerName: r.customer_name,
      totalPayAmount: Number(r.total_pay_amount || 0),
      totalCollected: Number(r.total_collected || 0),
      totalPrepayment: Number(r.total_prepayment || 0),
      totalInvoiced: Number(r.total_invoiced || 0),
      outstanding:
        Number(r.total_pay_amount || 0) -
        Number(r.total_collected || 0) -
        Number(r.total_prepayment || 0),
    }));

    let orders: any[] = [];
    if (customerId) {
      const orderQb = this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.customer', 'customer')
        .where('order.customer_id = :customerId', { customerId })
        .andWhere('order.status IN (:...statuses)', {
          statuses: ['approved', 'synced_jst', 'shipped', 'completed'],
        })
        .orderBy('order.created_at', 'DESC');

      orders = await orderQb.getMany();
    }

    return { summary, orders };
  }
}
