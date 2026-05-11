import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { MaterialCategoriesService } from './material-categories.service';
import { CreateMaterialCategoryDto } from './dto/create-material-category.dto';
import { UpdateMaterialCategoryDto } from './dto/update-material-category.dto';
import { Permissions } from '../auth/permissions.decorator';

@Controller('material-categories')
export class MaterialCategoriesController {
  constructor(private readonly service: MaterialCategoriesService) {}

  @Permissions('material_category:create')
  @Post()
  create(@Body() dto: CreateMaterialCategoryDto) {
    return this.service.create(dto);
  }

  @Permissions('material_category:view')
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Permissions('material_category:view')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Permissions('material_category:edit')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMaterialCategoryDto) {
    return this.service.update(id, dto);
  }

  @Permissions('material_category:delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
