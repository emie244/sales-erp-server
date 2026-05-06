import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Product } from './entities/product.entity';
import { ProductSku } from './entities/product-sku.entity';
import { PricePolicy } from './entities/price-policy.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductSku, PricePolicy]),
    BullModule.registerQueue({ name: 'jushuitan-sync' }),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService, TypeOrmModule],
})
export class ProductsModule {}
