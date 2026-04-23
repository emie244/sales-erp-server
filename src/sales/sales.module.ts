import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrder } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { ProductsModule } from '../products/products.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { Customer } from '../customers/entities/customer.entity';
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { ApprovalRecord } from '../approvals/entities/approval-record.entity';
import { DeliveryOrder } from '../deliveries/entities/delivery-order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesOrder,
      SalesOrderItem,
      Customer,
      PaymentRecord,
      ApprovalRecord,
      DeliveryOrder,
    ]),
    ProductsModule,
    ApprovalsModule,
    IntegrationsModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
