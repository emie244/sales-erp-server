import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrder, SalesOrderStatus } from './entities/sales-order.entity';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { ProductsService } from '../products/products.service';
import { JushuitanService } from '../integrations/jushuitan.service';
import { OrderLifecycle } from './services/order-lifecycle.service';
import { CollectionLifecycle } from './services/collection-lifecycle.service';
import { SalesOrderQueryService } from './services/sales-order-query.service';
import { BomsService } from '../boms/boms.service';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    private readonly orderLifecycle: OrderLifecycle,
    private readonly collectionLifecycle: CollectionLifecycle,
    private readonly queryService: SalesOrderQueryService,
    private readonly productsService: ProductsService,
    private readonly jstService: JushuitanService,
    private readonly bomsService: BomsService,
  ) {}

  async create(dto: CreateSalesOrderDto, creatorId: string, tenantId?: string) {
    return this.orderLifecycle.create(dto, creatorId, tenantId);
  }

  async findAll(
    page: number = 1,
    pageSize: number = 20,
    filters?: Parameters<SalesOrderQueryService['findAll']>[2],
  ) {
    return this.queryService.findAll(page, pageSize, filters);
  }

  async findOne(id: string) {
    return this.queryService.findOne(id);
  }

  async submit(
    orderId: string,
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ) {
    return this.orderLifecycle.submit(orderId, {
      feishuUserId,
      approvalDefCode,
      feishuUserIdType,
    });
  }

  async batchSubmit(
    ids: string[],
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ) {
    const results = {
      success: [] as string[],
      failed: [] as { id: string; reason: string }[],
    };

    for (const id of ids) {
      try {
        await this.submit(id, feishuUserId, approvalDefCode, feishuUserIdType);
        results.success.push(id);
      } catch (err: unknown) {
        results.failed.push({
          id,
          reason: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  async batchPushJushuitan(ids: string[]) {
    const results = {
      success: [] as { id: string; jushuitanOrderId: string | null }[],
      failed: [] as { id: string; reason: string }[],
    };

    for (const id of ids) {
      try {
        const { order, jushuitanOrderId } =
          await this.orderLifecycle.pushToJushuitan(id);
        results.success.push({ id, jushuitanOrderId });
      } catch (err: unknown) {
        results.failed.push({
          id,
          reason: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  async submitCollectionForApproval(
    orderId: string,
    dto: CreateCollectionDto,
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ) {
    return this.collectionLifecycle.submitCollection(orderId, dto, {
      feishuUserId,
      approvalDefCode,
      feishuUserIdType,
    });
  }

  async updateOrder(orderId: string, dto: UpdateSalesOrderDto, tenantId?: string) {
    return this.orderLifecycle.update(orderId, dto, tenantId);
  }

  async updateCollection(orderId: string, dto: CreateCollectionDto) {
    return this.collectionLifecycle.updateCollection(orderId, dto);
  }

  async getAgingReport(tenantId?: string) {
    return this.queryService.getAgingReport(tenantId);
  }

  async getOverdueOrders(
    page: number = 1,
    pageSize: number = 20,
    tenantId?: string,
  ) {
    return this.queryService.getOverdueOrders(page, pageSize, tenantId);
  }

  async getProductionSuggestion(orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');

    const suggestions = [];
    for (const item of order.items || []) {
      const skuId = item.skuId || '';
      if (!skuId) continue;
      const sku = await this.productsService.findSkuById(skuId);
      const skuKey = sku?.jstSkuId || sku?.skuCode || skuId;

      // 查找活跃 BOM
      const bom = await this.bomsService.findActiveBySku(skuKey);

      // 查询本地库存
      const stockRows = await this.orderRepo.query(
        `SELECT qty FROM local_stock_balances WHERE sku_id = $1`,
        [skuKey],
      );
      const localStock = Number(stockRows[0]?.qty || 0);

      // 查询在途数量
      const inTransitRows = await this.orderRepo.query(
        `SELECT SUM(poi.qty - poi.received_qty) as in_transit
         FROM purchase_order_items poi
         JOIN purchase_orders po ON po.id = poi.purchase_order_id
         WHERE poi.sku_id = $1 AND po.status IN ('approved', 'partial_received')
           AND poi.qty > poi.received_qty`,
        [skuKey],
      );
      const inTransit = Number(inTransitRows[0]?.in_transit || 0);

      // 查询在产数量（pending + processing 的加工单）
      const inProductionRows = await this.orderRepo.query(
        `SELECT SUM(qty) as in_production
         FROM production_orders
         WHERE sku_id = $1 AND status IN ('pending', 'processing')`,
        [skuKey],
      );
      const inProduction = Number(inProductionRows[0]?.in_production || 0);

      const orderQty = Number(item.qty);
      const available = localStock + inTransit + inProduction;
      const gap = Math.max(0, orderQty - available);

      let materialNeeds: any[] = [];
      if (bom?.items?.length) {
        const needs = await this.bomsService.calculateMaterialRequirements([
          { skuId: skuKey, qty: gap },
        ]);
        materialNeeds = needs.map((n) => ({
          materialSkuId: n.materialSkuId,
          totalQty: n.totalQty,
        }));
      }

      suggestions.push({
        skuId: skuKey,
        skuName: sku?.skuName || item.skuName,
        skuCode: sku?.skuCode,
        orderQty,
        localStock,
        inTransit,
        inProduction,
        available,
        gap,
        hasBom: !!bom,
        bomId: bom?.id || null,
        materialNeeds: gap > 0 ? materialNeeds : [],
      });
    }

    return { orderId, suggestions };
  }
}
