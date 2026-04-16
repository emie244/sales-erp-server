import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { SubmitSalesOrderDto } from './dto/submit-sales-order.dto';

@Controller('sales-orders')
export class SalesController {
  constructor(private readonly service: SalesService) {}

  @Post()
  create(@Body() dto: CreateSalesOrderDto) {
    return this.service.create(dto, 'system');
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() dto: SubmitSalesOrderDto) {
    return this.service.submit(id, dto.feishuUserId, dto.approvalDefCode);
  }
}
