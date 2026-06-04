import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Brackets, Raw } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Product, type ProductLifecycleStage } from './entities/product.entity';
import { ProductSku } from './entities/product-sku.entity';
import { PricePolicy } from './entities/price-policy.entity';
import { MaterialCategory } from '../material-categories/entities/material-category.entity';
import { SalesOrderItem } from '../sales/entities/sales-order-item.entity';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateProductDto, CreateSkuDto } from './dto/create-product.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { SKU_CODE_REGEX, mapItemType } from './sku-code.constants';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import * as ExcelJS from 'exceljs';
import {
  generateSpuCode,
  generateSkuCode,
  getPrefixByItemType,
  normalizeCategoryCode,
} from './sku-code.generator';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(ProductSku) private skuRepo: Repository<ProductSku>,
    @InjectRepository(PricePolicy) private priceRepo: Repository<PricePolicy>,
    @InjectRepository(SalesOrderItem) private salesItemRepo: Repository<SalesOrderItem>,
    @InjectRepository(SalesOrder) private salesOrderRepo: Repository<SalesOrder>,
    private readonly dataSource: DataSource,
    @InjectQueue('jushuitan-sync') private readonly syncQueue: Queue,
    private readonly notificationsService: NotificationsService,
  ) {}

  static inferLifecycleStage(
    launchDate: Date | string | null,
    explicitStage: ProductLifecycleStage | null,
  ): ProductLifecycleStage {
    if (explicitStage) return explicitStage;
    if (!launchDate) return 'concept';
    const ld = new Date(launchDate);
    const now = new Date();
    const diffMs = now.getTime() - ld.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'launching';
    if (diffDays <= 90) return 'new';
    if (diffDays <= 180) return 'growth';
    if (diffDays <= 365) return 'mature';
    return 'decline';
  }

  async create(
    dto: CreateProductDto,
    tenantId?: string,
    mode: 'quick' | 'step' = 'quick',
    userId?: string,
  ) {
    const explicitStage = dto.lifecycleStage
      ? (dto.lifecycleStage as ProductLifecycleStage)
      : null;

    // 生成 SPU 编码
    const categoryCode = normalizeCategoryCode(dto.category);
    const itemType =
      dto.itemType || dto.skus?.[0]?.itemType || 'finished_good';
    const prefix = getPrefixByItemType(itemType);
    const spuCode = await generateSpuCode(this.dataSource, {
      prefix,
      categoryCode,
    });

    const product = this.productRepo.create({
      name: dto.name,
      description: dto.description,
      category: dto.category,
      spuCode,
      itemType,
      launchDate: dto.launchDate ? new Date(dto.launchDate) : null,
      lifecycleStage: explicitStage,
      tenantId,
      isDraft: mode === 'step',
    });
    const saved = await this.productRepo.save(product);

    // 快速创建：同时创建首个 SKU
    if (mode === 'quick' && dto.skus?.length) {
      const firstSku = dto.skus[0];
      const skuCode = await generateSkuCode(this.dataSource, spuCode);
      const skuName =
        firstSku.skuName?.trim() ||
        `${saved.name}${firstSku.spec ? ' / ' + firstSku.spec : ''}`;

      const sku = this.skuRepo.create({
        ...firstSku,
        skuCode,
        skuName,
        productId: saved.id,
        category: saved.category,
        codeCompliant: true, // 自动生成的编码一定合规
        syncStatus: 'pending',
      });
      await this.skuRepo.save(sku);

      if (userId) {
        await this.syncQueue.add('push-sku', { skuId: sku.id, userId });
      }
    }

    // 分步创建：发送通知提醒完善 SKU
    if (mode === 'step' && userId) {
      await this.notificationsService.create({
        userId,
        type: 'system',
        title: '产品草稿待完善',
        content: `产品「${saved.name}」已保存为草稿，请前往草稿箱完善 SKU 信息`,
        relatedId: saved.id,
      });
    }

    return this.findOne(saved.id);
  }

  async addSkuToProduct(
    productId: string,
    dto: CreateSkuDto & { itemType?: string; materialCategoryId?: string },
    userId?: string,
  ) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (!product.spuCode) {
      throw new BadRequestException('该产品缺少 SPU 编码，无法添加 SKU');
    }

    const skuCode = await generateSkuCode(this.dataSource, product.spuCode);
    const skuName =
      dto.skuName?.trim() ||
      `${product.name}${dto.spec ? ' / ' + dto.spec : ''}`;

    const itemType =
      dto.itemType || product.itemType || 'finished_good';

    const sku = this.skuRepo.create({
      ...dto,
      skuCode,
      skuName,
      productId: product.id,
      category: product.category,
      itemType,
      codeCompliant: true,
      syncStatus: 'pending',
    });
    await this.skuRepo.save(sku);

    // 如果产品之前是草稿状态，添加首个 SKU 后转正
    if (product.isDraft) {
      const skuCount = await this.skuRepo.count({
        where: { productId: product.id },
      });
      if (skuCount > 0) {
        product.isDraft = false;
        await this.productRepo.save(product);
      }
    }

    if (userId) {
      await this.syncQueue.add('push-sku', { skuId: sku.id, userId });
    }

    return sku;
  }

  async findDrafts(
    page: number = 1,
    pageSize: number = 20,
    tenantId?: string,
  ) {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.skus', 'sku')
      .where('p.isDraft = true')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('p.createdAt', 'DESC');

    if (tenantId) {
      qb.andWhere('p.tenantId = :tenantId', { tenantId });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async findOne(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['skus'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findAll(
    page: number = 1,
    pageSize: number = 20,
    tenantId?: string,
    keyword?: string,
    sortField?: string,
    sortOrder?: 'ASC' | 'DESC',
    category?: string,
    isActive?: boolean,
    lifecycleStage?: string,
    brand?: string,
    itemTypes?: string[],
  ) {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.skus', 'sku')
      .where('p.isDraft = false')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (tenantId) {
      qb.andWhere('p.tenantId = :tenantId', { tenantId });
    }

    if (keyword) {
      qb.andWhere(
        '(p.name ILIKE :keyword OR p.description ILIKE :keyword OR p.category ILIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    if (category) {
      qb.andWhere('p.category = :category', { category });
    }

    if (isActive !== undefined) {
      qb.andWhere('p.isActive = :isActive', { isActive });
    }

    if (lifecycleStage) {
      qb.andWhere('p.lifecycleStage = :lifecycleStage', { lifecycleStage });
    }

    if (brand) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM product_skus ps2 WHERE ps2.product_id = p.id AND ps2.brand = :brand)`,
        { brand },
      );
    }

    if (itemTypes?.length) {
      const includesFinishedGood = itemTypes.includes('finished_good');
      if (includesFinishedGood) {
        const otherTypes = itemTypes.filter((t) => t !== 'finished_good');
        if (otherTypes.length) {
          qb.andWhere(
            '(p.itemType IN (:...otherTypes) OR p.itemType = :finishedGood OR p.itemType IS NULL)',
            { otherTypes, finishedGood: 'finished_good' },
          );
        } else {
          qb.andWhere("(p.itemType = 'finished_good' OR p.itemType IS NULL)");
        }
      } else {
        qb.andWhere('p.itemType IN (:...itemTypes)', { itemTypes });
      }
    }

    const orderField = sortField || 'createdAt';
    const orderDir = sortOrder || 'DESC';
    qb.orderBy(`p.${orderField}`, orderDir);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async findAllSkus(
    page: number = 1,
    pageSize: number = 50,
    tenantId?: string,
    keyword?: string,
    status?: string,
    governance?: 'uncategorized' | 'item_type_null' | 'non_compliant',
    itemTypes?: string[],
    excludeTypes?: string[],
  ) {
    const qb = this.skuRepo
      .createQueryBuilder('ps')
      .leftJoinAndSelect('ps.product', 'p')
      .orderBy('ps.createdAt', 'DESC');

    if (tenantId) {
      qb.andWhere('p.tenantId = :tenantId', { tenantId });
    }

    if (keyword) {
      qb.andWhere(
        `(ps.skuName ILIKE :keyword OR ps.skuCode ILIKE :keyword OR ps.jstSkuId ILIKE :keyword OR p.name ILIKE :keyword)`,
        { keyword: `%${keyword}%` },
      );
    }

    if (itemTypes?.length) {
      qb.andWhere(`ps.item_type IN (:...itemTypes)`, { itemTypes });
    }

    if (excludeTypes?.length) {
      qb.andWhere(
        `(ps.item_type IS NULL OR ps.item_type NOT IN (:...excludeTypes))`,
        { excludeTypes },
      );
    }

    if (governance === 'uncategorized') {
      qb.andWhere(`ps.item_type IN (:...materialTypes)`, {
        materialTypes: ['semi_finished', 'raw_material'],
      });
      qb.andWhere(`ps.material_category_id IS NULL`);
    } else if (governance === 'item_type_null') {
      qb.andWhere(`ps.item_type IS NULL`);
    } else if (governance === 'non_compliant') {
      qb.andWhere(`ps.code_compliant = false`);
    }

    let skus: ProductSku[];
    let total: number;

    if (!status) {
      qb.skip((page - 1) * pageSize).take(pageSize);
      const [result, count] = await qb.getManyAndCount();
      skus = result;
      total = count;
    } else {
      skus = await qb.getMany();
      total = skus.length;
    }

    const skuKeys = skus.map((s) => s.jstSkuId || s.skuCode).filter(Boolean);
    const skuIds = skus.map((s) => s.id);
    if (skuKeys.length || skuIds.length) {
      const stockSummary = skuKeys.length
        ? await this.dataSource.query(
            `
            SELECT sku_id, SUM("availableQty") as total,
              bool_or(safety_stock > 0 AND "availableQty" <= 0) as has_danger,
              bool_or(safety_stock > 0 AND "availableQty" < safety_stock AND "availableQty" > 0) as has_warning
            FROM stock_snapshots
            WHERE sku_id = ANY($1::text[])
            GROUP BY sku_id
            `,
            [skuKeys],
          )
        : [];

      const bomSummary = skuKeys.length
        ? await this.dataSource.query(
            `
            SELECT sku_id, version
            FROM bom_headers
            WHERE sku_id = ANY($1::text[]) AND "isActive" = true
            `,
            [skuKeys],
          )
        : [];

      // 在途数量：已审批或部分到货的采购单中未完全到货的数量
      const inTransitSummary = skuKeys.length
        ? await this.dataSource.query(
            `
            SELECT poi.sku_id, SUM(poi.qty - poi.received_qty) as in_transit_qty
            FROM purchase_order_items poi
            JOIN purchase_orders po ON po.id = poi.purchase_order_id
            WHERE poi.sku_id = ANY($1::text[])
              AND po.status IN ('approved', 'partial_received')
              AND poi.qty > poi.received_qty
            GROUP BY poi.sku_id
            `,
            [skuKeys],
          )
        : [];

      // BOM 采购需求：未完成加工单中所需原材料的未满足数量
      const bomDemandSummary = skuKeys.length
        ? await this.dataSource.query(
            `
            SELECT proi.material_sku_id as sku_id, SUM(proi.required_qty - proi.actual_qty) as bom_demand_qty
            FROM production_order_items proi
            JOIN production_orders pro ON pro.id = proi.production_order_id
            WHERE proi.material_sku_id = ANY($1::text[])
              AND pro.status IN ('pending', 'processing')
              AND proi.required_qty > proi.actual_qty
            GROUP BY proi.material_sku_id
            `,
            [skuKeys],
          )
        : [];

      // 本地库存余额：sku_id 是 character varying 类型
      const localBalanceSummary = skuIds.length
        ? await this.dataSource.query(
            `
            SELECT sku_id, qty
            FROM local_stock_balances
            WHERE sku_id = ANY($1::text[])
            `,
            [skuIds],
          )
        : [];

      const stockMap = new Map<string, Record<string, unknown>>(
        (stockSummary as Record<string, unknown>[]).map((s) => [
          s.sku_id as string,
          s,
        ]),
      );
      const bomMap = new Map<string, Record<string, unknown>>(
        (bomSummary as Record<string, unknown>[]).map((b) => [
          b.sku_id as string,
          b,
        ]),
      );
      const inTransitMap = new Map<string, Record<string, unknown>>(
        (inTransitSummary as Record<string, unknown>[]).map((i) => [
          i.sku_id as string,
          i,
        ]),
      );
      const bomDemandMap = new Map<string, Record<string, unknown>>(
        (bomDemandSummary as Record<string, unknown>[]).map((d) => [
          d.sku_id as string,
          d,
        ]),
      );
      const localBalanceMap = new Map<string, Record<string, unknown>>(
        (localBalanceSummary as Record<string, unknown>[]).map((b) => [
          b.sku_id as string,
          b,
        ]),
      );

      for (const sku of skus) {
        const key = sku.jstSkuId || sku.skuCode;
        const stock = key ? stockMap.get(key) : undefined;
        const skuRecord = sku as unknown as Record<string, unknown>;
        if (stock) {
          skuRecord.totalAvailableQty = Number(stock.total) || 0;
          if (stock.has_danger) skuRecord.stockStatus = 'danger';
          else if (stock.has_warning) skuRecord.stockStatus = 'warning';
          else skuRecord.stockStatus = 'normal';
        } else {
          skuRecord.totalAvailableQty = 0;
          skuRecord.stockStatus = 'normal';
        }

        const bom = key ? bomMap.get(key) : undefined;
        skuRecord.bomVersion = bom?.version || null;

        const inTransit = key ? inTransitMap.get(key) : undefined;
        skuRecord.inTransitQty = Number(inTransit?.in_transit_qty) || 0;

        const bomDemand = key ? bomDemandMap.get(key) : undefined;
        skuRecord.bomDemandQty = Number(bomDemand?.bom_demand_qty) || 0;

        const localBalance = localBalanceMap.get(sku.id);
        skuRecord.localStockQty = Number(localBalance?.qty) || 0;
      }
    }

    if (status) {
      const filtered = skus.filter(
        (s) => (s as unknown as Record<string, unknown>).stockStatus === status,
      );
      total = filtered.length;
      const offset = (page - 1) * pageSize;
      skus = filtered.slice(offset, offset + pageSize);
    }

    for (const sku of skus) {
      if (sku.product) {
        (
          sku.product as unknown as Record<string, unknown>
        ).inferredLifecycleStage = ProductsService.inferLifecycleStage(
          sku.product.launchDate,
          sku.product.lifecycleStage,
        );
      }
    }

    return { data: skus, total, page, pageSize };
  }

  async update(id: string, dto: Partial<CreateProductDto>) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.category !== undefined) product.category = dto.category;
    if (dto.launchDate !== undefined) {
      product.launchDate = dto.launchDate ? new Date(dto.launchDate) : null;
    }
    if (dto.lifecycleStage !== undefined) {
      product.lifecycleStage = dto.lifecycleStage
        ? (dto.lifecycleStage as ProductLifecycleStage)
        : null;
    }

    return this.productRepo.save(product);
  }

  async remove(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['skus'],
    });
    if (!product) throw new NotFoundException('Product not found');

    // 先删除关联的 SKU
    if (product.skus?.length) {
      await this.skuRepo.remove(product.skus);
    }

    await this.productRepo.remove(product);
  }

  async removeSku(skuId: string) {
    const sku = await this.skuRepo.findOne({ where: { id: skuId } });
    if (!sku) throw new NotFoundException('SKU not found');
    await this.skuRepo.remove(sku);
  }

  async setPrice(dto: SetPriceDto) {
    const existing = await this.priceRepo.findOne({
      where: { skuId: dto.skuId, customerLevel: dto.customerLevel },
    });
    if (existing) {
      existing.price = dto.price;
      existing.minQty = dto.minQty;
      return this.priceRepo.save(existing);
    }
    return this.priceRepo.save(this.priceRepo.create(dto));
  }

  async getPrice(skuId: string, customerLevel: string) {
    const policy = await this.priceRepo.findOne({
      where: { skuId, customerLevel },
    });
    return policy ?? null;
  }

  async getPrices(skuId: string) {
    const policies = await this.priceRepo.find({
      where: { skuId },
      order: { customerLevel: 'ASC' },
    });
    return policies;
  }

  async getSalesStats(skuId: string) {
    const sku = await this.skuRepo.findOne({ where: { id: skuId } });
    const skuCode = sku?.skuCode;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const qb = this.salesItemRepo.createQueryBuilder('item')
      .select('SUM(item.qty)', 'totalQty')
      .addSelect('SUM(item.lineAmount)', 'totalAmount')
      .addSelect('COUNT(DISTINCT item.orderId)', 'orderCount')
      .where('item.createdAt >= :from', { from: thirtyDaysAgo });

    if (skuCode) {
      qb.andWhere('(item.skuId = :skuId OR item.skuCode = :skuCode)', { skuId, skuCode });
    } else {
      qb.andWhere('item.skuId = :skuId', { skuId });
    }

    const summary = await qb.getRawOne();

    // 每日明细
    const dailyQb = this.salesItemRepo.createQueryBuilder('item')
      .select("DATE_TRUNC('day', item.createdAt)", 'date')
      .addSelect('SUM(item.qty)', 'qty')
      .addSelect('SUM(item.lineAmount)', 'amount')
      .where('item.createdAt >= :from', { from: thirtyDaysAgo });

    if (skuCode) {
      dailyQb.andWhere('(item.skuId = :skuId OR item.skuCode = :skuCode)', { skuId, skuCode });
    } else {
      dailyQb.andWhere('item.skuId = :skuId', { skuId });
    }

    dailyQb
      .groupBy("DATE_TRUNC('day', item.createdAt)")
      .orderBy("DATE_TRUNC('day', item.createdAt)", 'DESC');

    const daily = await dailyQb.getRawMany();

    return {
      summary: {
        totalQty: Number(summary?.totalQty ?? 0),
        totalAmount: Number(summary?.totalAmount ?? 0),
        orderCount: Number(summary?.orderCount ?? 0),
      },
      daily: daily.map((d) => ({
        date: d.date,
        qty: Number(d.qty ?? 0),
        amount: Number(d.amount ?? 0),
      })),
    };
  }

  async getRelatedOrders(skuId: string, limit: number = 10) {
    const sku = await this.skuRepo.findOne({ where: { id: skuId } });
    const skuCode = sku?.skuCode;

    const itemQb = this.salesItemRepo.createQueryBuilder('item')
      .select('item.orderId', 'orderId')
      .addSelect('MAX(item.createdAt)', 'maxCreatedAt')
      .groupBy('item.orderId')
      .orderBy('MAX(item.createdAt)', 'DESC')
      .limit(limit);

    if (skuCode) {
      itemQb.where('(item.skuId = :skuId OR item.skuCode = :skuCode)', { skuId, skuCode });
    } else {
      itemQb.where('item.skuId = :skuId', { skuId });
    }

    const itemResults = await itemQb.getRawMany();
    const orderIds = itemResults.map((r) => r.orderId).filter(Boolean);

    if (orderIds.length === 0) {
      return { data: [], total: 0 };
    }

    const orders = await this.salesOrderRepo.find({
      where: orderIds.map((id) => ({ id })),
      relations: ['customer', 'items'],
      order: { createdAt: 'DESC' },
    });

    // 过滤出只包含目标 SKU 的 items
    const filteredOrders = orders.map((order) => {
      const filteredItems = order.items.filter(
        (item) =>
          item.skuId === skuId || (skuCode && item.skuCode === skuCode),
      );
      return { ...order, items: filteredItems };
    });

    return { data: filteredOrders, total: filteredOrders.length };
  }

  async findSkuById(skuId: string, tenantId?: string) {
    return this.skuRepo.findOne({
      where: tenantId ? { id: skuId, product: { tenantId } } : { id: skuId },
      relations: ['product'],
    });
  }

  async findSkusByProductId(productId: string) {
    if (!productId) return [];
    return this.skuRepo.find({
      where: { productId },
      order: { createdAt: 'DESC' },
    });
  }

  async upsertFromJushuitan(skus: Record<string, unknown>[]) {
    let createdProducts = 0;
    let updatedProducts = 0;
    let createdSkus = 0;
    let updatedSkus = 0;
    let skippedCount = 0;
    let itemTypeNullCount = 0;
    let codeNonCompliantCount = 0;

    for (const s of skus) {
      const jstGoodsId = String(s.i_id || '');
      const jstSkuId = String(s.sku_id || '');
      const productName = String(s.name || '');
      const skuName = String(s.sku_name || s.properties_value || '');
      // 聚水潭 sku_id 是规格编号，sku_code 是附加条形码/编码字段
      // 当 sku_code 为空时回退到 sku_id（sku_id 本身可能是规范编码）
      const rawSkuCode =
        (s.sku_code as string | null | undefined) ||
        (s.sku_id as string | null | undefined);
      const propertiesValue = String(s.properties_value || '');
      const category = String(s.category || '');
      const brand = String(s.brand || '');
      const pic = String(s.pic || s.pic_big || '');
      const salePrice = s.sale_price != null ? Number(s.sale_price) : null;
      const costPrice = s.cost_price != null ? Number(s.cost_price) : null;
      // 聚水潭重量字段名为 w，weight 通常是空
      const weight =
        s.w != null ? Number(s.w) : s.weight != null ? Number(s.weight) : 0;
      const mappedItemType = mapItemType(s.item_type as string | null);

      if (!jstSkuId) continue;

      if (!rawSkuCode) {
        skippedCount++;
        continue;
      }
      const skuCode = String(rawSkuCode);
      const codeCompliant = SKU_CODE_REGEX.test(skuCode);

      if (mappedItemType === null) itemTypeNullCount++;
      if (!codeCompliant) codeNonCompliantCount++;

      let product = await this.productRepo.findOne({ where: { jstGoodsId } });
      if (!product) {
        product = await this.productRepo.save(
          this.productRepo.create({ name: productName, jstGoodsId, category, isDraft: false }),
        );
        createdProducts++;
      } else {
        product.name = productName;
        product.category = category;
        await this.productRepo.save(product);
        updatedProducts++;
      }

      const existingSku = await this.skuRepo.findOne({ where: { jstSkuId } });
      if (!existingSku) {
        const newSku = this.skuRepo.create({
          productId: product.id,
          skuCode,
          skuName,
          jstSkuId,
          propertiesValue,
          category,
          brand,
          pic,
          salePrice,
          costPrice,
          weight,
          itemType: mappedItemType,
          codeCompliant,
        });
        await this.skuRepo.save(newSku);
        createdSkus++;
      } else {
        // Layer A — 聚水潭主权字段，每次同步覆盖
        existingSku.skuCode = skuCode;
        existingSku.skuName = skuName;
        existingSku.propertiesValue = propertiesValue;
        existingSku.category = category;
        existingSku.brand = brand;
        existingSku.pic = pic;
        existingSku.salePrice = salePrice;
        existingSku.costPrice = costPrice;
        existingSku.weight = weight;

        // Layer B — 本地主权字段（localPic / materialCategoryId / materialCategoryName）同步不动

        // Layer C — 协同字段：NULL 时填，非 NULL 不动
        existingSku.itemType = existingSku.itemType ?? mappedItemType;

        // Layer D — 计算字段：每次同步重算
        existingSku.codeCompliant = codeCompliant;

        await this.skuRepo.save(existingSku);
        updatedSkus++;
      }
    }

    return {
      createdProducts,
      updatedProducts,
      createdSkus,
      updatedSkus,
      skippedCount,
      itemTypeNullCount,
      codeNonCompliantCount,
    };
  }

  async updateSku(skuId: string, dto: { floorPrice?: number }) {
    const sku = await this.skuRepo.findOne({ where: { id: skuId } });
    if (!sku) throw new NotFoundException('SKU not found');

    if (dto.floorPrice !== undefined) {
      sku.floorPrice =
        dto.floorPrice != null ? Number(dto.floorPrice) : null;
    }

    return this.skuRepo.save(sku);
  }

  async addSkuImages(
    skuId: string,
    files: { buffer: Buffer; originalname: string; mimetype: string }[],
  ): Promise<string[]> {
    const sku = await this.skuRepo.findOne({ where: { id: skuId } });
    if (!sku) throw new NotFoundException('SKU not found');

    const uploadDir = join(process.cwd(), 'uploads');
    const uploadedUrls: string[] = [];

    for (const file of files) {
      // 验证图片类型
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException(`文件 ${file.originalname} 不是图片格式`);
      }
      // 生成唯一文件名
      const ext = file.originalname.split('.').pop() || 'jpg';
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
      const filepath = join(uploadDir, filename);

      writeFileSync(filepath, file.buffer);
      uploadedUrls.push(`/uploads/${filename}`);
    }

    // 合并到 pics 数组
    const existingPics = sku.pics || [];
    sku.pics = [...existingPics, ...uploadedUrls];
    await this.skuRepo.save(sku);

    return sku.pics;
  }

  async removeSkuImage(skuId: string, index: number) {
    const sku = await this.skuRepo.findOne({ where: { id: skuId } });
    if (!sku) throw new NotFoundException('SKU not found');

    const pics = sku.pics || [];
    if (index < 0 || index >= pics.length) {
      throw new BadRequestException('图片索引无效');
    }

    const url = pics[index];
    // 删除物理文件
    if (url && url.startsWith('/uploads/')) {
      const filename = url.replace('/uploads/', '');
      const filepath = join(process.cwd(), 'uploads', filename);
      if (existsSync(filepath)) {
        unlinkSync(filepath);
      }
    }

    // 从数组中移除
    sku.pics = pics.filter((_, i) => i !== index);
    await this.skuRepo.save(sku);
  }

  async batchUpdateSkuCategory(skuIds: string[], materialCategoryId: string) {
    const category = await this.skuRepo.manager.findOne(MaterialCategory, {
      where: { id: materialCategoryId },
    });
    if (!category) throw new NotFoundException('物料分类不存在');

    await this.skuRepo
      .createQueryBuilder()
      .update(ProductSku)
      .set({
        materialCategoryId,
        materialCategoryName: category.name,
      })
      .where('id IN (:...skuIds)', { skuIds })
      .execute();
  }

  async importFromExcel(
    buffer: Buffer | ArrayBuffer,
    userId?: string,
  ): Promise<{ success: number; failed: number; errors: { row: number; message: string }[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('Excel 文件为空或格式不正确');
    }

    // 列名映射（支持中英文）
    const COLUMN_MAP: Record<string, string> = {
      '产品名称': 'name',
      'name': 'name',
      '分类': 'category',
      'category': 'category',
      '物料类型': 'itemType',
      'itemType': 'itemType',
      '类型': 'itemType',
      'SKU名称': 'skuName',
      'skuName': 'skuName',
      '规格': 'spec',
      'spec': 'spec',
      '销售价': 'salePrice',
      'salePrice': 'salePrice',
      '成本价': 'costPrice',
      'costPrice': 'costPrice',
      '重量': 'weight',
      'weight': 'weight',
      '重量(kg)': 'weight',
      '品牌': 'brand',
      'brand': 'brand',
      '图片链接': 'pic',
      'pic': 'pic',
      '图片': 'pic',
    };

    const validItemTypes = ['finished_good', 'semi_finished', 'raw_material', 'packaging'];

    const headers: string[] = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      const val = String(cell.value || '').trim();
      headers.push(val);
    });

    const fieldMap = new Map<number, string>();
    headers.forEach((h, idx) => {
      const field = COLUMN_MAP[h];
      if (field) fieldMap.set(idx + 1, field); // Excel cell col is 1-based
    });

    if (!fieldMap.has(1) || fieldMap.get(1) !== 'name') {
      // 尝试查找 name 列的位置
      let nameCol = -1;
      headers.forEach((h, idx) => {
        if (COLUMN_MAP[h] === 'name') nameCol = idx + 1;
      });
      if (nameCol === -1) {
        throw new BadRequestException('Excel 缺少「产品名称」列，请使用正确的导入模板');
      }
    }

    const rows: Record<string, unknown>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const record: Record<string, unknown> = {};
      fieldMap.forEach((field, colNumber) => {
        const cell = row.getCell(colNumber);
        let val: unknown = cell.value;
        // 处理 Excel 数字类型
        if (typeof val === 'number') {
          if (field === 'salePrice' || field === 'costPrice' || field === 'weight') {
            record[field] = val;
            return;
          }
        }
        record[field] = val != null ? String(val).trim() : undefined;
      });
      rows.push(record);
    });

    const errors: { row: number; message: string }[] = [];
    let success = 0;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const productRepo = queryRunner.manager.getRepository(Product);
      const skuRepo = queryRunner.manager.getRepository(ProductSku);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // Excel row number (1-based, +1 header)

        const name = String(row.name || '').trim();
        if (!name) {
          errors.push({ row: rowNum, message: '产品名称不能为空' });
          continue;
        }

        let itemType = String(row.itemType || '').trim().toLowerCase();
        if (!itemType) itemType = 'finished_good';
        if (!validItemTypes.includes(itemType)) {
          errors.push({ row: rowNum, message: `物料类型「${row.itemType}」无效，可选: finished_good, semi_finished, raw_material, packaging` });
          continue;
        }

        const category = String(row.category || '').trim() || undefined;
        const categoryCode = normalizeCategoryCode(category);
        const prefix = getPrefixByItemType(itemType);

        // 生成 SPU 编码（在事务内查询）
        const spuResult = await queryRunner.query(
          `SELECT MAX(SUBSTRING(spu_code FROM '[0-9]{4}$')) as max_num
           FROM products WHERE spu_code LIKE $1`,
          [`${prefix}-${categoryCode}-%`],
        );
        const maxSpuNum = parseInt(spuResult[0]?.max_num || '0', 10);
        const spuCode = `${prefix}-${categoryCode}-${String(maxSpuNum + 1).padStart(4, '0')}`;

        const product = productRepo.create({
          name,
          category,
          spuCode,
          itemType: itemType as any,
          isDraft: false,
        });
        const savedProduct = await productRepo.save(product);

        // 生成 SKU 编码
        const skuResult = await queryRunner.query(
          `SELECT MAX(SUBSTRING("skuCode" FROM '[0-9]{3}$')) as max_num
           FROM product_skus WHERE "skuCode" LIKE $1`,
          [`${spuCode}-%`],
        );
        const maxSkuNum = parseInt(skuResult[0]?.max_num || '0', 10);
        const skuCode = `${spuCode}-${String(maxSkuNum + 1).padStart(3, '0')}`;

        const skuName = String(row.skuName || '').trim() || name;
        const spec = String(row.spec || '').trim() || undefined;
        const salePrice = row.salePrice != null ? Number(row.salePrice) : null;
        const costPrice = row.costPrice != null ? Number(row.costPrice) : null;
        const weight = row.weight != null ? Number(row.weight) : 0;
        const brand = String(row.brand || '').trim() || undefined;
        const pic = String(row.pic || '').trim() || undefined;

        const sku = skuRepo.create({
          skuCode,
          skuName,
          spec,
          productId: savedProduct.id,
          category,
          salePrice,
          costPrice,
          weight,
          brand,
          pic,
          itemType: itemType as any,
          codeCompliant: true,
          syncStatus: 'pending',
        });
        await skuRepo.save(sku);

        success++;
      }

      await queryRunner.commitTransaction();
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(`导入失败: ${err.message}`);
    } finally {
      await queryRunner.release();
    }

    return { success, failed: errors.length, errors };
  }
}
