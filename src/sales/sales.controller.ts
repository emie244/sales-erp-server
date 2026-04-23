import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Req,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
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
import { SalesOrder } from './entities/sales-order.entity';

@Controller('sales-orders')
export class SalesController {
  constructor(
    private readonly service: SalesService,
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    private readonly jstService: JushuitanService,
  ) {}

  @Post()
  @Permissions('order:create')
  create(@Body() dto: CreateSalesOrderDto, @Req() req: Request) {
    const userId = (req as any).user?.userId || 'system';
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('order:view')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query() query: QuerySalesOrderDto,
  ) {
    return this.service.findAll(page, pageSize, {
      status: query.status,
      type: query.type,
      customerId: query.customerId,
      creatorId: query.creatorId,
      signerId: query.signerId,
      keyword: query.keyword,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      minAmount: query.minAmount,
      maxAmount: query.maxAmount,
    });
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
  submitCollection(
    @Param('id') id: string,
    @Body() dto: SubmitCollectionDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.userId || 'system';
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
      relations: ['items', 'customer', 'signer'],
    });
    if (!order) throw new NotFoundException('Order not found');

    // 校验店铺ID配置
    if (!order.signer) {
      throw new BadRequestException('订单未指定签单人，请先选择签单人');
    }
    if (!order.signer.jushuitanShopId) {
      throw new BadRequestException(
        `签单人「${order.signer.name}」未配置聚水潭店铺ID，请联系管理员在「系统管理-用户管理」中配置`,
      );
    }

    const payload = this.jstService.buildSalesOrderPayload(order);

    try {
      const res = await this.jstService.createSalesOrder(order);
      const isSuccess = res?.code === 0 || res?.success;

      if (isSuccess) {
        // 更新订单状态
        order.status = 'synced_jst' as any;
        await this.orderRepo.save(order);
      }

      return {
        success: isSuccess,
        payload,
        response: res,
        jushuitanOrderId: res?.data?.datas?.[0]?.o_id || null,
      };
    } catch (err: any) {
      return {
        success: false,
        payload,
        error: err.message,
      };
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
}
