import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { Permissions } from '../auth/permissions.decorator';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Permissions('purchase_order:create')
  @Post()
  create(@Body() dto: CreatePurchaseOrderDto, @Request() req: any) {
    return this.service.create(dto, req.user?.userId);
  }

  @Permissions('purchase_order:view')
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.service.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      status,
      supplierId,
      keyword,
    });
  }

  @Permissions('purchase_order:view')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Permissions('purchase_order:edit')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.service.update(id, dto);
  }

  @Permissions('purchase_order:delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Permissions('purchase_order:submit')
  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @Body() body: { feishuUserId: string; approvalDefCode: string; feishuUserIdType?: string },
  ) {
    return this.service.submitForApproval(
      id,
      body.feishuUserId,
      body.approvalDefCode,
      body.feishuUserIdType,
    );
  }

  @Permissions('purchase_order:receive')
  @Post(':id/receive')
  receive(@Param('id') id: string, @Body() dto: ReceivePurchaseOrderDto) {
    return this.service.receive(id, dto);
  }
}
