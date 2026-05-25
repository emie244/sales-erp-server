import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialCategory } from './entities/material-category.entity';
import { ProductSku } from '../products/entities/product-sku.entity';
import { BomItem } from '../boms/entities/bom-item.entity';
import { MaterialCategoriesService } from './material-categories.service';
import { MaterialCategoriesController } from './material-categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MaterialCategory, ProductSku, BomItem])],
  controllers: [MaterialCategoriesController],
  providers: [MaterialCategoriesService],
  exports: [MaterialCategoriesService],
})
export class MaterialCategoriesModule {}
