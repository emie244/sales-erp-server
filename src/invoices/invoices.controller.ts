import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceRecordDto } from './dto/create-invoice-record.dto';
import { UpdateInvoiceRecordDto } from './dto/update-invoice-record.dto';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Post()
  create(@Body() dto: CreateInvoiceRecordDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('salesOrderId') salesOrderId?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
      { salesOrderId, keyword, status },
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceRecordDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
