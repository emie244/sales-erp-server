import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { CategoryMappingsService } from './category-mappings.service';
import { Permissions } from '../auth/permissions.decorator';

@Controller('category-mappings')
export class CategoryMappingsController {
  constructor(private readonly service: CategoryMappingsService) {}

  @Permissions('admin:settings')
  @Post()
  create(
    @Body() body: { erpCategory: string; jstCategory: string; jstCategoryId?: string },
  ) {
    return this.service.create(body);
  }

  @Permissions('product:view')
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Permissions('product:view')
  @Get(':erpCategory')
  findByErpCategory(@Param('erpCategory') erpCategory: string) {
    return this.service.findByErpCategory(erpCategory);
  }

  @Permissions('admin:settings')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<{ jstCategory: string; isActive: boolean }>) {
    return this.service.update(id, body);
  }

  @Permissions('admin:settings')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
