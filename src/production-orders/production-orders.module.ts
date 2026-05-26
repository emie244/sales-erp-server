import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionOrder } from './entities/production-order.entity';
import { ProductionOrderItem } from './entities/production-order-item.entity';
import { ProductionOrderItemAllocation } from './entities/production-order-item-allocation.entity';
import { BomHeader } from '../boms/entities/bom-header.entity';
import { StockSnapshot } from '../stocks/entities/stock-snapshot.entity';
import { ProductSku } from '../products/entities/product-sku.entity';
import { ProductionOrdersService } from './production-orders.service';
import { ProductionOrdersController } from './production-orders.controller';
import { StocksModule } from '../stocks/stocks.module';
import { VouchersModule } from '../vouchers/vouchers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionOrder,
      ProductionOrderItem,
      ProductionOrderItemAllocation,
      BomHeader,
      StockSnapshot,
      ProductSku,
    ]),
    StocksModule,
    VouchersModule,
  ],
  controllers: [ProductionOrdersController],
  providers: [ProductionOrdersService],
  exports: [ProductionOrdersService],
})
export class ProductionOrdersModule {}
