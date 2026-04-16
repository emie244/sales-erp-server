import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { SalesRepAchievement } from '../achievements/entities/sales-rep-achievement.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRepo: Repository<PaymentRecord>,
    @InjectRepository(SalesRepAchievement)
    private readonly achievementRepo: Repository<SalesRepAchievement>,
  ) {}

  async salesSummary() {
    return this.orderRepo
      .createQueryBuilder('o')
      .select("DATE_TRUNC('day', o.createdAt)", 'date')
      .addSelect('COUNT(*)', 'orderCount')
      .addSelect('SUM(o.payAmount)', 'totalPayAmount')
      .where("o.status IN ('approved', 'synced_jst', 'shipped', 'completed')")
      .groupBy("DATE_TRUNC('day', o.createdAt)")
      .orderBy('date', 'DESC')
      .getRawMany();
  }

  async paymentCollect() {
    return this.paymentRepo
      .createQueryBuilder('p')
      .select('p.method', 'method')
      .addSelect('SUM(p.amount)', 'total')
      .groupBy('p.method')
      .getRawMany();
  }

  async repAchievement() {
    return this.achievementRepo
      .createQueryBuilder('a')
      .select('a.userId', 'userId')
      .addSelect('SUM(a.achievementAmount)', 'total')
      .groupBy('a.userId')
      .orderBy('total', 'DESC')
      .getRawMany();
  }
}
