import {
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Body,
  Query,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { StocksService } from './stocks.service';
import { StockLedgerService } from './stock-ledger.service';

@Controller('stocks')
export class StocksController {
  constructor(
    private readonly service: StocksService,
    private readonly stockLedger: StockLedgerService,
    @InjectQueue('jushuitan-sync') private readonly syncQueue: Queue,
  ) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      keyword,
      warehouseId,
      status,
    });
  }

  @Get('warehouses')
  findWarehouses() {
    return this.service.findWarehouses();
  }

  // 本地库存层 API —— 必须放在 :skuId 参数路由之前
  @Get('local-balances')
  async findAllLocalBalances(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.stockLedger.findAllBalances(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 50,
      keyword,
    );
  }

  @Get('local-balances/:skuId')
  async getLocalBalance(@Param('skuId') skuId: string) {
    const qty = await this.stockLedger.getBalance(skuId);
    return { skuId, qty };
  }

  @Get('ledger/:skuId')
  async findLedgerBySku(
    @Param('skuId') skuId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.stockLedger.findLedgerBySku(
      skuId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Post('sync-jushuitan')
  async syncJushuitan() {
    await this.syncQueue.add('sync-stock', {});
    return { message: '库存同步任务已启动' };
  }

  @Get(':skuId')
  findBySku(@Param('skuId') skuId: string) {
    return this.service.findBySku(skuId);
  }

  @Patch(':skuId/:warehouseId/safety-stock')
  updateSafetyStock(
    @Param('skuId') skuId: string,
    @Param('warehouseId') warehouseId: string,
    @Body('safetyStock') safetyStock: number,
  ) {
    return this.service.updateSafetyStock(skuId, warehouseId, safetyStock);
  }
}
