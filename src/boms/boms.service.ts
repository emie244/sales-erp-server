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
      .leftJoin('products', 'p', 'bh.product_id = p.jst_goods_id')
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
        'items.remark',
        'ps.skuName',
        'ps.skuCode',
        'p.name',
      ])
      .orderBy('bh.createdAt', 'DESC');

    if (params.keyword) {
      qb.andWhere(
        `(p.name ILIKE :keyword OR ps.sku_name ILIKE :keyword OR ps.sku_code ILIKE :keyword)`,
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
    return { data, total, page, pageSize };
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
    return this.headerRepo.findOne({
      where: { skuId, isActive: true },
      relations: ['items'],
    });
  }

  async findBySku(skuId: string) {
    return this.headerRepo.find({
      where: { skuId },
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
}
