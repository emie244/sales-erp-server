import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import type { Request, Response } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { Permissions } from '../auth/permissions.decorator';
import { ExportService } from '../common/services/export.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly service: ProductsService,
    private readonly exportService: ExportService,
    @InjectQueue('jushuitan-sync') private readonly syncQueue: Queue,
  ) {}

  @Permissions('product:create')
  @Post()
  create(@Body() dto: CreateProductDto, @Req() req: Request) {
    const tenantId = req.user?.tenantId;
    return this.service.create(dto, tenantId);
  }

  @Permissions('product:view')
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Req() req: Request,
  ) {
    const tenantId = req.user?.tenantId;
    return this.service.findAll(page, pageSize, tenantId);
  }

  @Permissions('product:view')
  @Get('export')
  async export(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tenantId = req.user?.tenantId;
    const { data } = await this.service.findAll(1, 10000, tenantId);

    const columns = [
      { header: '产品名称', key: 'name', width: 30 },
      { header: '描述', key: 'description', width: 40 },
      { header: '分类', key: 'category', width: 15 },
      {
        header: 'SKU数量',
        key: 'skus',
        width: 12,
        formatter: (_v: unknown, row: Record<string, unknown>) =>
          Array.isArray(row.skus) ? row.skus.length : 0,
      },
      { header: '聚水潭ID', key: 'jstGoodsId', width: 18 },
      { header: '上市日期', key: 'launchDate', width: 15 },
      { header: '生命周期', key: 'lifecycleStage', width: 12 },
      { header: '状态', key: 'isActive', width: 10, formatter: (v: unknown) => (v ? '启用' : '禁用') },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ];

    const buffer = await this.exportService.exportToExcel(data, columns, '产品列表');

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    });

    return buffer;
  }

  @Get('all-skus')
  findAllSkus(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe) pageSize: number,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Req() req?: Request,
  ) {
    const tenantId = req?.user?.tenantId;
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

  @Permissions('product:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.service.update(id, dto);
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
