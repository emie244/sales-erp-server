import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { PurchaseOrderStatusLog } from './entities/purchase-order-status-log.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrderStatusLogsService } from './purchase-order-status-logs.service';
import { ApprovalsModule } from '../approvals/approvals.module';
import { BomsModule } from '../boms/boms.module';
import { StocksModule } from '../stocks/stocks.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { ExportService } from '../common/services/export.service';
import { PurchaseOrderApprovalHandler } from './handlers/purchase-order-approval.handler';
import { ApprovalHandlerRegistry } from '../approvals/approval-handler.registry';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrder,
      PurchaseOrderItem,
      PurchaseOrderStatusLog,
      Supplier,
      SalesOrder,
    ]),
    ApprovalsModule,
    BomsModule,
    StocksModule,
    VouchersModule,
  ],
  controllers: [PurchaseOrdersController],
  providers: [
    PurchaseOrdersService,
    PurchaseOrderStatusLogsService,
    ExportService,
    PurchaseOrderApprovalHandler,
  ],
  exports: [PurchaseOrdersService, PurchaseOrderStatusLogsService],
})
export class PurchaseOrdersModule implements OnModuleInit {
  constructor(
    private readonly registry: ApprovalHandlerRegistry,
    private readonly handler: PurchaseOrderApprovalHandler,
  ) {}

  onModuleInit() {
    this.registry.register('purchase_order', this.handler);
  }
}
