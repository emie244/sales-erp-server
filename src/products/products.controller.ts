import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
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
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Permissions('product:view')
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.service.findAll(page, pageSize);
  }

  @Get('all-skus')
  findAllSkus(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe) pageSize: number,
  ) {
    return this.service.findAllSkus(page, pageSize);
  }

  @Get('skus')
  async findSkus(@Query('productId') productId: string) {
    return this.service.findSkusByProductId(productId);
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
