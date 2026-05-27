import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrder } from '../entities/sales-order.entity';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';
import { PurchaseRequest } from '../../purchase-requests/entities/purchase-request.entity';

@Injectable()
export class DeliveryWarningService {
  private readonly logger = new Logger(DeliveryWarningService.name);

  constructor(
    @InjectRepository(SalesOrder)
    private readonly salesOrderRepo: Repository<SalesOrder>,
    @InjectRepository(PurchaseRequest)
    private readonly purchaseRequestRepo: Repository<PurchaseRequest>,
  ) {}

  /**
   * 采购单审批通过后检查交期预警
   * 当采购单预期交货日晚于关联销售订单的客户要求交货日时触发
   */
  async checkOnPoApproved(purchaseOrder: PurchaseOrder): Promise<void> {
    if (!purchaseOrder.expectedDeliveryDate) return;

    const salesOrders = await this.findRelatedSalesOrders(purchaseOrder.id);
    if (!salesOrders.length) return;

    const poDeliveryDate = new Date(purchaseOrder.expectedDeliveryDate);

    for (const so of salesOrders) {
      if (!so.deliveryDate) continue;

      const soDeliveryDate = new Date(so.deliveryDate);
      if (poDeliveryDate > soDeliveryDate) {
        const warning =
          `关联采购单 ${purchaseOrder.orderNo} 预期交货日 (${this.formatDate(poDeliveryDate)}) ` +
          `晚于客户要求交货日 (${this.formatDate(soDeliveryDate)})`;
        await this.setWarning(so.id, warning);
      }
    }
  }

  /**
   * 采购单到货时检查交期预警
   * 当实际到货日晚于预期交货日时触发
   */
  async checkOnPoReceived(purchaseOrder: PurchaseOrder): Promise<void> {
    if (!purchaseOrder.expectedDeliveryDate) return;

    const now = new Date();
    const expectedDate = new Date(purchaseOrder.expectedDeliveryDate);
    // 只取日期部分比较
    const todayStr = now.toISOString().slice(0, 10);
    const expectedStr = expectedDate.toISOString().slice(0, 10);

    if (todayStr <= expectedStr) return;

    const salesOrders = await this.findRelatedSalesOrders(purchaseOrder.id);
    if (!salesOrders.length) return;

    for (const so of salesOrders) {
      const warning =
        `关联采购单 ${purchaseOrder.orderNo} 已延迟到货 ` +
        `(预期: ${this.formatDate(expectedDate)}, 实际: ${this.formatDate(now)})`;
      await this.setWarning(so.id, warning);
    }
  }

  /**
   * 清除销售订单的交期预警
   */
  async clearWarning(salesOrderId: string): Promise<void> {
    await this.salesOrderRepo.update(
      { id: salesOrderId },
      { deliveryWarning: null },
    );
  }

  /**
   * 查询有交期预警的销售订单
   */
  async findOrdersWithWarning() {
    return this.salesOrderRepo.find({
      where: { deliveryWarning: null as any },
      order: { createdAt: 'DESC' },
    });
  }

  private async findRelatedSalesOrders(
    purchaseOrderId: string,
  ): Promise<SalesOrder[]> {
    // 通过 purchase_request 的 converted_po_id 关联
    const requests = await this.purchaseRequestRepo.find({
      where: { convertedPoId: purchaseOrderId },
      select: ['salesOrderId'],
    });

    const salesOrderIds = [
      ...new Set(
        requests
          .map((r) => r.salesOrderId)
          .filter((id): id is string => !!id),
      ),
    ];

    if (!salesOrderIds.length) return [];

    return this.salesOrderRepo.findByIds(salesOrderIds);
  }

  private async setWarning(
    salesOrderId: string,
    warning: string,
  ): Promise<void> {
    const order = await this.salesOrderRepo.findOneBy({ id: salesOrderId });
    if (!order) return;

    // 追加预警信息（如果有不同的预警）
    const existing = order.deliveryWarning || '';
    if (existing.includes(warning)) return; // 避免重复

    order.deliveryWarning = existing
      ? `${existing}; ${warning}`
      : warning;
    await this.salesOrderRepo.save(order);

    this.logger.log(`Set delivery warning for SO ${salesOrderId}: ${warning}`);
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
