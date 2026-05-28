import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Req,
  Query,
  Res,
  ParseIntPipe,
  DefaultValuePipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw, IsNull, Not } from 'typeorm';
import type { Request, Response } from 'express';
import { Permissions } from '../auth/permissions.decorator';
import { SalesService } from './sales.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { SubmitSalesOrderDto } from './dto/submit-sales-order.dto';
import { SubmitCollectionDto } from './dto/submit-collection.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { QuerySalesOrderDto } from './dto/query-sales-order.dto';
import { BatchSubmitDto } from './dto/batch-submit.dto';
import { BatchPushJushuitanDto } from './dto/batch-push-jushuitan.dto';
import { JushuitanService } from '../integrations/jushuitan.service';
import { ExportService } from '../common/services/export.service';
import { SalesOrder, SalesOrderStatus } from './entities/sales-order.entity';
import { SalesOrderQueryService } from './services/sales-order-query.service';
import { OrderTrackingService } from './services/order-tracking.service';

@Controller('sales-orders')
export class SalesController {
  constructor(
    private readonly service: SalesService,
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    private readonly jstService: JushuitanService,
    private readonly exportService: ExportService,
    private readonly queryService: SalesOrderQueryService,
    private readonly trackingService: OrderTrackingService,
  ) {}

  @Post()
  @Permissions('order:create')
  create(@Body() dto: CreateSalesOrderDto, @Req() req: Request) {
    const user = req.user;
    return this.service.create(dto, user?.userId || 'system', user?.tenantId);
  }

  @Get()
  @Permissions('order:view')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query() query: QuerySalesOrderDto,
    @Req() req: Request,
  ) {
    const tenantId = req.user?.tenantId;
    return this.service.findAll(page, pageSize, {
      status: query.status,
      type: query.type,
      customerId: query.customerId,
      creatorId: query.creatorId,
      salespersonId: query.salespersonId,
      migrationSource: query.migrationSource,
      keyword: query.keyword,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      minAmount: query.minAmount,
      maxAmount: query.maxAmount,
      tenantId,
    });
  }

  @Get('export')
  @Permissions('order:view')
  async export(
    @Query() query: QuerySalesOrderDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const tenantId = req.user?.tenantId;
    const { data } = await this.service.findAll(1, 10000, {
      status: query.status,
      type: query.type,
      customerId: query.customerId,
      creatorId: query.creatorId,
      salespersonId: query.salespersonId,
      migrationSource: query.migrationSource,
      keyword: query.keyword,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      minAmount: query.minAmount,
      maxAmount: query.maxAmount,
      tenantId,
    });

    const columns = [
      { header: '订单ID', key: 'id', width: 36 },
      { header: '订单编号', key: 'orderNo', width: 18 },
      {
        header: '订单类型',
        key: 'type',
        width: 15,
        formatter: (v: unknown) =>
          v === 'overseas' ? '海外提货单' : '销售订单',
      },
      { header: '订单状态', key: 'status', width: 15 },
      {
        header: '来源',
        key: 'migrationSource',
        width: 15,
        formatter: (v: unknown) =>
          v === 'feishu-base' ? '历史迁移' : '本系统',
      },
      {
        header: '客户名称',
        key: 'customer',
        width: 25,
        formatter: (_v: unknown, row: Record<string, unknown>) =>
          (row as { customer?: { name?: string } }).customer?.name || '',
      },
      {
        header: '业务员',
        key: 'salesperson',
        width: 15,
        formatter: (_v: unknown, row: Record<string, unknown>) =>
          (row as { salesperson?: { name?: string } }).salesperson?.name || '',
      },
      { header: '订单金额', key: 'totalAmount', width: 15 },
      { header: '已回款', key: 'collectedAmount', width: 15 },
      { header: '预付款抵扣', key: 'prepaymentDeducted', width: 15 },
      { header: '收货人', key: 'consignee', width: 15 },
      { header: '收货电话', key: 'consigneePhone', width: 18 },
      { header: '收货地址', key: 'consigneeAddress', width: 40 },
      { header: '物流公司', key: 'logisticsCompany', width: 20 },
      { header: '快递单号', key: 'expressNo', width: 20 },
      { header: '备注', key: 'remark', width: 30 },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ];

    const buffer = await this.exportService.exportToExcel(
      data,
      columns,
      '销售订单',
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="sales-orders-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    });

    return buffer;
  }

  @Get(':id')
  @Permissions('order:view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/submit')
  @Permissions('order:submit')
  submit(@Param('id') id: string, @Body() dto: SubmitSalesOrderDto) {
    return this.service.submit(
      id,
      dto.feishuUserId,
      dto.approvalDefCode,
      dto.feishuUserIdType,
    );
  }

  @Post(':id/collection')
  @Permissions('order:collect')
  submitCollection(@Param('id') id: string, @Body() dto: SubmitCollectionDto) {
    return this.service.submitCollectionForApproval(
      id,
      dto,
      dto.feishuUserId,
      dto.approvalDefCode,
      dto.feishuUserIdType,
    );
  }

  @Put(':id')
  @Permissions('order:edit')
  update(@Param('id') id: string, @Body() dto: UpdateSalesOrderDto) {
    return this.service.updateOrder(id, dto);
  }

  @Put(':id/collection')
  @Permissions('order:collect')
  updateCollection(@Param('id') id: string, @Body() dto: CreateCollectionDto) {
    return this.service.updateCollection(id, dto);
  }

  @Post(':id/push-jushuitan')
  @Permissions('order:push_jst')
  async pushJushuitan(@Param('id') id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items', 'customer', 'salesperson'],
    });
    if (!order) throw new NotFoundException('Order not found');

    // 校验店铺ID配置
    if (!order.salesperson) {
      throw new BadRequestException('订单未指定业务员，请先选择业务员');
    }
    if (!order.salesperson.jushuitanShopId) {
      throw new BadRequestException(
        `业务员「${order.salesperson.name}」未配置聚水潭店铺ID，请联系管理员在「系统管理-用户管理」中配置`,
      );
    }

    const payload = this.jstService.buildSalesOrderPayload(order);

    try {
      const res = await this.jstService.createSalesOrder(order);
      const r = res as Record<string, unknown>;
      const isSuccess = r?.code === 0 || r?.success === true;

      if (isSuccess) {
        // 更新订单状态
        order.status = SalesOrderStatus.SYNCED_JST;
        await this.orderRepo.save(order);
      }

      return {
        success: isSuccess,
        payload,
        response: res,
        jushuitanOrderId:
          ((
            ((res as Record<string, unknown>)?.data as Record<string, unknown>)
              ?.datas as Record<string, unknown>[] | undefined
          )?.[0]?.o_id as string) || null,
      };
    } catch (err: unknown) {
      throw new BadRequestException(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  @Post('batch-submit')
  @Permissions('order:submit')
  batchSubmit(@Body() dto: BatchSubmitDto) {
    return this.service.batchSubmit(
      dto.ids,
      dto.feishuUserId,
      dto.approvalDefCode,
      dto.feishuUserIdType,
    );
  }

  @Post('batch-push-jushuitan')
  @Permissions('order:push_jst')
  batchPushJushuitan(@Body() dto: BatchPushJushuitanDto) {
    return this.service.batchPushJushuitan(dto.ids);
  }

  @Get('reports/aging')
  @Permissions('order:view')
  getAgingReport(@Query('keyword') keyword?: string, @Req() req?: Request) {
    return this.service.getAgingReport(req?.user?.tenantId, keyword);
  }

  @Get('reports/overdue')
  @Permissions('order:view')
  getOverdueOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Req() req: Request,
  ) {
    return this.service.getOverdueOrders(page, pageSize, req.user?.tenantId);
  }

  @Get('warnings/delivery')
  @Permissions('order:view')
  async getDeliveryWarnings(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    const [data, total] = await this.orderRepo.findAndCount({
      where: { deliveryWarning: Not(IsNull()) },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, pageSize };
  }

  @Get('reports/customer-statement')
  @Permissions('order:view')
  getCustomerStatement(
    @Query('customerId') customerId?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.queryService.getCustomerStatement(customerId, keyword);
  }

  @Get(':id/production-suggestion')
  @Permissions('order:view')
  getProductionSuggestion(@Param('id') id: string) {
    return this.service.getProductionSuggestion(id);
  }

  @Get(':id/tracking')
  @Permissions('order:view')
  getTracking(@Param('id') id: string) {
    return this.trackingService.getTracking(id);
  }
}
