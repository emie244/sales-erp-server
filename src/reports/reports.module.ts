import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { SalesRepAchievement } from '../achievements/entities/sales-rep-achievement.entity';
import { SalesOrderItem } from '../sales/entities/sales-order-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { SalesTarget } from './entities/sales-target.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { TargetsController } from './targets.controller';
import { TargetsService } from './targets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesOrder,
      SalesOrderItem,
      PaymentRecord,
      SalesRepAchievement,
      Product,
      User,
      SalesTarget,
    ]),
  ],
  controllers: [ReportsController, TargetsController],
  providers: [ReportsService, TargetsService],
  exports: [ReportsService, TargetsService],
})
export class ReportsModule {}
