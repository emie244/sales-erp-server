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
  Res,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrderStatusLogsService } from './purchase-order-status-logs.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { Permissions } from '../auth/permissions.decorator';
import { ExportService } from '../common/services/export.service';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(
    private readonly service: PurchaseOrdersService,
    private readonly exportService: ExportService,
    private readonly statusLogsService: PurchaseOrderStatusLogsService,
  ) {}

  @Permissions('purchase_order:create')
  @Post()
  create(@Body() dto: CreatePurchaseOrderDto, @Request() req: ExpressRequest) {
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
  @Get('export')
  async export(
    @Res({ passthrough: true }) res: Response,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('keyword') keyword?: string,
  ) {
    const { data } = await this.service.findAll({
      page: 1,
      pageSize: 10000,
      status,
      supplierId,
      keyword,
    });

    const columns = [
      { header: '采购单号', key: 'orderNo', width: 22 },
      {
        header: '供应商',
        key: 'supplierName',
        width: 20,
        formatter: (_v: unknown, row: Record<string, unknown>) =>
          (row.supplier as { name?: string } | undefined)?.name ||
          row.supplierName ||
          '',
      },
      { header: '状态', key: 'status', width: 15 },
      { header: '总金额', key: 'totalAmount', width: 15 },
      { header: '备注', key: 'remark', width: 30 },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ];

    const buffer = await this.exportService.exportToExcel(
      data,
      columns,
      '采购单列表',
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="purchase-orders-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    });

    return buffer;
  }

  @Permissions('purchase_order:view')
  @Get('available-batches/:skuId')
  findAvailableBatches(@Param('skuId') skuId: string) {
    return this.service.findAvailableBatches(skuId);
  }

  @Permissions('purchase_order:view')
  @Get(':id/status-logs')
  findStatusLogs(@Param('id') id: string) {
    return this.statusLogsService.findByPurchaseOrderId(id);
  }

  @Permissions('purchase_order:submit')
  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @Body()
    body: {
      feishuUserId: string;
      approvalDefCode: string;
      feishuUserIdType?: string;
    },
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
}
