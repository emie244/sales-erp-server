import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { SalesOrder, SalesOrderStatus } from '../entities/sales-order.entity';
import { SalesOrderItem } from '../entities/sales-order-item.entity';
import { CreateSalesOrderDto } from '../dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from '../dto/update-sales-order.dto';
import { OrderItemBuilder } from '../builders/order-item.builder';
import { ApprovalService } from '../../approvals/approval.service';
import { JushuitanService } from '../../integrations/jushuitan.service';
import { ProductsService } from '../../products/products.service';
import { StockLedgerService } from '../../stocks/stock-ledger.service';
import { VouchersService } from '../../vouchers/vouchers.service';
import { DeliveriesService } from '../../deliveries/deliveries.service';
import { InvoicesService } from '../../invoices/invoices.service';
import { BomsService } from '../../boms/boms.service';
import { PurchaseRequestsService } from '../../purchase-requests/purchase-requests.service';
import { ProductionOrdersService } from '../../production-orders/production-orders.service';
import { StockReservationsService } from '../../stocks/stock-reservations.service';
import {
  CreditCheckPolicy,
  CreditCheckInput,
} from '../policies/credit-check.policy';
import {
  FloorPricePolicy,
  FloorPriceInput,
} from '../policies/floor-price.policy';

export interface SubmitContext {
  feishuUserId: string;
  approvalDefCode: string;
  feishuUserIdType?: string;
}

export interface ApproveContext {
  approvalRecordId: string;
}

export interface RejectContext {
  reason?: string;
}

@Injectable()
export class OrderLifecycle {
  private readonly logger = new Logger(OrderLifecycle.name);

  constructor(
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    @InjectRepository(SalesOrderItem)
    private readonly itemRepo: Repository<SalesOrderItem>,
    private readonly itemBuilder: OrderItemBuilder,
    private readonly approvalService: ApprovalService,
    private readonly jstService: JushuitanService,
    private readonly productsService: ProductsService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly stockLedger: StockLedgerService,
    private readonly vouchersService: VouchersService,
    private readonly deliveriesService: DeliveriesService,
    private readonly invoicesService: InvoicesService,
    private readonly bomsService: BomsService,
    private readonly purchaseRequestsService: PurchaseRequestsService,
    private readonly productionOrdersService: ProductionOrdersService,
    private readonly stockReservationsService: StockReservationsService,
    @InjectQueue('jushuitan-sync') private readonly syncQueue: Queue,
  ) {}

  private getCreditCheckPolicy(): CreditCheckPolicy {
    const mode =
      (this.config.get<string>('ORDER_CREDIT_CHECK_MODE') as
        | 'strict'
        | 'warning'
        | 'off') || 'strict';
    return new CreditCheckPolicy({ mode });
  }

  private getFloorPricePolicy(): FloorPricePolicy {
    const mode =
      (this.config.get<string>('ORDER_FLOOR_PRICE_MODE') as
        | 'strict'
        | 'warning'
        | 'off') || 'strict';
    return new FloorPricePolicy({ mode });
  }

  private async calculateUsedCredit(
    customerId: string,
    excludeOrderId?: string,
  ): Promise<number> {
    const sql = `
      SELECT COALESCE(SUM(pay_amount - collected_amount - prepayment_deducted), 0) as used
      FROM sales_orders
      WHERE customer_id = $1
        AND status NOT IN ('completed', 'cancelled')
        ${excludeOrderId ? 'AND id != $2' : ''}
    `;
    const params = excludeOrderId ? [customerId, excludeOrderId] : [customerId];
    const result = await this.orderRepo.query(sql, params);
    return Number(result[0]?.used || 0);
  }

  private async runFloorPriceCheck(
    items: { skuId: string; unitPrice: number }[],
  ): Promise<string | null> {
    const policy = this.getFloorPricePolicy();
    const warnings: string[] = [];

    for (const item of items) {
      const sku = await this.productsService.findSkuById(item.skuId);
      if (!sku) continue;

      const result = policy.check({
        floorPrice: sku.floorPrice ?? null,
        quotedPrice: item.unitPrice,
      });

      if (!result.passed) {
        throw new BadRequestException(
          `SKU「${sku.skuName || sku.skuCode}」${result.reason}`,
        );
      }
      if (result.reason) {
        warnings.push(`SKU「${sku.skuName || sku.skuCode}」${result.reason}`);
      }
    }

    return warnings.length ? warnings.join('；') : null;
  }

  private parseDeliveryDate(
    value: Date | string | undefined,
  ): Date | null {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  async create(
    dto: CreateSalesOrderDto,
    creatorId: string,
    tenantId?: string,
  ): Promise<SalesOrder> {
    const orderDate = new Date();
    const { items: builtItems, totalAmount } = await this.itemBuilder.build(
      dto.items || [],
      orderDate,
      tenantId,
    );

    const floorPriceWarning = await this.runFloorPriceCheck(
      builtItems.map((i) => ({ skuId: i.skuId, unitPrice: i.unitPrice })),
    );

    return this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(SalesOrderItem);
      const orderRepo = manager.getRepository(SalesOrder);

      const order = orderRepo.create({
        customerId: dto.customerId,
        type: dto.type,
        salespersonId: dto.salespersonId,
        creatorId,
        tenantId,
        totalAmount,
        discountAmount: 0,
        payAmount: totalAmount,
        remark: dto.remark,
        deliveryDate: this.parseDeliveryDate(dto.deliveryDate),
        invoiceDate: this.parseDeliveryDate(dto.invoiceDate),
        paymentDueDate: this.parseDeliveryDate(dto.paymentDueDate),
        invoicedAmount: dto.invoicedAmount ?? 0,
        floorPriceWarning,
        attachments: dto.attachments || [],
        consignee: dto.consignee,
        consigneePhone: dto.consigneePhone,
        consigneeAddress: dto.consigneeAddress,
        status: SalesOrderStatus.DRAFT,
        items: builtItems.map((i) => itemRepo.create(i)),
      });

      return orderRepo.save(order);
    });
  }

  async update(orderId: string, dto: UpdateSalesOrderDto, tenantId?: string) {
    let floorPriceWarning: string | null = null;

    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(SalesOrder);
      const itemRepo = manager.getRepository(SalesOrderItem);

      const order = await orderRepo.findOne({
        where: { id: orderId },
        relations: ['items'],
      });
      if (!order) throw new NotFoundException('Sales order not found');

      if (
        ![SalesOrderStatus.DRAFT, SalesOrderStatus.REJECTED, SalesOrderStatus.APPROVED].includes(
          order.status,
        )
      ) {
        throw new BadRequestException('只有草稿、已驳回或已批准的订单可以编辑');
      }

      if (dto.customerId !== undefined) order.customerId = dto.customerId;
      if (dto.salespersonId !== undefined)
        order.salespersonId = dto.salespersonId;
      if (dto.remark !== undefined) order.remark = dto.remark;
      if (dto.deliveryDate !== undefined)
        order.deliveryDate = this.parseDeliveryDate(dto.deliveryDate);
      if (dto.consignee !== undefined) order.consignee = dto.consignee;
      if (dto.consigneePhone !== undefined)
        order.consigneePhone = dto.consigneePhone;
      if (dto.consigneeAddress !== undefined)
        order.consigneeAddress = dto.consigneeAddress;
      if (dto.invoiceDate !== undefined)
        order.invoiceDate = this.parseDeliveryDate(dto.invoiceDate);
      if (dto.paymentDueDate !== undefined)
        order.paymentDueDate = this.parseDeliveryDate(dto.paymentDueDate);
      if (dto.invoicedAmount !== undefined)
        order.invoicedAmount = Number(dto.invoicedAmount || 0);

      if (dto.items) {
        if (order.items) {
          await itemRepo.remove(order.items);
        }

        const orderDate = new Date(order.createdAt);
        const { items: builtItems, totalAmount } = await this.itemBuilder.build(
          dto.items,
          orderDate,
          tenantId,
        );

        floorPriceWarning = await this.runFloorPriceCheck(
          builtItems.map((i) => ({ skuId: i.skuId, unitPrice: i.unitPrice })),
        );

        order.totalAmount = totalAmount;
        order.payAmount = totalAmount;
        order.items = builtItems.map((i) => itemRepo.create(i));
      }

      order.floorPriceWarning = floorPriceWarning;
      order.creditWarning = null; // 重置信用预警，提交时重新计算
      order.status = SalesOrderStatus.DRAFT;
      return orderRepo.save(order);
    });
  }

  async submit(orderId: string, ctx: SubmitContext): Promise<SalesOrder> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['customer', 'items', 'salesperson'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== SalesOrderStatus.DRAFT) {
      throw new BadRequestException('Only draft order can be submitted');
    }

    const customer = order.customer;
    if (customer) {
      const usedCredit = await this.calculateUsedCredit(
        customer.id,
        orderId,
      );
      const policy = this.getCreditCheckPolicy();
      const result = policy.check({
        creditLimit: Number(customer.creditLimit || 0),
        isCreditBlocked: customer.isCreditBlocked,
        usedCredit,
        orderAmount: Number(order.payAmount || 0),
      });

      if (!result.passed) {
        throw new BadRequestException(result.reason);
      }

      order.creditWarning = result.reason || null;
    }

    await this.approvalService.submitForApproval(
      order,
      ctx.feishuUserId,
      ctx.approvalDefCode,
      ctx.feishuUserIdType,
    );

    order.status = SalesOrderStatus.PENDING_APPROVAL;
    return this.orderRepo.save(order);
  }

  async approve(orderId: string, _ctx: ApproveContext): Promise<SalesOrder> {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== SalesOrderStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Order is not pending approval');
    }

    order.status = SalesOrderStatus.APPROVED;
    await this.orderRepo.save(order);

    // 自动触发库存检查与委外加工流程（不阻塞审批）
    this.processApprovedOrder(order).catch((err: any) => {
      this.logger.warn(`Order processing failed for ${order.id}: ${err.message}`);
    });

    return order;
  }

  private async processApprovedOrder(order: SalesOrder) {
    const orderWithItems = await this.orderRepo.findOne({
      where: { id: order.id },
      relations: ['items'],
    });
    if (!orderWithItems?.items?.length) {
      // 无 items，直接标记为待发货
      await this.orderRepo.update(order.id, { status: SalesOrderStatus.READY_TO_SHIP });
      return;
    }

    const itemsNeedProcessing: typeof orderWithItems.items = [];
    const itemsInStock: typeof orderWithItems.items = [];

    for (const item of orderWithItems.items) {
      const skuId = item.skuId || '';
      if (!skuId) continue;

      const sku = await this.productsService.findSkuById(skuId);
      const skuKey = sku?.jstSkuId || sku?.skuCode || skuId;
      const orderQty = Number(item.qty);

      // 查询本地库存
      const stockRows = await this.orderRepo.query(
        `SELECT qty FROM local_stock_balances WHERE sku_id = $1`,
        [skuKey],
      );
      const localStock = Number(stockRows[0]?.qty || 0);

      // 查询已预留库存
      const reservedQty = await this.stockReservationsService.getReservedQty(skuKey);
      const availableStock = Math.max(0, localStock - reservedQty);

      if (availableStock >= orderQty) {
        // 库存充足 → 预留
        await this.stockReservationsService.reserve(order.id, skuKey, orderQty);
        itemsInStock.push(item);
      } else {
        // 库存不足 → 需要委外加工
        itemsNeedProcessing.push(item);
      }
    }

    // 全部有现货 → 直接待发货
    if (itemsNeedProcessing.length === 0) {
      await this.orderRepo.update(order.id, { status: SalesOrderStatus.READY_TO_SHIP });
      this.logger.log(`Order ${order.id} has all items in stock, marked as READY_TO_SHIP`);
      return;
    }

    // 有缺货 → 进入加工中状态
    await this.orderRepo.update(order.id, { status: SalesOrderStatus.PROCESSING });
    this.logger.log(`Order ${order.id} has ${itemsNeedProcessing.length} items out of stock, marked as PROCESSING`);

    // 为缺货 SKU 创建委外加工单和采购申请
    for (const item of itemsNeedProcessing) {
      const skuId = item.skuId || '';
      if (!skuId) continue;

      const sku = await this.productsService.findSkuById(skuId);
      const skuKey = sku?.jstSkuId || sku?.skuCode || skuId;
      const skuName = sku?.skuName || item.skuName || skuId;
      const orderQty = Number(item.qty);

      // 查找默认生效 BOM
      const bom = await this.bomsService.findActiveBySku(skuKey);
      if (!bom?.items?.length) {
        // 无 BOM → 直接外购成品
        const supplierId = sku?.defaultSupplierId || null;
        try {
          await this.purchaseRequestsService.create({
            salesOrderId: order.id,
            status: 'approved',
            remark: `自动采购: 销售订单 ${order.orderNo} 成品 ${skuName}`,
            items: [{
              skuId: skuKey,
              skuCode: sku?.skuCode,
              skuName,
              qty: orderQty,
              supplierId: supplierId || undefined,
              remark: `成品外购`,
            }],
          });
          this.logger.log(`Auto-created purchase request for finished good ${skuKey}`);
        } catch (err: any) {
          this.logger.warn(`Failed to create purchase request for ${skuKey}: ${err.message}`);
        }
        continue;
      }

      // 有 BOM → 创建委外加工单
      const processorId = sku?.defaultProcessorId || null;
      try {
        await this.productionOrdersService.create({
          bomId: bom.id,
          qty: orderQty,
          salesOrderId: order.id,
          type: 'outsourced' as any,
          supplierId: processorId || undefined,
          remark: `委外加工: 销售订单 ${order.orderNo}`,
        });
        this.logger.log(`Auto-created outsourced production order for BOM ${bom.id}, qty=${orderQty}`);
      } catch (err: any) {
        this.logger.warn(`Failed to create production order: ${err.message}`);
        continue;
      }

      // 按 BOM 拆解原材料，按供应商分组创建采购申请
      const materialsBySupplier = new Map<string, {
        skuId: string;
        skuCode?: string;
        skuName?: string;
        qty: number;
      }[]>();

      for (const bomItem of bom.items) {
        const materialSku = await this.productsService.findSkuById(bomItem.materialSkuId);
        const materialSupplierId = materialSku?.defaultSupplierId || 'unspecified';
        const materialQty = Number((bomItem.qty * orderQty).toFixed(4));

        const list = materialsBySupplier.get(materialSupplierId) || [];
        list.push({
          skuId: bomItem.materialSkuId,
          skuCode: materialSku?.skuCode,
          skuName: materialSku?.skuName || bomItem.materialSkuId,
          qty: materialQty,
        });
        materialsBySupplier.set(materialSupplierId, list);
      }

      // 按供应商创建采购申请
      for (const [supplierId, materials] of materialsBySupplier) {
        try {
          await this.purchaseRequestsService.create({
            salesOrderId: order.id,
            status: 'approved',
            remark: `委外加工原材料: 销售订单 ${order.orderNo} → SKU ${skuName}`,
            items: materials.map((m) => ({
              skuId: m.skuId,
              skuCode: m.skuCode,
              skuName: m.skuName,
              qty: m.qty,
              supplierId: supplierId === 'unspecified' ? undefined : supplierId,
              bomId: bom.id,
              remark: `原材料: ${m.skuName}`,
            })),
          });
          this.logger.log(`Auto-created purchase request for supplier ${supplierId} with ${materials.length} materials`);
        } catch (err: any) {
          this.logger.warn(`Failed to create purchase request for supplier ${supplierId}: ${err.message}`);
        }
      }
    }
  }

  async reject(orderId: string, _ctx: RejectContext): Promise<SalesOrder> {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== SalesOrderStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Order is not pending approval');
    }

    order.status = SalesOrderStatus.REJECTED;
    await this.orderRepo.save(order);

    // 释放库存预留
    await this.stockReservationsService.releaseBySalesOrder(orderId);

    return order;
  }

  async pushToJushuitan(orderId: string): Promise<{
    order: SalesOrder;
    jushuitanOrderId: string | null;
  }> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'customer', 'salesperson'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (![SalesOrderStatus.APPROVED, SalesOrderStatus.READY_TO_SHIP].includes(order.status)) {
      throw new BadRequestException('只有已审批或待发货的订单可以推送');
    }
    if (!order.salesperson?.jushuitanShopId) {
      throw new BadRequestException(
        `业务员「${order.salesperson?.name || '-'}」未配置聚水潭店铺ID`,
      );
    }

    // 校验 SKU 关联完整性（不自动修复）
    const missingCodes: string[] = [];
    for (const item of order.items || []) {
      if (item.skuId && !item.jstSkuId) {
        const sku = await this.productsService.findSkuById(item.skuId);
        if (sku?.jstSkuId) {
          item.jstSkuId = sku.jstSkuId;
          item.skuCode = sku.skuCode;
        }
      }
      if (!item.jstSkuId) {
        missingCodes.push(item.skuName || item.productName || '未知商品');
      }
    }
    if (missingCodes.length) {
      throw new BadRequestException(
        `以下商品缺少聚水潭平台编码（jstSkuId）：${missingCodes.join('、')}`,
      );
    }

    const res = (await this.jstService.createSalesOrder(order)) as Record<
      string,
      unknown
    >;
    const isSuccess = res?.code === 0 || res?.success === true;
    if (!isSuccess) {
      throw new BadRequestException(
        (res?.msg as string) || 'Jushuitan push failed',
      );
    }

    order.status = SalesOrderStatus.SYNCED_JST;
    await this.orderRepo.save(order);

    const data = res?.data as Record<string, unknown>;
    const datas = data?.datas as Record<string, unknown>[];
    const jushuitanOrderId = (datas?.[0]?.o_id as string) || null;

    return { order, jushuitanOrderId };
  }

  async markShipped(
    orderId: string,
    _deliveryData?: unknown,
  ): Promise<SalesOrder> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');

    if (
      ![SalesOrderStatus.APPROVED, SalesOrderStatus.READY_TO_SHIP, SalesOrderStatus.SYNCED_JST].includes(
        order.status,
      )
    ) {
      this.logger.warn(
        `Cannot mark shipped: order ${orderId} status is ${order.status}`,
      );
      return order;
    }

    // 扣减本地库存
    for (const item of order.items || []) {
      if (!item.skuId || !item.qty) continue;
      await this.stockLedger.deductOutbound({
        skuId: item.skuId,
        qty: Number(item.qty),
        referenceType: 'sales_order',
        referenceId: order.id,
        remark: `销售订单发货: ${order.orderNo || order.id}`,
      });
    }

    // 释放库存预留
    await this.stockReservationsService.releaseBySalesOrder(orderId);

    // 自动生成发票草稿（不阻塞发货）
    try {
      const amount = Number(order.payAmount || 0);
      if (amount > 0) {
        await this.invoicesService.create({
          invoiceNo: `FP-${order.orderNo || order.id.slice(0, 8)}-${Date.now().toString().slice(-4)}`,
          salesOrderId: order.id,
          amount,
          invoiceDate: new Date().toISOString(),
          status: 'draft' as any,
          remark: '发货自动生成',
        });
        this.logger.log(`Auto-generated invoice draft for order ${order.id}`);
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to auto-generate invoice for order ${order.id}: ${err.message}`,
      );
    }

    // 自动生成应收凭证（不阻塞发货）
    try {
      const amount = Number(order.payAmount || 0);
      await this.vouchersService.create({
        voucherNo: '',
        voucherDate: new Date().toISOString(),
        type: 'receivable' as any,
        description: `销售订单发货: ${order.orderNo || order.id}`,
        totalAmount: amount,
        sourceType: 'sales_order',
        sourceId: order.id,
        items: [
          {
            accountCode: '1122',
            accountName: '应收账款',
            debitAmount: amount,
            creditAmount: 0,
          },
          {
            accountCode: '6001',
            accountName: '主营业务收入',
            debitAmount: 0,
            creditAmount: amount,
          },
        ],
      } as any);
      this.logger.log(`Auto-generated receivable voucher for order ${order.id}`);
    } catch (err: any) {
      this.logger.warn(
        `Failed to auto-generate voucher for order ${order.id}: ${err.message}`,
      );
    }

    // 自动生成出库单
    try {
      const deliveryItems =
        order.items
          ?.filter((it) => it.skuId && it.qty)
          .map((it) => ({
            salesOrderItemId: it.id,
            skuId: it.skuId!,
            qty: Number(it.qty),
          })) || [];
      if (deliveryItems.length > 0) {
        await this.deliveriesService.create({
          salesOrderId: order.id,
          items: deliveryItems,
          isTransferredToFinance: true,
        });
        this.logger.log(`Auto-generated delivery order for order ${order.id}`);
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to auto-generate delivery order for order ${order.id}: ${err.message}`,
      );
    }

    order.status = SalesOrderStatus.SHIPPED;
    return this.orderRepo.save(order);
  }

  async checkCompletion(orderId: string): Promise<SalesOrder> {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');

    const totalCollected =
      Number(order.collectedAmount || 0) +
      Number(order.prepaymentDeducted || 0);
    if (totalCollected >= Number(order.payAmount || 0) - 0.01) {
      order.status = SalesOrderStatus.COMPLETED;
      return this.orderRepo.save(order);
    }

    return order;
  }
}
