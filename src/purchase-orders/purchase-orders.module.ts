import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { PurchaseOrderStatusLog } from './entities/purchase-order-status-log.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrderStatusLogsService } from './purchase-order-status-logs.service';
import { ApprovalsModule } from '../approvals/approvals.module';
import { ExportService } from '../common/services/export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrder,
      PurchaseOrderItem,
      PurchaseOrderStatusLog,
      Supplier,
    ]),
    ApprovalsModule,
  ],
  controllers: [PurchaseOrdersController],
  providers: [
    PurchaseOrdersService,
    PurchaseOrderStatusLogsService,
    ExportService,
  ],
  exports: [PurchaseOrdersService, PurchaseOrderStatusLogsService],
})
export class PurchaseOrdersModule {}
