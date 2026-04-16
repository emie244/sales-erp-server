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
    private readonly jstService: JushuitanService,
    private readonly stocksService: StocksService,
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

      if (res?.code === 0 || res?.success) {
        order.status = SalesOrderStatus.SYNCED_JST;
        await this.orderRepo.save(order);
        this.logger.log(`Pushed order ${order.id} to Jushuitan`);
      } else {
        throw new Error(res?.msg || 'Jushuitan returned failure');
      }
    } catch (err: any) {
      await this.logRepo.save({
        provider: 'jushuitan',
        action: 'push-order',
        request: { orderId: order.id },
        success: false,
        errorMessage: err.message,
      });
      this.logger.error(`Push order ${order.id} failed`, err.message);
      throw err;
    }
  }

  @Process('sync-stock')
  async handleSyncStock() {
    try {
      const stocks = await this.jstService.queryStocks();
      const snapshots = stocks.map((s: any) => ({
        skuId: String(s.sku_id || s.skuId),
        warehouseId: String(s.warehouse_id || s.warehouseId || 'default'),
        availableQty: Number(s.qty || s.available_qty || 0),
      }));
      await this.stocksService.upsertMany(snapshots);
      this.logger.log(`Synced ${stocks.length} stock records`);
    } catch (err: any) {
      this.logger.error('Sync stock failed', err.message);
      throw err;
    }
  }

  @Process('sync-deliveries')
  async handleSyncDeliveries() {
    const modifiedAfter = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();
    try {
      const deliveries = await this.jstService.queryDeliveries(modifiedAfter);
      for (const d of deliveries) {
        const orderId = d.so_id;
        if (!orderId) continue;

        let delivery = await this.deliveryRepo.findOne({
          where: { salesOrderId: orderId },
        });
        if (!delivery) {
          delivery = this.deliveryRepo.create({
            salesOrderId: orderId,
            status: d.status || 'shipped',
            trackingNo: d.logistics_no,
            carrier: d.logistics_company,
            shippedAt: d.send_date ? new Date(d.send_date) : new Date(),
          });
          await this.deliveryRepo.save(delivery);
        }

        if (d.items?.length) {
          for (const item of d.items) {
            const exists = await this.deliveryItemRepo.findOne({
              where: { deliveryOrderId: delivery.id, skuId: item.sku_id },
            });
            if (!exists) {
              await this.deliveryItemRepo.save(
                this.deliveryItemRepo.create({
                  deliveryOrderId: delivery.id,
                  salesOrderItemId: '',
                  skuId: item.sku_id,
                  qty: item.qty,
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
    } catch (err: any) {
      this.logger.error('Sync deliveries failed', err.message);
      throw err;
    }
  }
}
