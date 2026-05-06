import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import type { Request } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { Permissions } from '../auth/permissions.decorator';


@Controller('products')
export class ProductsController {
  constructor(
    private readonly service: ProductsService,
    @InjectQueue('jushuitan-sync') private readonly syncQueue: Queue,
  ) {}

  @Permissions('product:create')
  @Post()
  create(@Body() dto: CreateProductDto, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.service.create(dto, tenantId);
  }

  @Permissions('product:view')
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).user?.tenantId;
    return this.service.findAll(page, pageSize, tenantId);
  }

  @Get('all-skus')
  findAllSkus(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe) pageSize: number,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Req() req?: Request,
  ) {
    const tenantId = (req as any).user?.tenantId;
    return this.service.findAllSkus(page, pageSize, tenantId, keyword, status);
  }

  @Get('skus')
  async findSkus(@Query('productId') productId: string) {
    return this.service.findSkusByProductId(productId);
  }

  @Get('skus/:skuId')
  async findSkuById(@Param('skuId') skuId: string) {
    return this.service.findSkuById(skuId);
  }

  @Get('skus/:skuId/price')
  async getPrice(@Param('skuId') skuId: string, @Query('level') level: string) {
    const price = await this.service.getPrice(skuId, level || 'C');
    return { skuId, level: level || 'C', price };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('prices')
  setPrice(@Body() dto: SetPriceDto) {
    return this.service.setPrice(dto);
  }

  @Post('sync-jushuitan')
  async syncJushuitan() {
    await this.syncQueue.add('sync-skus', { daysBack: 3650 });
    return { message: '同步任务已启动' };
  }
}
