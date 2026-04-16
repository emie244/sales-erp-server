import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductSku } from './entities/product-sku.entity';
import { PricePolicy } from './entities/price-policy.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductSku, PricePolicy])],
  exports: [TypeOrmModule],
})
export class ProductsModule {}
