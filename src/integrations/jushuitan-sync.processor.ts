import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import {
  SalesOrder,
  SalesOrderStatus,
} from '../sales/entities/sales-order.entity';
import { DeliveryOrder } from '../deliveries/entities/delivery-order.entity';
import { DeliveryOrderItem } from '../deliveries/entities/delivery-order-item.entity';
import { JushuitanService } from './jushuitan.service';
import { IntegrationLog } from './entities/integration-log.entity';
import { StocksService } from '../stocks/stocks.service';
import { ProductsService } from '../products/products.service';
import { BomsService } from '../boms/boms.service';
import { ProductSku } from '../products/entities/product-sku.entity';

@Processor('jushuitan-sync')
export class JushuitanSyncProcessor {
  private readonly logger = new Logger(JushuitanSyncProcessor.name);

  constructor(
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    @InjectRepository(IntegrationLog)
    private readonly logRepo: Repository<IntegrationLog>,
    @InjectRepository(DeliveryOrder)
    private readonly deliveryRepo: Repository<DeliveryOrder>,
    @InjectRepository(DeliveryOrderItem)
    private readonly deliveryItemRepo: Repository<DeliveryOrderItem>,
    @InjectRepository(ProductSku)
    private readonly skuRepo: Repository<ProductSku>,
    private readonly jstService: JushuitanService,
    private readonly stocksService: StocksService,
    private readonly productsService: ProductsService,
    private readonly bomsService: BomsService,
  ) {}

  @Process('push-order')
  async handlePushOrder(job: Job<{ orderId: string }>) {
    const order = await this.orderRepo.findOne({
      where: { id: job.data.orderId },
      relations: ['items'],
    });
    if (!order) return;

    try {
      const res = await this.jstService.createSalesOrder(order);
      await this.logRepo.save({
        provider: 'jushuitan',
        action: 'push-order',
        request: { orderId: order.id, items: order.items.map((i) => i.skuId) },
        response: res,
        success: true,
      });

      const r = res as Record<string, unknown>;
      if (r?.code === 0 || r?.success) {
        order.status = SalesOrderStatus.SYNCED_JST;
        await this.orderRepo.save(order);
        this.logger.log(`Pushed order ${order.id} to Jushuitan`);
      } else {
        throw new Error((r?.msg as string) || 'Jushuitan returned failure');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.logRepo.save({
        provider: 'jushuitan',
        action: 'push-order',
        request: { orderId: order.id },
        success: false,
        errorMessage: msg,
      });
      this.logger.error(`Push order ${order.id} failed`, msg);
      throw err;
    }
  }

  @Process('sync-stock')
  async handleSyncStock() {
    try {
      const stocks = (await this.jstService.queryStocks(30)) as Record<string, unknown>[];
      const snapshots = stocks.map((s) => ({
        skuId: String(s.sku_id || s.skuId || ''),
        warehouseId: 'default',
        availableQty: Number(s.qty || s.available_qty || 0),
        safetyStock: Number(s.min_qty || 0),
      }));
      await this.stocksService.upsertMany(snapshots);
      this.logger.log(`Synced ${stocks.length} stock records`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('Sync stock failed', msg);
      throw err;
    }
  }

  @Process('sync-deliveries')
  async handleSyncDeliveries() {
    const modifiedAfter = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();
    try {
      const deliveries = (await this.jstService.queryDeliveries(modifiedAfter)) as Record<string, unknown>[];
      for (const d of deliveries) {
        const orderId = d.so_id as string;
        if (!orderId) continue;

        let delivery = await this.deliveryRepo.findOne({
          where: { salesOrderId: orderId },
        });
        if (!delivery) {
          delivery = this.deliveryRepo.create({
            salesOrderId: orderId,
            status: (d.status as string) || 'shipped',
            trackingNo: d.logistics_no as string,
            carrier: d.logistics_company as string,
            shippedAt: d.send_date ? new Date(d.send_date as string) : new Date(),
          });
          await this.deliveryRepo.save(delivery);
        }

        const items = d.items as Record<string, unknown>[];
        if (items?.length) {
          for (const item of items) {
            const exists = await this.deliveryItemRepo.findOne({
              where: { deliveryOrderId: delivery.id, skuId: item.sku_id as string },
            });
            if (!exists) {
              await this.deliveryItemRepo.save(
                this.deliveryItemRepo.create({
                  deliveryOrderId: delivery.id,
                  salesOrderItemId: '',
                  skuId: item.sku_id as string,
                  qty: Number(item.qty || 0),
                }),
              );
            }
          }
        }

        const order = await this.orderRepo.findOneBy({ id: orderId });
        if (order && order.status !== SalesOrderStatus.COMPLETED) {
          order.status = SalesOrderStatus.SHIPPED;
          await this.orderRepo.save(order);
        }
      }
      this.logger.log(`Synced ${deliveries.length} deliveries`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('Sync deliveries failed', msg);
      throw err;
    }
  }

  @Process('sync-skus')
  async handleSyncSkus(job?: Job<unknown>) {
    try {
      const pageSize = 100;
      let totalSynced = 0;
      const brandFilter = 'EMIE';

      const daysBack = ((job?.data as Record<string, unknown>)?.daysBack as number) ?? 365 * 10;
      const now = new Date();
      const windowMs = 7 * 24 * 60 * 60 * 1000;
      let windowStart = new Date(
        now.getTime() - daysBack * 24 * 60 * 60 * 1000,
      );

      while (windowStart < now) {
        let windowEnd = new Date(windowStart.getTime() + windowMs);
        if (windowEnd > now) windowEnd = now;

        const modifiedBegin = this.formatDateTime(windowStart);
        const modifiedEnd = this.formatDateTime(windowEnd);

        let pageIndex = 1;
        let windowHasMore = true;

        while (windowHasMore) {
          const res = await this.jstService.querySkus(
            pageIndex,
            pageSize,
            modifiedBegin,
            modifiedEnd,
          );
          const r = res as Record<string, unknown>;
          if (r?.code !== 0 && !r?.success) {
            throw new Error((r?.msg as string) || 'Jushuitan sku query failed');
          }

          const data = r?.data as Record<string, unknown>;
          const datas = (data?.datas as unknown[]) || [];
          const totalCount = (data?.total_count as number) || datas.length;
          const pageCount = (data?.page_count as number) || 1;

          this.logger.log(
            `Jushuitan SKU query window ${modifiedBegin}~${modifiedEnd} page ${pageIndex}: got ${datas.length} items, total=${totalCount}, pageCount=${pageCount}`,
          );

          const typedDatas = datas as Record<string, unknown>[];
          if (typedDatas.length) {
            const filtered = typedDatas.filter(
              (d) =>
                d.brand &&
                String(d.brand).toUpperCase() === brandFilter.toUpperCase(),
            );

            if (filtered.length) {
              const stats =
                await this.productsService.upsertFromJushuitan(filtered);
              totalSynced += filtered.length;
              this.logger.log(
                `Synced window ${modifiedBegin}~${modifiedEnd} page ${pageIndex}: ${filtered.length}/${datas.length} EMIE items, stats=${JSON.stringify(stats)}`,
              );
            } else {
              this.logger.log(
                `Window ${modifiedBegin}~${modifiedEnd} page ${pageIndex}: no EMIE items among ${datas.length} records`,
              );
            }
          }

          windowHasMore = pageIndex < pageCount;
          pageIndex++;
        }

        windowStart = windowEnd;
        if (windowStart < now) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      await this.logRepo.save({
        provider: 'jushuitan',
        action: 'sync-skus',
        request: { brand: brandFilter, daysBack },
        response: { totalSynced },
        success: true,
      });

      this.logger.log(`Total SKU sync completed: ${totalSynced} EMIE items`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.logRepo.save({
        provider: 'jushuitan',
        action: 'sync-skus',
        request: {},
        success: false,
        errorMessage: msg,
      });
      this.logger.error('Sync SKUs failed', msg);
      throw err;
    }
  }

  @Process('sync-boms')
  async handleSyncBoms() {
    try {
      // 获取所有有 jstSkuId 的本地 SKU
      const skus = await this.skuRepo.find({
        where: { isActive: true },
        select: ['jstSkuId'],
      });
      const skuIds = skus
        .map((s) => s.jstSkuId)
        .filter((id): id is string => !!id);

      if (!skuIds.length) {
        this.logger.log('No SKUs with jstSkuId found, skipping BOM sync');
        return;
      }

      this.logger.log(`Starting BOM sync for ${skuIds.length} SKUs`);

      const batchSize = 50; // 聚水潭 API 限制最大 50
      let totalCreated = 0;
      let totalUpdated = 0;

      for (let i = 0; i < skuIds.length; i += batchSize) {
        const batch = skuIds.slice(i, i + batchSize);
        let pageIndex = 1;
        let hasMore = true;
        const batchBoms: Record<string, unknown>[] = [];

        while (hasMore) {
          const res = await this.jstService.queryBoms(
            batch,
            pageIndex,
            batchSize,
          );
          const r = res as Record<string, unknown>;
          if (r?.code !== 0 && !r?.success) {
            throw new Error((r?.msg as string) || 'Jushuitan BOM query failed');
          }

          // 兼容 list 为数组或对象的情况
          const data = r?.data as Record<string, unknown>;
          let list = data?.list;
          if (list && !Array.isArray(list)) {
            list = [list];
          }
          const datas: Record<string, unknown>[] = (list as Record<string, unknown>[]) || [];

          // 聚水潭 BOM API 不返回 page_count，用返回是否为空判断是否还有下一页
          const pageInfo = (data?.page as Record<string, unknown>) || {};
          const currentPage = pageInfo.current_page || pageIndex;
          const pageSize = pageInfo.page_size || batchSize;

          this.logger.log(
            `BOM query batch ${Math.floor(i / batchSize) + 1} page ${currentPage}: got ${datas.length} BOMs`,
          );

          batchBoms.push(...(datas as Record<string, unknown>[]));
          const ps = pageSize as number;
          hasMore = datas.length >= ps && datas.length > 0;
          pageIndex++;
        }

        if (batchBoms.length) {
          const stats = await this.bomsService.upsertFromJushuitan(batchBoms);
          totalCreated += stats.created;
          totalUpdated += stats.updated;
          this.logger.log(
            `Batch ${Math.floor(i / batchSize) + 1} synced: created=${stats.created}, updated=${stats.updated}`,
          );
        }

        if (i + batchSize < skuIds.length) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      await this.logRepo.save({
        provider: 'jushuitan',
        action: 'sync-boms',
        request: { skuCount: skuIds.length },
        response: { created: totalCreated, updated: totalUpdated },
        success: true,
      });

      this.logger.log(
        `BOM sync completed: ${totalCreated} created, ${totalUpdated} updated`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.logRepo.save({
        provider: 'jushuitan',
        action: 'sync-boms',
        request: {},
        success: false,
        errorMessage: msg,
      });
      this.logger.error('Sync BOMs failed', msg);
      throw err;
    }
  }

  private formatDateTime(date: Date): string {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
}
