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
import { PurchaseRequestsService } from './purchase-requests.service';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import { Permissions } from '../auth/permissions.decorator';

@Controller('purchase-requests')
export class PurchaseRequestsController {
  constructor(private readonly service: PurchaseRequestsService) {}

  @Permissions('purchase_request:create')
  @Post()
  create(
    @Body() dto: CreatePurchaseRequestDto,
    @Request() req: ExpressRequest,
  ) {
    return this.service.create(dto, req.user?.userId);
  }

  @Permissions('purchase_request:view')
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('salesOrderId') salesOrderId?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.service.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      status,
      salesOrderId,
      keyword,
    });
  }

  @Permissions('purchase_request:view')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Permissions('purchase_request:edit')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseRequestDto) {
    return this.service.update(id, dto);
  }

  @Permissions('purchase_request:delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Permissions('purchase_request:convert')
  @Post(':id/convert-to-po')
  convertToPo(@Param('id') id: string, @Request() req: ExpressRequest) {
    return this.service.convertToPo(id, req.user?.userId);
  }
}
