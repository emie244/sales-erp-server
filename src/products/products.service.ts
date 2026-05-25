import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Product, type ProductLifecycleStage } from './entities/product.entity';
import { ProductSku } from './entities/product-sku.entity';
import { PricePolicy } from './entities/price-policy.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { SKU_CODE_REGEX, mapItemType } from './sku-code.constants';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(ProductSku) private skuRepo: Repository<ProductSku>,
    @InjectRepository(PricePolicy) private priceRepo: Repository<PricePolicy>,
    private readonly dataSource: DataSource,
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

  async create(dto: CreateProductDto, tenantId?: string) {
    if (!dto.skus?.length) {
      throw new BadRequestException(
        '必须至少提供一个 SKU；本地不再自动生成 SKU 编码，请走「编码生成器」获取建议后到聚水潭新建并同步回来',
      );
    }

    for (const s of dto.skus) {
      const code = s.skuCode?.trim();
      if (!code) {
        throw new BadRequestException(
          'SKU 编码必填；本地不再自动生成，请按 [L1]-[L2]-[L3?]-[流水] 格式手填或从「编码生成器」复制',
        );
      }
    }

    const explicitStage = dto.lifecycleStage
      ? (dto.lifecycleStage as ProductLifecycleStage)
      : null;
    const product = this.productRepo.create({
      name: dto.name,
      description: dto.description,
      category: dto.category,
      launchDate: dto.launchDate ? new Date(dto.launchDate) : null,
      lifecycleStage: explicitStage,
      tenantId,
    });
    const saved = await this.productRepo.save(product);

    const skus = dto.skus.map((s) => {
      const skuCode = s.skuCode!.trim();
      const skuName = s.skuName?.trim()
        ? s.skuName.trim()
        : `${saved.name}${s.spec ? ' / ' + s.spec : ''}`;
      return this.skuRepo.create({
        ...s,
        skuCode,
        skuName,
        productId: saved.id,
        category: saved.category,
        codeCompliant: SKU_CODE_REGEX.test(skuCode),
      });
    });
    await this.skuRepo.save(skus);
    return this.findOne(saved.id);
  }

  async findOne(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['skus'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findAll(page: number = 1, pageSize: number = 20, tenantId?: string) {
    const [data, total] = await this.productRepo.findAndCount({
      where: tenantId ? { tenantId } : {},
      relations: ['skus'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, pageSize };
  }

  async findAllSkus(
    page: number = 1,
    pageSize: number = 50,
    tenantId?: string,
    keyword?: string,
    status?: string,
    governance?: 'uncategorized' | 'item_type_null' | 'non_compliant',
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
    if (skuKeys.length) {
      const stockSummary = await this.dataSource.query(
        `
        SELECT sku_id, SUM("availableQty") as total,
          bool_or(safety_stock > 0 AND "availableQty" <= 0) as has_danger,
          bool_or(safety_stock > 0 AND "availableQty" < safety_stock AND "availableQty" > 0) as has_warning
        FROM stock_snapshots
        WHERE sku_id = ANY($1)
        GROUP BY sku_id
        `,
        [skuKeys],
      );

      const bomSummary = await this.dataSource.query(
        `
        SELECT sku_id, version
        FROM bom_headers
        WHERE sku_id = ANY($1) AND "isActive" = true
        `,
        [skuKeys],
      );

      // 在途数量：已审批或部分到货的采购单中未完全到货的数量
      const inTransitSummary = await this.dataSource.query(
        `
        SELECT poi.sku_id, SUM(poi.qty - poi.received_qty) as in_transit_qty
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.purchase_order_id
        WHERE poi.sku_id = ANY($1)
          AND po.status IN ('approved', 'partial_received')
          AND poi.qty > poi.received_qty
        GROUP BY poi.sku_id
        `,
        [skuKeys],
      );

      // BOM 采购需求：未完成加工单中所需原材料的未满足数量
      const bomDemandSummary = await this.dataSource.query(
        `
        SELECT proi.material_sku_id as sku_id, SUM(proi.required_qty - proi.actual_qty) as bom_demand_qty
        FROM production_order_items proi
        JOIN production_orders pro ON pro.id = proi.production_order_id
        WHERE proi.material_sku_id = ANY($1)
          AND pro.status IN ('pending', 'processing')
          AND proi.required_qty > proi.actual_qty
        GROUP BY proi.material_sku_id
        `,
        [skuKeys],
      );

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
      const rawSkuCode = s.sku_code as string | null | undefined;
      const propertiesValue = String(s.properties_value || '');
      const category = String(s.category || '');
      const brand = String(s.brand || '');
      const pic = String(s.pic || s.pic_big || '');
      const salePrice = s.sale_price != null ? Number(s.sale_price) : null;
      const costPrice = s.cost_price != null ? Number(s.cost_price) : null;
      const weight = s.weight != null ? Number(s.weight) : 0;
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
          this.productRepo.create({ name: productName, jstGoodsId, category }),
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
}
