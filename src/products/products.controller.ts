import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  DefaultValuePipe,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import type { Request, Response } from 'express';
import { ProductsService } from './products.service';
import { ImportHistoricalMaterialsService } from './import-historical-materials.service';
import { CreateProductDto } from './dto/create-product.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { Permissions } from '../auth/permissions.decorator';
import { Public } from '../auth/public.decorator';
import { ExportService } from '../common/services/export.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly service: ProductsService,
    private readonly exportService: ExportService,
    private readonly importService: ImportHistoricalMaterialsService,
    @InjectQueue('jushuitan-sync') private readonly syncQueue: Queue,
  ) {}

  @Permissions('product:create')
  @Post()
  create(
    @Body() dto: CreateProductDto,
    @Req() req: Request,
    @Query('mode') mode?: string,
  ) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId as string;
    const createMode = mode === 'step' ? 'step' : 'quick';
    return this.service.create(dto, tenantId, createMode, userId);
  }

  @Permissions('product:create')
  @Post(':id/skus')
  async addSkuToProduct(
    @Param('id') productId: string,
    @Body() dto: any,
    @Req() req: Request,
  ) {
    const userId = req.user?.userId as string;
    return this.service.addSkuToProduct(productId, dto, userId);
  }

  @Permissions('product:view')
  @Get('drafts')
  findDrafts(
    @Req() req: Request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    const tenantId = req.user?.tenantId;
    return this.service.findDrafts(page, pageSize, tenantId);
  }

  @Permissions('product:view')
  @Get()
  async findAll(
    @Req() req: Request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('keyword') keyword?: string,
    @Query('sortField') sortField?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
    @Query('lifecycleStage') lifecycleStage?: string,
    @Query('brand') brand?: string,
    @Query('itemTypes') itemTypes?: string,
  ) {
    const tenantId = req.user?.tenantId;
    const activeFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    const types = itemTypes ? itemTypes.split(',') : undefined;
    return this.service.findAll(
      page,
      pageSize,
      tenantId,
      keyword,
      sortField,
      sortOrder,
      category,
      activeFilter,
      lifecycleStage,
      brand,
      types,
    );
  }

  @Permissions('product:view')
  @Get('export')
  async export(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
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
      {
        header: '状态',
        key: 'isActive',
        width: 10,
        formatter: (v: unknown) => (v ? '启用' : '禁用'),
      },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ];

    const buffer = await this.exportService.exportToExcel(
      data,
      columns,
      '产品列表',
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
    @Query('governance') governance?: string,
    @Query('itemTypes') itemTypes?: string,
    @Query('excludeTypes') excludeTypes?: string,
    @Req() req?: Request,
  ) {
    const tenantId = req?.user?.tenantId;
    const types = itemTypes ? itemTypes.split(',') : undefined;
    const excludes = excludeTypes ? excludeTypes.split(',') : undefined;
    return this.service.findAllSkus(
      page,
      pageSize,
      tenantId,
      keyword,
      status,
      governance as 'uncategorized' | 'item_type_null' | 'non_compliant',
      types,
      excludes,
    );
  }

  @Permissions('product:view')
  @Get('all-skus/export')
  async exportAllSkus(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('governance') governance?: string,
    @Query('itemTypes') itemTypes?: string,
    @Query('excludeTypes') excludeTypes?: string,
  ) {
    const tenantId = req.user?.tenantId;
    const types = itemTypes ? itemTypes.split(',') : undefined;
    const excludes = excludeTypes ? excludeTypes.split(',') : undefined;
    const { data } = await this.service.findAllSkus(
      1,
      10000,
      tenantId,
      keyword,
      status,
      governance as 'uncategorized' | 'item_type_null' | 'non_compliant',
      types,
      excludes,
    );

    const itemTypeMap: Record<string, string> = {
      finished_good: '成品',
      semi_finished: '半成品',
      raw_material: '原材料',
      packaging: '包材',
    };

    const columns = [
      { header: 'SKU编码', key: 'skuCode', width: 20 },
      { header: 'SKU名称', key: 'skuName', width: 30 },
      { header: '产品名称', key: 'productName', width: 30 },
      { header: '分类', key: 'category', width: 15 },
      { header: '品牌', key: 'brand', width: 15 },
      { header: '物料类型', key: 'itemTypeLabel', width: 12 },
      { header: '物料分类', key: 'materialCategoryName', width: 15 },
      { header: '销售价', key: 'salePrice', width: 12 },
      { header: '成本价', key: 'costPrice', width: 12 },
      { header: '底价', key: 'floorPrice', width: 12 },
      { header: '本地库存', key: 'localStockQty', width: 12 },
      { header: '可用总库存', key: 'totalAvailableQty', width: 12 },
      { header: '在途数量', key: 'inTransitQty', width: 12 },
      { header: 'BOM需求', key: 'bomDemandQty', width: 12 },
      { header: '重量(kg)', key: 'weight', width: 12 },
      { header: '状态', key: 'isActive', width: 10 },
      { header: '同步状态', key: 'syncStatus', width: 12 },
    ];

    const exportData = (data as any[]).map((sku) => ({
      skuCode: sku.skuCode || '-',
      skuName: sku.skuName || '-',
      productName: sku.product?.name || '-',
      category: sku.category || '-',
      brand: sku.brand || '-',
      itemTypeLabel: itemTypeMap[sku.itemType] || '-',
      materialCategoryName: sku.materialCategoryName || '-',
      salePrice: sku.salePrice ?? '',
      costPrice: sku.costPrice ?? '',
      floorPrice: sku.floorPrice ?? '',
      localStockQty: Number(sku.localStockQty || 0),
      totalAvailableQty: Number(sku.totalAvailableQty || 0),
      inTransitQty: Number(sku.inTransitQty || 0),
      bomDemandQty: Number(sku.bomDemandQty || 0),
      weight: sku.weight ?? '',
      isActive: sku.isActive ? '启用' : '禁用',
      syncStatus: sku.syncStatus === 'pending' ? '待同步'
        : sku.syncStatus === 'syncing' ? '同步中'
        : sku.syncStatus === 'synced' ? '已同步'
        : sku.syncStatus === 'failed' ? '失败'
        : '-',
    }));

    const buffer = await this.exportService.exportToExcel(
      exportData,
      columns,
      'SKU列表',
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="skus-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    });

    return buffer;
  }

  @Permissions('product:edit')
  @Post('skus/batch-category')
  async batchUpdateSkuCategory(
    @Body()
    body: {
      skuIds: string[];
      materialCategoryId: string;
    },
  ) {
    await this.service.batchUpdateSkuCategory(
      body.skuIds,
      body.materialCategoryId,
    );
    return { updated: body.skuIds.length };
  }

  @Get('skus')
  async findSkus(@Query('productId') productId: string) {
    return this.service.findSkusByProductId(productId);
  }

  @Get('skus/:skuId')
  async findSkuById(@Param('skuId') skuId: string) {
    return this.service.findSkuById(skuId);
  }

  @Permissions('product:edit')
  @Patch('skus/:skuId')
  async updateSku(
    @Param('skuId') skuId: string,
    @Body() dto: { floorPrice?: number },
  ) {
    return this.service.updateSku(skuId, dto);
  }

  @Get('skus/:skuId/price')
  async getPrice(@Param('skuId') skuId: string, @Query('level') level: string) {
    const price = await this.service.getPrice(skuId, level || 'C');
    return { skuId, level: level || 'C', price };
  }

  @Permissions('product:view')
  @Get('skus/:skuId/prices')
  async getPrices(@Param('skuId') skuId: string) {
    return this.service.getPrices(skuId);
  }

  @Permissions('product:view')
  @Get('skus/:skuId/sales-stats')
  async getSalesStats(@Param('skuId') skuId: string) {
    return this.service.getSalesStats(skuId);
  }

  @Permissions('product:view')
  @Get('skus/:skuId/orders')
  async getRelatedOrders(
    @Param('skuId') skuId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.service.getRelatedOrders(skuId, limit);
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

  @Permissions('product:edit')
  @Post('skus/:skuId/images')
  @UseInterceptors(FilesInterceptor('images', 10))
  async uploadSkuImages(
    @Param('skuId') skuId: string,
    @UploadedFiles() files: { buffer: Buffer; originalname: string; mimetype: string }[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请上传图片文件');
    }
    const urls = await this.service.addSkuImages(skuId, files);
    return { urls };
  }

  @Permissions('product:edit')
  @Delete('skus/:skuId/images/:index')
  async deleteSkuImage(
    @Param('skuId') skuId: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    await this.service.removeSkuImage(skuId, index);
    return { message: '图片删除成功' };
  }

  @Permissions('product:delete')
  @Delete('skus/:skuId')
  async removeSku(@Param('skuId') skuId: string) {
    await this.service.removeSku(skuId);
    return { message: 'SKU 删除成功' };
  }

  @Permissions('product:delete')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { message: '产品删除成功' };
  }

  @Post('sync-jushuitan')
  async syncJushuitan(@Body() body?: { daysBack?: number }) {
    const daysBack = body?.daysBack ?? 3650;
    await this.syncQueue.add('sync-skus', { daysBack });
    await this.syncQueue.add('sync-boms', {});
    return { message: 'SKU 和 BOM 同步任务已启动' };
  }

  @Permissions('product:create')
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importProducts(
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string },
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('请上传 Excel 文件');
    }
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('仅支持 .xlsx 或 .xls 格式文件');
    }
    const userId = req.user?.userId as string;
    return this.service.importFromExcel(Buffer.from(file.buffer), userId);
  }

  @Public()
  @Post('import-historical-materials')
  async importHistoricalMaterials() {
    const result = await this.importService.import();
    return result;
  }
}
