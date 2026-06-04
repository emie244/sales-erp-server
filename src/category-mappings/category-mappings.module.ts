import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryMapping } from './entities/category-mapping.entity';
import { CategoryMappingsService } from './category-mappings.service';
import { CategoryMappingsController } from './category-mappings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryMapping])],
  controllers: [CategoryMappingsController],
  providers: [CategoryMappingsService],
  exports: [CategoryMappingsService],
})
export class CategoryMappingsModule {}
