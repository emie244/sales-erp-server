import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like } from 'typeorm';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SalesOrder, SalesOrderStatus } from '../sales/entities/sales-order.entity';
import { ApprovalService } from '../approvals/approval.service';
import { PurchaseOrderStatusLogsService } from './purchase-order-status-logs.service';
import { BomsService } from '../boms/boms.service';
import { StockLedgerService } from '../stocks/stock-ledger.service';
import { VouchersService } from '../vouchers/vouchers.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly orderRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly itemRepo: Repository<PurchaseOrderItem>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(SalesOrder)
    private readonly salesOrderRepo: Repository<SalesOrder>,
    private readonly dataSource: DataSource,
    private readonly approvalService: ApprovalService,
    private readonly statusLogsService: PurchaseOrderStatusLogsService,
    private readonly bomsService: BomsService,
    private readonly stockLedger: StockLedgerService,
    private readonly vouchersService: VouchersService,
  ) {}

  private async generateOrderNo(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `CG-${dateStr}`;

    const count = await this.orderRepo.count({
      where: { orderNo: Like(`${prefix}-%`) },
    });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  async create(dto: CreatePurchaseOrderDto, creatorId?: string) {
    const orderNo = await this.generateOrderNo();

    // Collect unique supplier IDs from items
    const itemSupplierIds = new Set<string>();
    for (const item of dto.items || []) {
      if (item.supplierId) itemSupplierIds.add(item.supplierId);
    }

    // Validate item-level suppliers
    const supplierMap = new Map<string, string>();
    for (const sid of itemSupplierIds) {
      const sup = await this.supplierRepo.findOneBy({
        id: sid,
        isActive: true,
      });
      if (!sup) throw new NotFoundException(`供应商不存在或已停用: ${sid}`);
      supplierMap.set(sid, sup.name);
    }

    // Order-level supplier: prefer dto.supplierId, fallback to first item supplier
    let orderSupplierId = dto.supplierId;
    let orderSupplierName: string | undefined;
    if (orderSupplierId) {
      const sup = await this.supplierRepo.findOneBy({
        id: orderSupplierId,
        isActive: true,
      });
      if (!sup) throw new NotFoundException('供应商不存在或已停用');
      orderSupplierName = sup.name;
    } else if (supplierMap.size > 0) {
      const firstId = Array.from(supplierMap.keys())[0];
      orderSupplierId = firstId;
      orderSupplierName = supplierMap.get(firstId);
    }

    let totalAmount = 0;
    const items = (dto.items || []).map((item) => {
      const lineAmount = Number((item.qty * item.unitPrice).toFixed(2));
      totalAmount += lineAmount;
      return this.itemRepo.create({
        skuId: item.skuId,
        skuCode: item.skuCode,
        skuName: item.skuName,
        qty: item.qty,
        unitPrice: item.unitPrice,
        lineAmount,
        remark: item.remark,
        bomId: item.bomId,
        supplierId: item.supplierId || orderSupplierId || undefined,
        supplierName:
          item.supplierName ||
          supplierMap.get(item.supplierId || '') ||
          orderSupplierName,
      });
    });

    const parseDate = (v: Date | string | undefined): Date | null => {
      if (!v) return null;
      const d = v instanceof Date ? v : new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };

    const order = this.orderRepo.create({
      orderNo,
      supplierId: orderSupplierId,
      supplierName: orderSupplierName,
      status: PurchaseOrderStatus.DRAFT,
      totalAmount: Number(totalAmount.toFixed(2)),
      remark: dto.remark,
      creatorId,
      expectedDeliveryDate: parseDate(dto.expectedDeliveryDate),
      items,
    });

    return this.orderRepo.save(order);
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    supplierId?: string;
    keyword?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const qb = this.orderRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.items', 'items')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .leftJoinAndSelect('po.creator', 'creator')
      .orderBy('po.createdAt', 'DESC');

    if (params.status) {
      qb.andWhere('po.status = :status', { status: params.status });
    }
    if (params.supplierId) {
      qb.andWhere('po.supplierId = :supplierId', {
        supplierId: params.supplierId,
      });
    }
    if (params.keyword) {
      qb.andWhere(
        '(po.orderNo ILIKE :keyword OR supplier.name ILIKE :keyword)',
        { keyword: `%${params.keyword}%` },
      );
    }

    const [data, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data, total, page, pageSize };
  }

  async findOne(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items', 'supplier', 'creator'],
    });
    if (!order) throw new NotFoundException('采购单不存在');
    return order;
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(PurchaseOrder);
      const itemRepo = manager.getRepository(PurchaseOrderItem);

      const order = await orderRepo.findOne({
        where: { id },
        relations: ['items'],
      });
      if (!order) throw new NotFoundException('采购单不存在');
      const editableStatuses = [
        PurchaseOrderStatus.DRAFT,
        PurchaseOrderStatus.REJECTED,
        PurchaseOrderStatus.REVERTED,
      ];
      if (!editableStatuses.includes(order.status)) {
        throw new BadRequestException('仅草稿、已驳回或已撤销的采购单可编辑');
      }

      if (dto.supplierId && dto.supplierId !== order.supplierId) {
        const supplier = await manager.findOne(Supplier, {
          where: { id: dto.supplierId, isActive: true },
        });
        if (!supplier) throw new NotFoundException('供应商不存在或已停用');
        order.supplierId = dto.supplierId;
        order.supplierName = supplier.name;
      }

      if (dto.remark !== undefined) order.remark = dto.remark;
      if (dto.expectedDeliveryDate !== undefined) {
        const d =
          dto.expectedDeliveryDate instanceof Date
            ? dto.expectedDeliveryDate
            : new Date(dto.expectedDeliveryDate);
        order.expectedDeliveryDate = isNaN(d.getTime()) ? null : d;
      }

      if (dto.items) {
        if (order.items?.length) {
          await itemRepo.remove(order.items);
        }

        // Collect and validate item-level suppliers
        const itemSupplierIds = new Set<string>();
        for (const item of dto.items) {
          if (item.supplierId) itemSupplierIds.add(item.supplierId);
        }
        const supplierMap = new Map<string, string>();
        for (const sid of itemSupplierIds) {
          const sup = await manager.findOne(Supplier, {
            where: { id: sid, isActive: true },
          });
          if (!sup) throw new NotFoundException(`供应商不存在或已停用: ${sid}`);
          supplierMap.set(sid, sup.name);
        }

        let totalAmount = 0;
        const newItems = dto.items.map((item) => {
          const lineAmount = Number((item.qty * item.unitPrice).toFixed(2));
          totalAmount += lineAmount;
          return itemRepo.create({
            purchaseOrderId: order.id,
            skuId: item.skuId,
            skuCode: item.skuCode,
            skuName: item.skuName,
            qty: item.qty,
            unitPrice: item.unitPrice,
            lineAmount,
            remark: item.remark,
            bomId: item.bomId,
            supplierId: item.supplierId || order.supplierId || undefined,
            supplierName:
              item.supplierName ||
              supplierMap.get(item.supplierId || '') ||
              order.supplierName,
          });
        });
        await itemRepo.save(newItems);
        order.totalAmount = Number(totalAmount.toFixed(2));
        order.items = newItems;
      }

      return orderRepo.save(order);
    });
  }

  async remove(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('采购单不存在');
    const deletableStatuses = [
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.REJECTED,
      PurchaseOrderStatus.REVERTED,
    ];
    if (!deletableStatuses.includes(order.status)) {
      throw new BadRequestException('仅草稿、已驳回或已撤销的采购单可删除');
    }
    await this.orderRepo.remove(order);
    return { id };
  }

  async submitForApproval(
    id: string,
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items', 'supplier'],
    });
    if (!order) throw new NotFoundException('采购单不存在');
    const submittableStatuses = [
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.REJECTED,
      PurchaseOrderStatus.REVERTED,
    ];
    if (!submittableStatuses.includes(order.status)) {
      throw new BadRequestException('仅草稿、已驳回或已撤销的采购单可提交审批');
    }

    // Load BOM info for items with bomId
    const bomIds = [
      ...new Set((order.items || []).map((i) => i.bomId).filter(Boolean)),
    ];
    const bomMap: Record<string, { skuId: string; version: string }> = {};
    if (bomIds.length > 0) {
      await Promise.all(
        bomIds.map(async (bomId) => {
          try {
            const bom = await this.bomsService.findOne(bomId);
            bomMap[bomId] = {
              skuId: bom.skuId,
              version: bom.version,
            };
          } catch {
            // ignore missing BOM
          }
        }),
      );
    }
    (order as any).bomMap = bomMap;

    const fromStatus = order.status;

    const record = await this.approvalService.submitPurchaseOrderForApproval(
      order,
      feishuUserId,
      approvalDefCode,
      feishuUserIdType,
    );

    order.status = PurchaseOrderStatus.PENDING_APPROVAL;
    order.approvalInstanceCode = record.feishuInstanceCode;
    await this.orderRepo.save(order);

    await this.statusLogsService.create({
      purchaseOrderId: order.id,
      fromStatus,
      toStatus: PurchaseOrderStatus.PENDING_APPROVAL,
      remark: '提交审批',
    });

    return record;
  }

  async receive(id: string, dto: ReceivePurchaseOrderDto) {
    const result = await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(PurchaseOrder);
      const itemRepo = manager.getRepository(PurchaseOrderItem);

      const order = await orderRepo.findOne({
        where: { id },
        relations: ['items'],
      });
      if (!order) throw new NotFoundException('采购单不存在');
      if (
        ![
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.PARTIAL_RECEIVED,
        ].includes(order.status)
      ) {
        throw new BadRequestException(
          '仅已审批或部分到货的采购单可执行到货入库',
        );
      }

      const itemMap = new Map(order.items.map((i) => [i.id, i]));
      let allReceived = true;

      for (const rec of dto.items) {
        const item = itemMap.get(rec.itemId);
        if (!item) throw new BadRequestException(`采购项不存在: ${rec.itemId}`);

        const newReceived =
          Number(item.receivedQty || 0) + Number(rec.receiveQty);
        if (newReceived > Number(item.qty)) {
          throw new BadRequestException(
            `到货数量不能超过采购数量: ${item.skuName || item.skuId}`,
          );
        }

        item.receivedQty = newReceived;
        await itemRepo.save(item);

        // 增加本地库存
        if (item.skuId && rec.receiveQty > 0) {
          await this.stockLedger.addInbound({
            skuId: item.skuId,
            qty: Number(rec.receiveQty),
            referenceType: 'purchase_order',
            referenceId: order.id,
            remark: `采购单到货: ${order.orderNo}, SKU: ${item.skuName || item.skuId}`,
          });
        }

        if (newReceived < Number(item.qty)) {
          allReceived = false;
        }
      }

      const fromStatus = order.status;
      order.status = allReceived
        ? PurchaseOrderStatus.RECEIVED
        : PurchaseOrderStatus.PARTIAL_RECEIVED;
      await orderRepo.save(order);

      const remarks = dto.items
        .map((rec) => {
          const item = itemMap.get(rec.itemId);
          return `${item!.skuName || item!.skuId} +${rec.receiveQty}`;
        })
        .join(', ');
      await this.statusLogsService.create(
        {
          purchaseOrderId: order.id,
          fromStatus,
          toStatus: order.status,
          remark: `到货入库: ${remarks}`,
        },
        manager,
      );

      // 自动生成应付凭证（不阻塞入库）
      let voucherAmount = 0;
      for (const rec of dto.items) {
        const item = itemMap.get(rec.itemId);
        if (item && rec.receiveQty > 0) {
          voucherAmount += Number((item.unitPrice * rec.receiveQty).toFixed(2));
        }
      }

      if (voucherAmount > 0) {
        try {
          await this.vouchersService.create({
            voucherNo: '',
            voucherDate: new Date().toISOString(),
            type: 'payable' as any,
            description: `采购单到货: ${order.orderNo}`,
            totalAmount: voucherAmount,
            sourceType: 'purchase_order',
            sourceId: order.id,
            items: [
              {
                accountCode: '1403',
                accountName: '原材料',
                debitAmount: voucherAmount,
                creditAmount: 0,
              },
              {
                accountCode: '2202',
                accountName: '应付账款',
                debitAmount: 0,
                creditAmount: voucherAmount,
              },
            ],
          } as any);
        } catch (err: any) {
          // 静默失败，不阻塞入库流程
        }
      }

      // 异步检查可发货销售订单（不阻塞入库）
      this.checkAndAutoShip().catch(() => {});

      return order;
    });

    // 检查交期预警（不阻塞入库）
    this.checkDeliveryWarning(result).catch(() => {});

    return result;
  }

  private async checkAndAutoShip() {
    const orders = await this.salesOrderRepo.find({
      where: { status: SalesOrderStatus.APPROVED },
      relations: ['items'],
      order: { createdAt: 'ASC' },
    });

    for (const so of orders) {
      if (!so.items?.length) continue;
      let allocable = true;
      for (const item of so.items) {
        if (!item.skuId || !item.qty) continue;
        const rows = await this.dataSource.query(
          `SELECT qty FROM local_stock_balances WHERE sku_id = $1`,
          [item.skuId],
        );
        if (Number(rows[0]?.qty || 0) < Number(item.qty) - 0.001) {
          allocable = false;
          break;
        }
      }
      if (allocable) {
        try {
          await this.salesOrderRepo.update(so.id, {
            status: SalesOrderStatus.SYNCED_JST,
          });
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * 检查采购单交期是否影响关联销售订单
   * 当采购单预期交货日晚于销售订单客户要求交货日时触发预警
   */
  async checkDeliveryWarning(purchaseOrder: PurchaseOrder): Promise<void> {
    if (!purchaseOrder.expectedDeliveryDate) return;

    const poDeliveryDate = new Date(purchaseOrder.expectedDeliveryDate);

    // 通过 purchase_request 找到关联的销售订单
    const salesOrders = await this.dataSource.query(
      `
      SELECT so.id, so.delivery_date, so.delivery_warning
      FROM sales_orders so
      JOIN purchase_requests pr ON pr.sales_order_id = so.id
      WHERE pr.converted_po_id = $1
      `,
      [purchaseOrder.id],
    );

    for (const row of salesOrders) {
      if (!row.delivery_date) continue;

      const soDeliveryDate = new Date(row.delivery_date);
      if (poDeliveryDate > soDeliveryDate) {
        const warning =
          `关联采购单 ${purchaseOrder.orderNo} 预期交货日 (${this.formatDate(poDeliveryDate)}) ` +
          `晚于客户要求交货日 (${this.formatDate(soDeliveryDate)})`;
        await this.appendDeliveryWarning(row.id, warning);
      }
    }
  }

  private async appendDeliveryWarning(
    salesOrderId: string,
    warning: string,
  ): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT delivery_warning FROM sales_orders WHERE id = $1`,
      [salesOrderId],
    );
    const existing = rows[0]?.delivery_warning || '';
    if (existing.includes(warning)) return;

    const newWarning = existing ? `${existing}; ${warning}` : warning;
    await this.dataSource.query(
      `UPDATE sales_orders SET delivery_warning = $1 WHERE id = $2`,
      [newWarning, salesOrderId],
    );
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /**
   * 查询某 SKU 的可用采购批次（已到货的采购单明细）
   */
  async findAvailableBatches(skuId: string) {
    const rows = await this.dataSource.query(
      `
      SELECT
        poi.id as "purchaseOrderItemId",
        po.order_no as "orderNo",
        poi.sku_id as "skuId",
        poi.sku_name as "skuName",
        poi.received_qty as "receivedQty",
        poi.supplier_name as "supplierName",
        po.created_at as "createdAt"
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.purchase_order_id
      WHERE poi.sku_id = $1
        AND poi.received_qty > 0
      ORDER BY po.created_at DESC
      `,
      [skuId],
    );
    return rows as {
      purchaseOrderItemId: string;
      orderNo: string;
      skuId: string;
      skuName: string;
      receivedQty: number;
      supplierName: string;
      createdAt: string;
    }[];
  }
}
