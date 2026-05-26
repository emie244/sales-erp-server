import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { SalesOrder } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { ProductsModule } from '../products/products.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { BomsModule } from '../boms/boms.module';
import { Customer } from '../customers/entities/customer.entity';
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { ApprovalRecord } from '../approvals/entities/approval-record.entity';
import { DeliveryOrder } from '../deliveries/entities/delivery-order.entity';
import { ProductionOrder } from '../production-orders/entities/production-order.entity';
import { ExportService } from '../common/services/export.service';
import { CommissionPolicy } from './policies/commission.policy';
import { OrderItemBuilder } from './builders/order-item.builder';
import { OrderLifecycle } from './services/order-lifecycle.service';
import { CollectionLifecycle } from './services/collection-lifecycle.service';
import { SalesOrderQueryService } from './services/sales-order-query.service';
import { SalesOrderApprovalHandler } from './handlers/sales-order-approval.handler';
import { CollectionApprovalHandler } from './handlers/collection-approval.handler';
import { ApprovalHandlerRegistry } from '../approvals/approval-handler.registry';
import { User } from '../users/entities/user.entity';
import { StocksModule } from '../stocks/stocks.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { PurchaseRequestsModule } from '../purchase-requests/purchase-requests.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesOrder,
      SalesOrderItem,
      Customer,
      PaymentRecord,
      ApprovalRecord,
      DeliveryOrder,
      ProductionOrder,
      User,
    ]),
    BullModule.registerQueue({ name: 'jushuitan-sync' }),
    ProductsModule,
    ApprovalsModule,
    IntegrationsModule,
    StocksModule,
    BomsModule,
    VouchersModule,
    DeliveriesModule,
    PurchaseRequestsModule,
  ],
  controllers: [SalesController],
  providers: [
    SalesService,
    ExportService,
    CommissionPolicy,
    OrderItemBuilder,
    OrderLifecycle,
    CollectionLifecycle,
    SalesOrderQueryService,
    SalesOrderApprovalHandler,
    CollectionApprovalHandler,
  ],
  exports: [SalesService, OrderLifecycle, CollectionLifecycle],
})
export class SalesModule implements OnModuleInit {
  constructor(
    private readonly registry: ApprovalHandlerRegistry,
    private readonly salesOrderHandler: SalesOrderApprovalHandler,
    private readonly collectionHandler: CollectionApprovalHandler,
  ) {}

  onModuleInit() {
    this.registry.register('sales_order', this.salesOrderHandler);
    this.registry.register('collection', this.collectionHandler);
  }
}
