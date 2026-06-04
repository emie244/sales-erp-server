import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BomHeader } from './entities/bom-header.entity';
import { BomItem } from './entities/bom-item.entity';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';

@Injectable()
export class BomsService {
  constructor(
    @InjectRepository(BomHeader)
    private readonly headerRepo: Repository<BomHeader>,
    @InjectRepository(BomItem)
    private readonly itemRepo: Repository<BomItem>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateBomDto) {
    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(BomHeader);
      const itemRepo = manager.getRepository(BomItem);

      const header = headerRepo.create({
        productId: dto.productId,
        skuId: dto.skuId,
        version: dto.version || 'v1',
        remark: dto.remark,
        isActive: dto.isActive ?? true,
      });
      await headerRepo.save(header);

      if (dto.items?.length) {
        const items = dto.items.map((item, idx) =>
          itemRepo.create({
            bomHeaderId: header.id,
            materialSkuId: item.materialSkuId,
            qty: item.qty,
            lossRate: item.lossRate || 0,
            sortOrder: item.sortOrder ?? idx,
            materialCategoryId: item.materialCategoryId || null,
            materialCategoryName: item.materialCategoryName || null,
            remark: item.remark,
          }),
        );
        await itemRepo.save(items);
      }

      const result = await headerRepo.findOne({
        where: { id: header.id },
        relations: ['items'],
      });
      if (!result) throw new NotFoundException('BOM 不存在');
      return result;
    });
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    productId?: string;
    skuId?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const qb = this.headerRepo
      .createQueryBuilder('bh')
      .leftJoinAndSelect('bh.items', 'items')
      .leftJoin('product_skus', 'ps', 'bh.sku_id = ps.jst_sku_id')
      .leftJoin('products', 'p', 'bh.product_id = p.jst_goods_id OR bh.product_id = p.id::text')
      .select([
        'bh.id',
        'bh.productId',
        'bh.skuId',
        'bh.version',
        'bh.isActive',
        'bh.remark',
        'bh.createdAt',
        'bh.updatedAt',
        'items.id',
        'items.bomHeaderId',
        'items.materialSkuId',
        'items.qty',
        'items.lossRate',
        'items.sortOrder',
        'items.materialCategoryId',
        'items.materialCategoryName',
        'items.remark',
        'ps.skuName',
        'ps.skuCode',
        'p.name',
      ])
      .orderBy('bh.createdAt', 'DESC');

    if (params.keyword) {
      qb.andWhere(
        `(p.name ILIKE :keyword OR ps.skuName ILIKE :keyword OR ps.skuCode ILIKE :keyword)`,
        { keyword: `%${params.keyword}%` },
      );
    }

    if (params.productId) {
      qb.andWhere('bh.productId = :productId', { productId: params.productId });
    }

    if (params.skuId) {
      qb.andWhere('bh.skuId = :skuId', { skuId: params.skuId });
    }

    const [data, total] = await qb.getManyAndCount();

    // 补充 skuName / skuCode / productName
    const skuIds = [...new Set(data.map((d) => d.skuId).filter(Boolean))];
    const productIds = [
      ...new Set(data.map((d) => d.productId).filter(Boolean)),
    ];

    const skuMap = new Map<string, { skuName: string; skuCode: string }>();
    const productMap = new Map<string, string>();

    if (skuIds.length) {
      const skuRows = await this.dataSource.query(
        `SELECT jst_sku_id, "skuName", "skuCode" FROM product_skus WHERE jst_sku_id = ANY($1)`,
        [skuIds],
      );
      for (const s of skuRows) {
        skuMap.set(s.jst_sku_id, { skuName: s.skuName, skuCode: s.skuCode });
      }
    }

    if (productIds.length) {
      const productRows = await this.dataSource.query(
        `SELECT jst_goods_id, name FROM products WHERE jst_goods_id = ANY($1)`,
        [productIds],
      );
      for (const p of productRows) {
        productMap.set(p.jst_goods_id, p.name);
      }
    }

    const enriched = data.map((bom) => ({
      ...bom,
      skuName: skuMap.get(bom.skuId)?.skuName || null,
      skuCode: skuMap.get(bom.skuId)?.skuCode || null,
      productName: productMap.get(bom.productId) || null,
    }));

    return { data: enriched, total, page, pageSize };
  }

  async findOne(id: string) {
    const bom = await this.headerRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!bom) throw new NotFoundException('BOM 不存在');
    return bom;
  }

  async findActiveBySku(skuId: string) {
    const direct = await this.headerRepo.findOne({
      where: { skuId, isActive: true },
      relations: ['items'],
    });
    if (direct) return direct;

    const skuRows = await this.dataSource.query(
      `SELECT jst_sku_id, "skuCode" FROM product_skus WHERE id::text = $1 OR "skuCode" = $1 OR jst_sku_id = $1 LIMIT 1`,
      [skuId],
    );

    const mappedSkuId = skuRows[0]?.jst_sku_id || skuRows[0]?.skuCode;
    if (!mappedSkuId || mappedSkuId === skuId) return null;

    return this.headerRepo.findOne({
      where: { skuId: mappedSkuId, isActive: true },
      relations: ['items'],
    });
  }

  async findBySku(skuId: string) {
    // 先尝试直接用 skuId 查询
    const direct = await this.headerRepo.find({
      where: { skuId },
      relations: ['items'],
      order: { isActive: 'DESC', createdAt: 'DESC' },
    });
    if (direct.length) return direct;

    // 如果没有结果，尝试通过 product_skus 查找 jst_sku_id
    const skuRows = await this.dataSource.query(
      `SELECT jst_sku_id, "skuCode" FROM product_skus WHERE id::text = $1 OR "skuCode" = $1 OR jst_sku_id = $1 LIMIT 1`,
      [skuId],
    );

    const mappedSkuId = skuRows[0]?.jst_sku_id || skuRows[0]?.skuCode;
    if (!mappedSkuId || mappedSkuId === skuId) return [];

    return this.headerRepo.find({
      where: { skuId: mappedSkuId },
      relations: ['items'],
      order: { isActive: 'DESC', createdAt: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateBomDto) {
    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(BomHeader);
      const itemRepo = manager.getRepository(BomItem);

      const header = await headerRepo.findOne({
        where: { id },
        relations: ['items'],
      });
      if (!header) throw new NotFoundException('BOM 不存在');

      if (dto.version !== undefined) header.version = dto.version;
      if (dto.remark !== undefined) header.remark = dto.remark;
      await headerRepo.save(header);

      if (dto.items) {
        // 删除旧明细
        if (header.items?.length) {
          await itemRepo.remove(header.items);
        }

        const items = dto.items.map((item, idx) =>
          itemRepo.create({
            bomHeaderId: header.id,
            materialSkuId: item.materialSkuId,
            qty: item.qty,
            lossRate: item.lossRate || 0,
            sortOrder: item.sortOrder ?? idx,
            materialCategoryId: item.materialCategoryId || null,
            materialCategoryName: item.materialCategoryName || null,
            remark: item.remark,
          }),
        );
        await itemRepo.save(items);
      }

      const result = await headerRepo.findOne({
        where: { id },
        relations: ['items'],
      });
      if (!result) throw new NotFoundException('BOM 不存在');
      return result;
    });
  }

  async delete(id: string) {
    const header = await this.headerRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!header) throw new NotFoundException('BOM 不存在');
    await this.headerRepo.remove(header);
    return { id };
  }

  async clone(bomId: string, newVersion?: string) {
    const original = await this.headerRepo.findOne({
      where: { id: bomId },
      relations: ['items'],
    });
    if (!original) throw new NotFoundException('BOM 不存在');

    // 计算新版本号
    let version = newVersion;
    if (!version) {
      const match = original.version?.match(/v(\d+)/);
      const num = match ? parseInt(match[1], 10) + 1 : 2;
      version = `v${num}`;
    }

    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(BomHeader);
      const itemRepo = manager.getRepository(BomItem);

      const header = headerRepo.create({
        productId: original.productId,
        skuId: original.skuId,
        version,
        remark: `${original.remark || ''} (复制自 ${original.version})`.trim(),
        isActive: false,
      });
      await headerRepo.save(header);

      if (original.items?.length) {
        const items = original.items.map((item, idx) =>
          itemRepo.create({
            bomHeaderId: header.id,
            materialSkuId: item.materialSkuId,
            qty: item.qty,
            lossRate: item.lossRate,
            sortOrder: item.sortOrder ?? idx,
            materialCategoryId: item.materialCategoryId,
            materialCategoryName: item.materialCategoryName,
            remark: item.remark,
          }),
        );
        await itemRepo.save(items);
      }

      return headerRepo.findOne({
        where: { id: header.id },
        relations: ['items'],
      });
    });
  }

  async toggleActive(id: string) {
    const header = await this.headerRepo.findOne({ where: { id } });
    if (!header) throw new NotFoundException('BOM 不存在');
    header.isActive = !header.isActive;
    return this.headerRepo.save(header);
  }

  /**
   * 从聚水潭同步 BOM 数据
   */
  async upsertFromJushuitan(bomList: Record<string, unknown>[]) {
    let created = 0;
    let updated = 0;

    for (const bomData of bomList) {
      const skuId = String(bomData.sku_id || '');
      const iId = String(bomData.i_id || '');
      if (!skuId) continue;

      // 查找该 SKU 是否已有 v1 版本 BOM
      const existing = await this.headerRepo.findOne({
        where: { skuId, version: 'v1' },
        relations: ['items'],
      });

      if (existing) {
        // 更新现有 BOM
        existing.productId = iId;
        existing.remark = `同步自聚水潭，修改人: ${bomData.modifier_name || '-'}`;
        existing.isActive = true;
        await this.headerRepo.save(existing);

        // 删除旧明细
        if (existing.items?.length) {
          await this.itemRepo.remove(existing.items);
        }

        // 处理主料 (boms)
        const items: BomItem[] = [];
        const boms = (bomData.boms as Record<string, unknown>[]) || [];
        boms.forEach((b, idx) => {
          items.push(
            this.itemRepo.create({
              bomHeaderId: existing.id,
              materialSkuId: String(
                (b.map_outer_sku_id ?? b.sku_id ?? '') as string,
              ),
              qty: Number((b.rm_qty ?? 1) as number),
              lossRate: 0,
              sortOrder: idx,
              remark: String((b.map_name ?? b.name ?? '') as string),
            }),
          );
        });

        // 处理辅料 (bom_minors)
        const minors = (bomData.bom_minors as Record<string, unknown>[]) || [];
        minors.forEach((m, idx) => {
          items.push(
            this.itemRepo.create({
              bomHeaderId: existing.id,
              materialSkuId: String(
                (m.outer_sku_id ?? m.sku_id ?? '') as string,
              ),
              qty: Number((m.qty ?? 1) as number),
              lossRate: 0,
              sortOrder: boms.length + idx,
              remark: `(辅料) ${String((m.name ?? '') as string)}`,
            }),
          );
        });

        if (items.length) {
          await this.itemRepo.save(items);
        }

        updated++;
      } else {
        // 创建新 BOM
        const header = this.headerRepo.create({
          productId: iId,
          skuId,
          version: 'v1',
          remark: `同步自聚水潭，修改人: ${bomData.modifier_name || '-'}`,
          isActive: true,
        });
        await this.headerRepo.save(header);

        // 处理主料 (boms)
        const items: BomItem[] = [];
        const boms = (bomData.boms as Record<string, unknown>[]) || [];
        boms.forEach((b, idx) => {
          items.push(
            this.itemRepo.create({
              bomHeaderId: header.id,
              materialSkuId: String(
                (b.map_outer_sku_id ?? b.sku_id ?? '') as string,
              ),
              qty: Number((b.rm_qty ?? 1) as number),
              lossRate: 0,
              sortOrder: idx,
              remark: String((b.map_name ?? b.name ?? '') as string),
            }),
          );
        });

        // 处理辅料 (bom_minors)
        const minors = (bomData.bom_minors as Record<string, unknown>[]) || [];
        minors.forEach((m, idx) => {
          items.push(
            this.itemRepo.create({
              bomHeaderId: header.id,
              materialSkuId: String(
                (m.outer_sku_id ?? m.sku_id ?? '') as string,
              ),
              qty: Number((m.qty ?? 1) as number),
              lossRate: 0,
              sortOrder: boms.length + idx,
              remark: `(辅料) ${String((m.name ?? '') as string)}`,
            }),
          );
        });

        if (items.length) {
          await this.itemRepo.save(items);
        }

        created++;
      }
    }

    return { created, updated };
  }

  /**
   * 根据销售订单计算物料需求
   */
  async calculateMaterialRequirements(
    orderItems: { skuId: string; qty: number }[],
  ) {
    const requirements: Record<
      string,
      {
        materialSkuId: string;
        totalQty: number;
        details: {
          skuId: string;
          orderQty: number;
          bomQty: number;
          lossRate: number;
          neededQty: number;
        }[];
      }
    > = {};

    for (const orderItem of orderItems) {
      const bom = await this.findActiveBySku(orderItem.skuId);
      if (!bom || !bom.items?.length) continue;

      for (const item of bom.items) {
        const key = item.materialSkuId;
        const neededQty =
          item.qty * orderItem.qty * (1 + (item.lossRate || 0) / 100);

        if (!requirements[key]) {
          requirements[key] = {
            materialSkuId: item.materialSkuId,
            totalQty: 0,
            details: [],
          };
        }

        requirements[key].totalQty += neededQty;
        requirements[key].details.push({
          skuId: orderItem.skuId,
          orderQty: orderItem.qty,
          bomQty: item.qty,
          lossRate: item.lossRate,
          neededQty,
        });
      }
    }

    return Object.values(requirements).map((r) => ({
      ...r,
      totalQty: Number(r.totalQty.toFixed(4)),
    }));
  }

  /**
   * 查询所有已使用的 BOM 子物料编码（去重）
   */
  async findMaterialSkuIds() {
    const rows = await this.itemRepo
      .createQueryBuilder('bi')
      .select('bi.materialSkuId', 'materialSkuId')
      .addSelect('MAX(bi.remark)', 'remark')
      .where('bi.materialSkuId IS NOT NULL')
      .groupBy('bi.materialSkuId')
      .getRawMany();
    return rows.map((r) => ({
      id: r.materialSkuId,
      name: r.remark || '',
    }));
  }

  /**
   * 查询可加工的产品列表
   * 只返回有 active BOM 且所有原材料都有 received_qty > 0 采购记录的产品
   */
  async findProducibleProducts() {
    const rows = await this.dataSource.query(
      `
      SELECT DISTINCT p.id, p.name, p.jst_goods_id as "jstGoodsId"
      FROM products p
      JOIN bom_headers bh ON (bh.product_id = p.id::text OR bh.product_id = p.jst_goods_id) AND bh."isActive" = true
      WHERE NOT EXISTS (
        SELECT 1 FROM bom_items bi
        WHERE bi.bom_header_id = bh.id
        AND NOT EXISTS (
          SELECT 1 FROM purchase_order_items poi
          WHERE poi.sku_id = bi.material_sku_id AND poi.received_qty > 0
        )
      )
      ORDER BY p.name
      `,
    );
    return rows as { id: string; name: string; jstGoodsId: string }[];
  }

  /**
   * 根据采购单到货数量计算 BOM 的最大可加工数量
   */
  async calculateMaxProducibleQtyByPurchases(bomId: string) {
    const rows = await this.dataSource.query(
      `
      SELECT
        bi.material_sku_id as "materialSkuId",
        bi.qty,
        bi.loss_rate as "lossRate",
        COALESCE(SUM(poi.received_qty), 0) as "totalReceived"
      FROM bom_items bi
      LEFT JOIN purchase_order_items poi ON poi.sku_id = bi.material_sku_id AND poi.received_qty > 0
      WHERE bi.bom_header_id = $1
      GROUP BY bi.material_sku_id, bi.qty, bi.loss_rate
      `,
      [bomId],
    );

    if (!rows.length) return { maxQty: 0, materials: [] };

    const materials = (
      rows as {
        materialSkuId: string;
        qty: string;
        lossRate: string;
        totalReceived: string;
      }[]
    ).map((r) => {
      const qty = Number(r.qty);
      const lossRate = Number(r.lossRate) || 0;
      const totalReceived = Number(r.totalReceived) || 0;
      const perUnitNeed = qty * (1 + lossRate / 100);
      const maxQty =
        perUnitNeed > 0 ? Math.floor(totalReceived / perUnitNeed) : 0;
      return {
        materialSkuId: r.materialSkuId,
        qty,
        lossRate,
        totalReceived,
        perUnitNeed,
        maxQty,
      };
    });

    const maxQty =
      materials.length > 0 ? Math.min(...materials.map((m) => m.maxQty)) : 0;
    return { maxQty, materials };
  }

  /**
   * 查询某个 SKU 的所有 BOM，并附带原材料库存信息和最大可加工数量
   * 只返回原材料库存充足的 BOM（maxProduceQty > 0）
   */
  async findBomsWithStockStatus(skuId: string) {
    const boms = await this.findBySku(skuId);
    if (!boms.length) return [];

    const materialSkuIds = [
      ...new Set(
        boms.flatMap((b) => b.items?.map((i) => i.materialSkuId) || []),
      ),
    ];

    const stockRows = materialSkuIds.length
      ? await this.dataSource.query(
          `SELECT sku_id, SUM("availableQty") as total FROM stock_snapshots WHERE sku_id = ANY($1) GROUP BY sku_id`,
          [materialSkuIds],
        )
      : [];

    const stockMap = new Map<string, number>();
    (stockRows as { sku_id: string; total: string }[]).forEach((r) => {
      stockMap.set(r.sku_id, Number(r.total) || 0);
    });

    return boms
      .map((bom) => {
        const items = (bom.items || []).map((item) => {
          const stock = stockMap.get(item.materialSkuId) || 0;
          return {
            ...item,
            stockQty: stock,
            maxQty: item.qty > 0 ? Math.floor(stock / item.qty) : 0,
          };
        });

        const maxProduceQty =
          items.length > 0 ? Math.min(...items.map((i: any) => i.maxQty)) : 0;

        return {
          ...bom,
          items,
          maxProduceQty,
          hasStock: maxProduceQty > 0,
        };
      })
      .filter((b) => b.hasStock);
  }
}
