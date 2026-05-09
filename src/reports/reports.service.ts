import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { SalesRepAchievement } from '../achievements/entities/sales-rep-achievement.entity';
import { SalesOrderItem } from '../sales/entities/sales-order-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { SalesTarget } from './entities/sales-target.entity';
import { ReportsCacheService } from './reports-cache.service';
import { StockSnapshot } from '../stocks/entities/stock-snapshot.entity';
import { ApprovalRecord } from '../approvals/entities/approval-record.entity';

export interface ReportUser {
  userId: string;
  role: string;
  permissions: string[];
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    @InjectRepository(SalesOrderItem)
    private readonly itemRepo: Repository<SalesOrderItem>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRepo: Repository<PaymentRecord>,
    @InjectRepository(SalesRepAchievement)
    private readonly achievementRepo: Repository<SalesRepAchievement>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(SalesTarget)
    private readonly targetRepo: Repository<SalesTarget>,
    @InjectRepository(StockSnapshot)
    private readonly stockRepo: Repository<StockSnapshot>,
    @InjectRepository(ApprovalRecord)
    private readonly approvalRepo: Repository<ApprovalRecord>,
    private readonly cache: ReportsCacheService,
  ) {}

  private isAdmin(user: ReportUser): boolean {
    return user.role === 'admin' || user.permissions.includes('*');
  }

  private applySignerFilter(
    qb: any,
    user: ReportUser,
    alias: string = 'o',
  ): void {
    if (!this.isAdmin(user)) {
      qb.andWhere(`${alias}.signerId = :currentUserId`, {
        currentUserId: user.userId,
      });
    }
  }

  async salesSummary(
    user: ReportUser,
    filters?: {
      dateFrom?: string;
      dateTo?: string;
      signerId?: string;
      status?: string;
    },
  ) {
    const cacheKey = { type: 'salesSummary', userId: user.userId, ...filters };
    const cached = await this.cache.get<any[]>('salesSummary', user.userId, cacheKey);
    if (cached) return cached;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.signer', 'signer')
      .leftJoin('o.items', 'i')
      .select("DATE_TRUNC('day', o.createdAt)", 'date')
      .addSelect('o.signerId', 'signerId')
      .addSelect('signer.name', 'signerName')
      .addSelect('COUNT(DISTINCT o.id)', 'orderCount')
      .addSelect('SUM(o.payAmount)', 'totalPayAmount')
      .addSelect('SUM(i.commissionAmount)', 'totalCommissionAmount')
      .where("o.status IN ('approved', 'synced_jst', 'shipped', 'completed')")
      .groupBy("DATE_TRUNC('day', o.createdAt)")
      .addGroupBy('o.signerId')
      .addGroupBy('signer.name')
      .orderBy('date', 'DESC');

    this.applySignerFilter(qb, user);

    if (filters?.dateFrom) {
      qb.andWhere('o.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('o.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }
    if (this.isAdmin(user) && filters?.signerId) {
      qb.andWhere('o.signerId = :signerId', { signerId: filters.signerId });
    }
    if (filters?.status) {
      qb.andWhere('o.status = :status', { status: filters.status });
    }

    const result = await qb.getRawMany();
    await this.cache.set('salesSummary', user.userId, cacheKey, result);
    return result;
  }

  async totalOrderAmount(
    user: ReportUser,
    filters?: {
      dateFrom?: string;
      dateTo?: string;
      signerId?: string;
      status?: string;
    },
  ) {
    const cacheKey = { type: 'totalOrderAmount', userId: user.userId, ...filters };
    const cached = await this.cache.get<any>('totalOrderAmount', user.userId, cacheKey);
    if (cached) return cached;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'orderCount')
      .addSelect('SUM(o.totalAmount)', 'totalAmount')
      .addSelect('SUM(o.payAmount)', 'payAmount')
      .addSelect('SUM(o.collectedAmount)', 'collectedAmount')
      .where("o.status IN ('approved', 'synced_jst', 'shipped', 'completed')");

    this.applySignerFilter(qb, user);

    if (filters?.dateFrom) {
      qb.andWhere('o.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('o.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }
    if (this.isAdmin(user) && filters?.signerId) {
      qb.andWhere('o.signerId = :signerId', { signerId: filters.signerId });
    }
    if (filters?.status) {
      qb.andWhere('o.status = :status', { status: filters.status });
    }

    const result = await qb.getRawOne();
    const data = {
      orderCount: Number(result?.orderCount || 0),
      totalAmount: Number(result?.totalAmount || 0),
      payAmount: Number(result?.payAmount || 0),
      collectedAmount: Number(result?.collectedAmount || 0),
    };
    await this.cache.set('totalOrderAmount', user.userId, cacheKey, data);
    return data;
  }

  async paymentCollect(
    user: ReportUser,
    filters?: {
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const cacheKey = { type: 'paymentCollect', userId: user.userId, ...filters };
    const cached = await this.cache.get<any[]>('paymentCollect', user.userId, cacheKey);
    if (cached) return cached;

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .select('p.method', 'method')
      .addSelect('SUM(p.amount)', 'total')
      .groupBy('p.method');

    if (filters?.dateFrom) {
      qb.andWhere('p.receivedAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('p.receivedAt <= :dateTo', { dateTo: filters.dateTo });
    }

    const result = await qb.getRawMany();
    await this.cache.set('paymentCollect', user.userId, cacheKey, result);
    return result;
  }

  async totalCollectedAmount(
    user: ReportUser,
    filters?: {
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const cacheKey = { type: 'totalCollectedAmount', userId: user.userId, ...filters };
    const cached = await this.cache.get<any>('totalCollectedAmount', user.userId, cacheKey);
    if (cached) return cached;

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total');

    if (filters?.dateFrom) {
      qb.andWhere('p.receivedAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('p.receivedAt <= :dateTo', { dateTo: filters.dateTo });
    }

    const result = await qb.getRawOne();
    const data = { total: Number(result?.total || 0) };
    await this.cache.set('totalCollectedAmount', user.userId, cacheKey, data);
    return data;
  }

  async paymentRecords(
    user: ReportUser,
    filters?: {
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoin(SalesOrder, 'o', 'o.id = p.sales_order_id')
      .leftJoin('o.signer', 'signer')
      .select('p.id', 'id')
      .addSelect('p.amount', 'amount')
      .addSelect('p.method', 'method')
      .addSelect('p.receivedAt', 'receivedAt')
      .addSelect('p.salesOrderId', 'salesOrderId')
      .addSelect('signer.name', 'signerName')
      .orderBy('p.receivedAt', 'DESC');

    if (filters?.dateFrom) {
      qb.andWhere('p.receivedAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('p.receivedAt <= :dateTo', { dateTo: filters.dateTo });
    }

    if (!this.isAdmin(user)) {
      qb.andWhere('o.signer_id = :currentUserId', { currentUserId: user.userId });
    }

    return qb.getRawMany();
  }

  async repAchievement(user: ReportUser) {
    const cacheKey = { type: 'repAchievement', userId: user.userId };
    const cached = await this.cache.get<any[]>('repAchievement', user.userId, cacheKey);
    if (cached) return cached;

    const qb = this.achievementRepo
      .createQueryBuilder('a')
      .leftJoin(User, 'u', 'CAST(u.id AS VARCHAR) = a.userId')
      .select('a.userId', 'userId')
      .addSelect('u.name', 'userName')
      .addSelect('SUM(a.achievementAmount)', 'total')
      .groupBy('a.userId')
      .addGroupBy('u.name')
      .orderBy('SUM(a.achievementAmount)', 'DESC');

    if (!this.isAdmin(user)) {
      qb.andWhere('a.userId = :currentUserId', { currentUserId: user.userId });
    }

    const result = await qb.getRawMany();
    await this.cache.set('repAchievement', user.userId, cacheKey, result);
    return result;
  }

  async signerRanking(
    user: ReportUser,
    filters?: {
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    },
  ) {
    const cacheKey = { type: 'signerRanking', userId: user.userId, ...filters };
    const cached = await this.cache.get<any[]>('signerRanking', user.userId, cacheKey);
    if (cached) return cached;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.signer', 'signer')
      .select('o.signerId', 'signerId')
      .addSelect('signer.name', 'signerName')
      .addSelect('COUNT(*)', 'orderCount')
      .addSelect('SUM(o.payAmount)', 'totalAmount')
      .where("o.status IN ('approved', 'synced_jst', 'shipped', 'completed')")
      .andWhere('o.signerId IS NOT NULL')
      .groupBy('o.signerId')
      .addGroupBy('signer.name')
      .orderBy('SUM(o.payAmount)', 'DESC');

    this.applySignerFilter(qb, user);

    if (filters?.dateFrom) {
      qb.andWhere('o.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('o.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters?.limit) {
      qb.limit(filters.limit);
    }

    const result = await qb.getRawMany();
    await this.cache.set('signerRanking', user.userId, cacheKey, result);
    return result;
  }

  async productRanking(
    user: ReportUser,
    filters?: {
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    },
  ) {
    const cacheKey = { type: 'productRanking', userId: user.userId, ...filters };
    const cached = await this.cache.get<any[]>('productRanking', user.userId, cacheKey);
    if (cached) return cached;

    const qb = this.itemRepo
      .createQueryBuilder('i')
      .leftJoin('i.order', 'order')
      .select('i.productId', 'productId')
      .addSelect('i.productName', 'productName')
      .addSelect('SUM(i.qty)', 'totalQty')
      .addSelect('SUM(i.lineAmount)', 'totalAmount')
      .where("order.status IN ('approved', 'synced_jst', 'shipped', 'completed')")
      .andWhere('i.productId IS NOT NULL')
      .groupBy('i.productId')
      .addGroupBy('i.productName')
      .orderBy('SUM(i.lineAmount)', 'DESC');

    if (!this.isAdmin(user)) {
      qb.andWhere('order.signerId = :currentUserId', {
        currentUserId: user.userId,
      });
    }

    if (filters?.dateFrom) {
      qb.andWhere('order.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('order.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters?.limit) {
      qb.limit(filters.limit);
    }

    const result = await qb.getRawMany();
    await this.cache.set('productRanking', user.userId, cacheKey, result);
    return result;
  }

  async targetProgress(user: ReportUser, period?: string) {
    const cacheKey = { type: 'targetProgress', userId: user.userId, period: period || 'current' };
    const cached = await this.cache.get<any[]>('targetProgress', user.userId, cacheKey);
    if (cached) return cached;

    const now = new Date();
    const defaultPeriod = period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const targets = await this.targetRepo.find({
      where: { period: defaultPeriod },
    });

    const users = await this.userRepo.find();
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const [year, month] = defaultPeriod.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(Number(year), Number(month), 1).toISOString();

    const actualSalesQb = this.orderRepo
      .createQueryBuilder('o')
      .select('o.signerId', 'signerId')
      .addSelect('SUM(o.payAmount)', 'totalAmount')
      .where("o.status IN ('approved', 'synced_jst', 'shipped', 'completed')")
      .andWhere('o.signerId IS NOT NULL')
      .andWhere('o.createdAt >= :startDate', { startDate })
      .andWhere('o.createdAt < :endDate', { endDate });

    if (!this.isAdmin(user)) {
      actualSalesQb.andWhere('o.signerId = :currentUserId', {
        currentUserId: user.userId,
      });
    }

    const actualSales = await actualSalesQb
      .groupBy('o.signerId')
      .getRawMany();

    const salesMap = new Map(
      actualSales.map((s) => [s.signerId, Number(s.totalAmount || 0)]),
    );

    let filteredTargets = targets;
    if (!this.isAdmin(user)) {
      filteredTargets = targets.filter((t) => t.userId === user.userId);
    }

    const result = filteredTargets.map((t) => {
      const actual = salesMap.get(t.userId) || 0;
      const targetAmount = Number(t.targetAmount || 0);
      return {
        userId: t.userId,
        userName: t.userName || userMap.get(t.userId) || t.userId,
        targetAmount,
        actualAmount: actual,
        progress: targetAmount > 0 ? Math.min((actual / targetAmount) * 100, 100) : 0,
        period: t.period,
      };
    });

    await this.cache.set('targetProgress', user.userId, cacheKey, result);
    return result;
  }

  async dashboardStats(user: ReportUser) {
    const today = new Date().toISOString().split('T')[0];

    // 今日订单数
    const todayOrdersQb = this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'count')
      .where("DATE(o.created_at) = :today", { today });
    this.applySignerFilter(todayOrdersQb, user);
    const todayOrders = await todayOrdersQb.getRawOne();

    // 待发货数 (approved 状态)
    const pendingShipmentQb = this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'count')
      .where("o.status = 'approved'");
    this.applySignerFilter(pendingShipmentQb, user);
    const pendingShipment = await pendingShipmentQb.getRawOne();

    // 待审批数 + 列表
    const approvalsQb = this.approvalRepo
      .createQueryBuilder('a')
      .leftJoin('a.salesOrder', 'so')
      .select('a.id', 'id')
      .addSelect('a.feishuInstanceCode', 'instanceCode')
      .addSelect('a.type', 'type')
      .addSelect('a.createdAt', 'createdAt')
      .addSelect('so.id', 'salesOrderId')
      .where("a.status = 'pending'");

    if (!this.isAdmin(user)) {
      approvalsQb.andWhere('so.signerId = :currentUserId', {
        currentUserId: user.userId,
      });
    }

    const approvals = await approvalsQb
      .orderBy('a.createdAt', 'DESC')
      .limit(5)
      .getRawMany();

    // 低库存数: warning + danger
    const lowStockQuery = `
      SELECT COUNT(*) as count
      FROM stock_snapshots s
      WHERE s."availableQty" < s.safety_stock
        AND s.safety_stock > 0
    `;
    const lowStockRaw = await this.stockRepo.query(lowStockQuery);
    const lowStockCount = Number(lowStockRaw[0]?.count || 0);

    return {
      todayOrders: Number(todayOrders?.count || 0),
      pendingShipment: Number(pendingShipment?.count || 0),
      pendingApprovals: approvals.length,
      pendingList: approvals,
      lowStockCount,
    };
  }
}
