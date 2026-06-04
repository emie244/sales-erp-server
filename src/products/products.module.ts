import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Product } from './entities/product.entity';
import { ProductSku } from './entities/product-sku.entity';
import { PricePolicy } from './entities/price-policy.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ExportService } from '../common/services/export.service';
import { ImportHistoricalMaterialsService } from './import-historical-materials.service';
import { SalesOrderItem } from '../sales/entities/sales-order-item.entity';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductSku, PricePolicy, SalesOrderItem, SalesOrder]),
    BullModule.registerQueue({ name: 'jushuitan-sync' }),
    NotificationsModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ExportService, ImportHistoricalMaterialsService],
  exports: [ProductsService, TypeOrmModule, ImportHistoricalMaterialsService],
})
export class ProductsModule {}
