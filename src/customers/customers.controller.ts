import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Query,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { Permissions } from '../auth/permissions.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Post()
  @Permissions('customer:create')
  create(@Body() dto: CreateCustomerDto, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.service.create(dto, tenantId);
  }

  @Get()
  @Permissions('customer:view')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).user?.tenantId;
    return this.service.findAll(page, pageSize, tenantId);
  }

  @Get(':id')
  @Permissions('customer:view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permissions('customer:edit')
  update(@Param('id') id: string, @Body() dto: CreateCustomerDto) {
    return this.service.update(id, dto);
  }

  @Get(':id/orders')
  async findOrders(@Param('id') id: string) {
    return [];
  }
}
