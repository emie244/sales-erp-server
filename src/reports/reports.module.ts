import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { SalesRepAchievement } from '../achievements/entities/sales-rep-achievement.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalesOrder, PaymentRecord, SalesRepAchievement]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
