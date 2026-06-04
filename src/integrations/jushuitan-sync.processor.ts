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
import { SyncLogService, SyncCounts } from './sync-log.service';
import type { SyncLogError } from './entities/sync-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { StockLedger } from '../stocks/entities/stock-ledger.entity';

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
    @InjectRepository(StockLedger)
    private readonly stockLedgerRepo: Repository<StockLedger>,
    private readonly jstService: JushuitanService,
    private readonly stocksService: StocksService,
    private readonly productsService: ProductsService,
    private readonly bomsService: BomsService,
    private readonly syncLogService: SyncLogService,
    private readonly notificationsService: NotificationsService,
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
  async handleSyncStock(job?: Job<unknown>) {
    const log = await this.syncLogService.start({
      jobName: 'sync-stock',
      bullJobId: job?.id ? String(job.id) : null,
    });
    const errors: SyncLogError[] = [];
    let counts: SyncCounts = {};

    try {
      const stocks = (await this.jstService.queryStocks(30)) as Record<
        string,
        unknown
      >[];

      // 自动创建/更新库存 SKU 记录（原材料/外采商品可能没有从商品接口同步）
      let skuCreated = 0;
      let skuUpdated = 0;
      for (const s of stocks) {
        const skuId = String(
          (s.sku_id as string | undefined) ||
            (s.skuId as string | undefined) ||
            '',
        );
        if (!skuId) continue;

        const existingSku = await this.skuRepo.findOne({
          where: [{ skuCode: skuId }, { jstSkuId: skuId }],
        });

        if (!existingSku) {
          // 创建原材料/外采 SKU 记录
          await this.skuRepo.save(
            this.skuRepo.create({
              skuCode: skuId,
              jstSkuId: skuId,
              skuName: String(s.name || ''),
              productId: '', // 外采/原材料无关联产品
              category: '原材料',
              codeCompliant: true,
              syncStatus: 'synced',
            }),
          );
          skuCreated++;
        } else if (!existingSku.skuName && s.name) {
          // 补充 SKU 名称
          existingSku.skuName = String(s.name);
          await this.skuRepo.save(existingSku);
          skuUpdated++;
        }
      }

      const snapshots = stocks.map((s) => ({
        skuId: String(
          (s.sku_id as string | undefined) ||
            (s.skuId as string | undefined) ||
            '',
        ),
        warehouseId: 'default',
        availableQty: Number(s.qty || s.available_qty || 0),
        safetyStock: Number(s.min_qty || 0),
      }));
      await this.stocksService.upsertMany(snapshots);
      counts = {
        fetchedCount: stocks.length,
        updatedCount: stocks.length,
        skuCreated,
        skuUpdated,
      };
      this.logger.log(
        `Synced ${stocks.length} stock records, created ${skuCreated} SKUs, updated ${skuUpdated} SKUs`,
      );
      await this.syncLogService.finish(log.id, 'succeeded', counts, errors);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({
        message: msg,
        stack: err instanceof Error ? err.stack : undefined,
      });
      await this.syncLogService.finish(log.id, 'failed', counts, errors);
      this.logger.error('Sync stock failed', msg);
      throw err;
    }
  }

  @Process('sync-stock-ledger')
  async handleSyncStockLedger(job?: Job<unknown>) {
    const log = await this.syncLogService.start({
      jobName: 'sync-stock-ledger',
      bullJobId: job?.id ? String(job.id) : null,
    });
    const errors: SyncLogError[] = [];
    let counts: SyncCounts = {};

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const modifiedBegin = fmt(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const modifiedEnd = fmt(new Date());

    let totalRecords = 0;
    try {
      // 1. 同步销售出库记录
      const salesOuts = (await this.jstService.querySalesOuts(
        modifiedBegin,
        modifiedEnd,
      )) as Record<string, unknown>[];
      for (const order of salesOuts) {
        const items = (order.items as Record<string, unknown>[]) || [];
        for (const item of items) {
          const skuId = String(item.sku_id || '');
          if (!skuId) continue;
          await this.stockLedgerRepo.save(
            this.stockLedgerRepo.create({
              skuId,
              type: 'outbound',
              qty: Number(item.qty || 0),
              referenceType: 'sales_order',
              referenceId: String(order.so_id || order.io_id || ''),
              beforeQty: 0,
              afterQty: 0,
              remark: `销售出库 ${order.logistics_company || ''}`,
            }),
          );
          totalRecords++;
        }
      }

      // 2. 同步其它出入库记录
      const otherInouts = (await this.jstService.queryOtherInouts(
        modifiedBegin,
        modifiedEnd,
      )) as Record<string, unknown>[];
      for (const doc of otherInouts) {
        const docType = String(doc.type || '');
        const isInbound =
          docType.includes('进仓') || docType.includes('退货');
        const items = (doc.items as Record<string, unknown>[]) || [];
        for (const item of items) {
          const skuId = String(item.sku_id || '');
          if (!skuId) continue;
          await this.stockLedgerRepo.save(
            this.stockLedgerRepo.create({
              skuId,
              type: isInbound ? 'inbound' : 'outbound',
              qty: Number(item.qty || 0),
              referenceType: 'adjustment',
              referenceId: String(doc.io_id || ''),
              beforeQty: 0,
              afterQty: 0,
              remark: `${docType} ${doc.remark || ''}`,
            }),
          );
          totalRecords++;
        }
      }

      counts = { fetchedCount: totalRecords, updatedCount: totalRecords };
      this.logger.log(`Synced ${totalRecords} stock ledger records`);
      await this.syncLogService.finish(log.id, 'succeeded', counts, errors);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({
        message: msg,
        stack: err instanceof Error ? err.stack : undefined,
      });
      await this.syncLogService.finish(log.id, 'failed', counts, errors);
      this.logger.error('Sync stock ledger failed', msg);
      throw err;
    }
  }

  @Process('sync-deliveries')
  async handleSyncDeliveries(job?: Job<unknown>) {
    const log = await this.syncLogService.start({
      jobName: 'sync-deliveries',
      bullJobId: job?.id ? String(job.id) : null,
    });
    const errors: SyncLogError[] = [];
    let counts: SyncCounts = {};

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const modifiedBegin = fmt(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const modifiedEnd = fmt(new Date());
    try {
      const deliveries = (await this.jstService.queryDeliveries(
        modifiedBegin,
        modifiedEnd,
      )) as Record<string, unknown>[];
      let insertedCount = 0;
      let updatedCount = 0;

      for (const d of deliveries) {
        const orderId = d.so_id as string;
        if (!orderId) continue;

        let delivery = await this.deliveryRepo.findOne({
          where: { salesOrderId: orderId },
        });
        if (!delivery) {
          delivery = this.deliveryRepo.create({
            salesOrderId: orderId,
            status: (d.status as string) === 'Confirmed' ? 'shipped' : (d.status as string) || 'shipped',
            trackingNo: (d.l_id as string) || '',
            carrier: (d.logistics_company as string) || '',
            shippedAt: d.send_date
              ? new Date((d.send_date as string).replace(' ', 'T'))
              : new Date(),
          });
          await this.deliveryRepo.save(delivery);
          insertedCount++;
        }

        const items = d.items as Record<string, unknown>[];
        if (items?.length) {
          for (const item of items) {
            const exists = await this.deliveryItemRepo.findOne({
              where: {
                deliveryOrderId: delivery.id,
                skuId: item.sku_id as string,
              },
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

        const order = await this.orderRepo.findOneBy({ jstSoId: orderId });
        if (order && order.status !== SalesOrderStatus.COMPLETED) {
          order.status = SalesOrderStatus.SHIPPED;
          await this.orderRepo.save(order);
          updatedCount++;
        }
      }
      counts = { fetchedCount: deliveries.length, insertedCount, updatedCount };
      this.logger.log(`Synced ${deliveries.length} deliveries`);
      await this.syncLogService.finish(log.id, 'succeeded', counts, errors);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({
        message: msg,
        stack: err instanceof Error ? err.stack : undefined,
      });
      await this.syncLogService.finish(log.id, 'failed', counts, errors);
      this.logger.error('Sync deliveries failed', msg);
      throw err;
    }
  }

  @Process('sync-skus')
  async handleSyncSkus(job?: Job<unknown>) {
    const log = await this.syncLogService.start({
      jobName: 'sync-skus',
      bullJobId: job?.id ? String(job.id) : null,
    });
    const errors: SyncLogError[] = [];
    let fetchedCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let itemTypeNullCount = 0;
    let codeNonCompliantCount = 0;

    try {
      const pageSize = 100;

      const daysBack =
        ((job?.data as Record<string, unknown>)?.daysBack as number) ??
        365 * 10;
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
            fetchedCount += typedDatas.length;
            const stats =
              await this.productsService.upsertFromJushuitan(typedDatas);
            insertedCount += stats.createdSkus;
            updatedCount += stats.updatedSkus;
            skippedCount += stats.skippedCount ?? 0;
            itemTypeNullCount += stats.itemTypeNullCount;
            codeNonCompliantCount += stats.codeNonCompliantCount;
            this.logger.log(
              `Synced window ${modifiedBegin}~${modifiedEnd} page ${pageIndex}: ${typedDatas.length} items, stats=${JSON.stringify(stats)}`,
            );
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
        request: { brand: 'all', daysBack },
        response: {
          fetchedCount,
          insertedCount,
          updatedCount,
          skippedCount,
          itemTypeNullCount,
          codeNonCompliantCount,
        },
        success: true,
      });

      await this.syncLogService.finish(
        log.id,
        'succeeded',
        {
          fetchedCount,
          insertedCount,
          updatedCount,
          skippedCount,
          itemTypeNullCount,
          codeNonCompliantCount,
        },
        errors,
      );

      this.logger.log(
        `Total SKU sync completed: fetched=${fetchedCount}, inserted=${insertedCount}, updated=${updatedCount}, skipped=${skippedCount}, itemTypeNull=${itemTypeNullCount}, codeNonCompliant=${codeNonCompliantCount}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({
        message: msg,
        stack: err instanceof Error ? err.stack : undefined,
      });
      await this.logRepo.save({
        provider: 'jushuitan',
        action: 'sync-skus',
        request: {},
        success: false,
        errorMessage: msg,
      });
      await this.syncLogService.finish(
        log.id,
        'failed',
        {
          fetchedCount,
          insertedCount,
          updatedCount,
          skippedCount,
          itemTypeNullCount,
          codeNonCompliantCount,
        },
        errors,
      );
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
          const datas: Record<string, unknown>[] =
            (list as Record<string, unknown>[]) || [];

          // 聚水潭 BOM API 不返回 page_count，用返回是否为空判断是否还有下一页
          const pageInfo = (data?.page as Record<string, unknown>) || {};
          const currentPage = (pageInfo.current_page as number) || pageIndex;
          const pageSize = (pageInfo.page_size as number) || batchSize;

          this.logger.log(
            `BOM query batch ${Math.floor(i / batchSize) + 1} page ${String(currentPage)}: got ${datas.length} BOMs`,
          );

          batchBoms.push(...datas);
          const ps = pageSize;
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

  @Process('push-sku')
  async handlePushSku(
    job: Job<{ skuId: string; userId: string; attempt?: number }>,
  ) {
    const { skuId, userId } = job.data;
    const sku = await this.skuRepo.findOne({
      where: { id: skuId },
      relations: ['product'],
    });
    if (!sku) {
      this.logger.warn(`Push sku ${skuId} not found`);
      return;
    }

    await this.skuRepo.update(skuId, { syncStatus: 'syncing' });

    try {
      const res = (await this.jstService.pushSku(sku)) as Record<
        string,
        unknown
      >;

      if (res?.code === 0 || res?.success) {
        const data = res?.data as Record<string, unknown>;
        const jstSkuId = String(data?.sku_id || data?.i_id || '');
        await this.skuRepo.update(skuId, {
          jstSkuId,
          syncStatus: 'synced',
          lastSyncAt: new Date(),
          syncErrorMessage: null,
        });
        this.logger.log(`Pushed SKU ${sku.skuCode} to Jushuitan, jstSkuId=${jstSkuId}`);
      } else {
        const msg = (res?.msg as string) || 'Jushuitan returned failure';
        throw new Error(msg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const attempt = job.data.attempt || 1;
      const errorCode = (err as any).code;

      await this.skuRepo.update(skuId, {
        syncStatus: 'failed',
        syncErrorMessage: msg,
      });

      // 分类映射缺失：不重试，直接通知
      if (errorCode === 'CATEGORY_MAPPING_MISSING') {
        this.logger.error(`Push SKU ${sku.skuCode} failed: category mapping missing`);
        await this.notificationsService.create({
          userId,
          type: 'sku_sync_failed',
          title: 'SKU 同步失败：分类未映射',
          content: `SKU 编码：${sku.skuCode}，分类「${(err as any).erpCategory}」未映射到聚水潭分类。请在「系统管理-分类映射」中配置后重试。`,
          relatedId: skuId,
        });
        return;
      }

      // 重试机制：最多 3 次
      if (attempt < 3) {
        this.logger.warn(
          `Push SKU ${sku.skuCode} failed (attempt ${attempt}), will retry`,
        );
        throw err; // Bull 会自动重试
      }

      // 最终失败，发送通知
      this.logger.error(`Push SKU ${sku.skuCode} failed after 3 attempts`, msg);
      await this.notificationsService.create({
        userId,
        type: 'sku_sync_failed',
        title: 'SKU 同步到聚水潭失败',
        content: `SKU 编码：${sku.skuCode}，错误信息：${msg}。请检查网络或聚水潭配置后重试。`,
        relatedId: skuId,
      });
    }
  }

  @Process('push-bom')
  async handlePushBom(
    job: Job<{ bomId: string; userId: string }>,
  ) {
    const { bomId, userId } = job.data;
    const bom = await this.bomsService.findOne(bomId);
    if (!bom) {
      this.logger.warn(`Push bom ${bomId} not found`);
      return;
    }

    // 检查所有子物料是否已同步到聚水潭
    const missingSkus: string[] = [];
    for (const item of bom.items || []) {
      const sku = await this.skuRepo.findOne({
        where: { skuCode: item.materialSkuId },
      });
      if (!sku?.jstSkuId) {
        missingSkus.push(item.materialSkuId);
      }
    }

    if (missingSkus.length > 0) {
      const msg = `以下子物料尚未同步到聚水潭：${missingSkus.join(', ')}`;
      this.logger.error(`Push BOM ${bomId} failed: ${msg}`);
      await this.notificationsService.create({
        userId,
        type: 'bom_sync_failed',
        title: 'BOM 同步到聚水潭失败',
        content: `BOM 版本：${bom.version}，${msg}。请先同步子物料后再试。`,
        relatedId: bomId,
      });
      return;
    }

    try {
      const res = (await this.jstService.saveBom(bom)) as Record<
        string,
        unknown
      >;

      if (res?.code === 0 || res?.success) {
        this.logger.log(`Pushed BOM ${bomId} to Jushuitan`);
      } else {
        const msg = (res?.msg as string) || 'Jushuitan returned failure';
        throw new Error(msg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Push BOM ${bomId} failed`, msg);
      await this.notificationsService.create({
        userId,
        type: 'bom_sync_failed',
        title: 'BOM 同步到聚水潭失败',
        content: `BOM 版本：${bom.version}，错误信息：${msg}。`,
        relatedId: bomId,
      });
    }
  }

  private formatDateTime(date: Date): string {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
}
