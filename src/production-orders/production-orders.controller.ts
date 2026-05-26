import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ProductionOrdersService } from './production-orders.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { CompleteProductionOrderDto } from './dto/complete-production-order.dto';
import { Permissions } from '../auth/permissions.decorator';

@Controller('production-orders')
export class ProductionOrdersController {
  constructor(private readonly service: ProductionOrdersService) {}

  @Permissions('production_order:create')
  @Post()
  create(
    @Body() dto: CreateProductionOrderDto,
    @Request() req: ExpressRequest,
  ) {
    return this.service.create(dto, req.user?.userId);
  }

  @Permissions('production_order:view')
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('salesOrderId') salesOrderId?: string,
  ) {
    return this.service.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      status,
      keyword,
      salesOrderId,
    });
  }

  @Permissions('production_order:view')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Permissions('production_order:edit')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductionOrderDto) {
    return this.service.update(id, dto);
  }

  @Permissions('production_order:delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Permissions('production_order:complete')
  @Post(':id/complete')
  complete(@Param('id') id: string, @Body() dto?: CompleteProductionOrderDto) {
    return this.service.complete(id, dto);
  }
}
