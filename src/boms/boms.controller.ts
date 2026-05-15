import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { BomsService } from './boms.service';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';
import { Permissions } from '../auth/permissions.decorator';

@Controller('boms')
export class BomsController {
  constructor(
    private readonly service: BomsService,
    @InjectQueue('jushuitan-sync') private readonly syncQueue: Queue,
  ) {}

  @Permissions('bom:create')
  @Post()
  create(@Body() dto: CreateBomDto) {
    return this.service.create(dto);
  }

  @Permissions('bom:view')
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('productId') productId?: string,
    @Query('skuId') skuId?: string,
  ) {
    return this.service.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      keyword,
      productId,
      skuId,
    });
  }

  @Permissions('bom:view')
  @Get('sku/:skuId/active')
  findActiveBySku(@Param('skuId') skuId: string) {
    return this.service.findActiveBySku(skuId);
  }

  @Permissions('bom:view')
  @Get('sku/:skuId/with-stock')
  findBomsWithStockStatus(@Param('skuId') skuId: string) {
    return this.service.findBomsWithStockStatus(skuId);
  }

  @Permissions('bom:view')
  @Get('sku/:skuId')
  findBySku(@Param('skuId') skuId: string) {
    return this.service.findBySku(skuId);
  }

  @Permissions('bom:view')
  @Get('producible/products')
  findProducibleProducts() {
    return this.service.findProducibleProducts();
  }

  @Permissions('bom:view')
  @Get(':id/max-producible-qty')
  calculateMaxProducibleQty(@Param('id') id: string) {
    return this.service.calculateMaxProducibleQtyByPurchases(id);
  }

  @Permissions('bom:view')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Permissions('bom:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBomDto) {
    return this.service.update(id, dto);
  }

  @Permissions('bom:delete')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Permissions('bom:view')
  @Post('calculate-requirements')
  calculateRequirements(
    @Body()
    body: {
      items: { skuId: string; qty: number }[];
    },
  ) {
    return this.service.calculateMaterialRequirements(body.items);
  }

  @Permissions('admin:settings')
  @Post('sync-jushuitan')
  async syncJushuitan() {
    await this.syncQueue.add('sync-boms', {});
    return { message: 'BOM 同步任务已启动' };
  }
}
