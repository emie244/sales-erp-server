import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class StockAlertService {
  private readonly logger = new Logger(StockAlertService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkStockAlerts() {
    try {
      const alerts = await this.dataSource.query(
        `
        SELECT
          ss.sku_id as "skuId",
          ss.warehouse_id as "warehouseId",
          ss."availableQty" as "availableQty",
          ss.safety_stock as "safetyStock",
          ps."skuName" as "skuName",
          ps."skuCode" as "skuCode",
          p.name as "productName"
        FROM stock_snapshots ss
        LEFT JOIN product_skus ps ON (
          ps."skuCode" = ss.sku_id OR ps.jst_sku_id = ss.sku_id
        )
        LEFT JOIN products p ON p.id = ps.product_id
        WHERE ss.safety_stock > 0
          AND ss."availableQty" <= ss.safety_stock
        ORDER BY ss.safety_stock - ss."availableQty" DESC
        `,
      );

      if (!alerts.length) {
        this.logger.log('No stock alerts found');
        return;
      }

      const users = await this.dataSource.query(
        `SELECT id FROM users WHERE role IN ('admin', 'purchaser') AND "isActive" = true`,
      );

      let sent = 0;
      for (const alert of alerts) {
        const {
          skuId,
          warehouseId,
          availableQty,
          safetyStock,
          skuName,
          skuCode,
          productName,
        } = alert;
        const title = skuName || skuCode || skuId;
        const relatedId = `${skuId}:${warehouseId}`;

        const existing = await this.dataSource.query(
          `
          SELECT 1 FROM notifications
          WHERE type = 'stock_alert' AND related_id = $1
            AND created_at > NOW() - INTERVAL '24 hours'
          LIMIT 1
          `,
          [relatedId],
        );

        if (existing.length) continue;

        const content = [
          `产品：${productName || '-'}`,
          `SKU：${title}`,
          `仓库：${warehouseId}`,
          `可用库存：${availableQty}`,
          `安全库存：${safetyStock}`,
          `缺口：${(Number(safetyStock) - Number(availableQty)).toFixed(2)}`,
        ].join('\n');

        for (const user of users) {
          await this.notificationsService.create({
            userId: user.id,
            type: 'stock_alert',
            title: `库存预警：${title}（${warehouseId}）`,
            content,
            relatedId,
          });
        }
        sent++;
      }

      this.logger.log(
        `Checked ${alerts.length} stock alerts, sent ${sent} new notifications`,
      );
    } catch (err: any) {
      this.logger.error(`Stock alert check failed: ${err.message}`);
    }
  }
}
