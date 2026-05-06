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
  ) {}

  async salesSummary(filters?: {
    dateFrom?: string;
    dateTo?: string;
    signerId?: string;
    status?: string;
  }) {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .select("DATE_TRUNC('day', o.createdAt)", 'date')
      .addSelect('COUNT(*)', 'orderCount')
      .addSelect('SUM(o.payAmount)', 'totalPayAmount')
      .where("o.status IN ('approved', 'synced_jst', 'shipped', 'completed')")
      .groupBy("DATE_TRUNC('day', o.createdAt)")
      .orderBy('date', 'DESC');

    if (filters?.dateFrom) {
      qb.andWhere('o.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('o.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters?.signerId) {
      qb.andWhere('o.signerId = :signerId', { signerId: filters.signerId });
    }
    if (filters?.status) {
      qb.andWhere('o.status = :status', { status: filters.status });
    }

    return qb.getRawMany();
  }

  async totalOrderAmount(filters?: {
    dateFrom?: string;
    dateTo?: string;
    signerId?: string;
    status?: string;
  }) {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'orderCount')
      .addSelect('SUM(o.totalAmount)', 'totalAmount')
      .addSelect('SUM(o.payAmount)', 'payAmount')
      .addSelect('SUM(o.collectedAmount)', 'collectedAmount')
      .where("o.status IN ('approved', 'synced_jst', 'shipped', 'completed')");

    if (filters?.dateFrom) {
      qb.andWhere('o.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('o.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters?.signerId) {
      qb.andWhere('o.signerId = :signerId', { signerId: filters.signerId });
    }
    if (filters?.status) {
      qb.andWhere('o.status = :status', { status: filters.status });
    }

    const result = await qb.getRawOne();
    return {
      orderCount: Number(result?.orderCount || 0),
      totalAmount: Number(result?.totalAmount || 0),
      payAmount: Number(result?.payAmount || 0),
      collectedAmount: Number(result?.collectedAmount || 0),
    };
  }

  async paymentCollect(filters?: {
    dateFrom?: string;
    dateTo?: string;
  }) {
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

    return qb.getRawMany();
  }

  async totalCollectedAmount(filters?: {
    dateFrom?: string;
    dateTo?: string;
  }) {
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
    return { total: Number(result?.total || 0) };
  }

  async repAchievement() {
    return this.achievementRepo
      .createQueryBuilder('a')
      .select('a.userId', 'userId')
      .addSelect('SUM(a.achievementAmount)', 'total')
      .groupBy('a.userId')
      .orderBy('SUM(a.achievementAmount)', 'DESC')
      .getRawMany();
  }

  async signerRanking(filters?: {
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }) {
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

    if (filters?.dateFrom) {
      qb.andWhere('o.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('o.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters?.limit) {
      qb.limit(filters.limit);
    }

    return qb.getRawMany();
  }

  async productRanking(filters?: {
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }) {
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

    if (filters?.dateFrom) {
      qb.andWhere('order.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('order.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters?.limit) {
      qb.limit(filters.limit);
    }

    return qb.getRawMany();
  }

  async targetProgress(period?: string) {
    const now = new Date();
    const defaultPeriod = period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const targets = await this.targetRepo.find({
      where: { period: defaultPeriod },
    });

    const users = await this.userRepo.find();
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // Get actual sales for each user in this period
    const [year, month] = defaultPeriod.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(Number(year), Number(month), 1).toISOString();

    const actualSales = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.signerId', 'signerId')
      .addSelect('SUM(o.payAmount)', 'totalAmount')
      .where("o.status IN ('approved', 'synced_jst', 'shipped', 'completed')")
      .andWhere('o.signerId IS NOT NULL')
      .andWhere('o.createdAt >= :startDate', { startDate })
      .andWhere('o.createdAt < :endDate', { endDate })
      .groupBy('o.signerId')
      .getRawMany();

    const salesMap = new Map(
      actualSales.map((s) => [s.signerId, Number(s.totalAmount || 0)]),
    );

    // Combine targets with actual sales
    return targets.map((t) => {
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
  }
}
