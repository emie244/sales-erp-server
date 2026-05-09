import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { StockSnapshot } from './entities/stock-snapshot.entity';

export interface StockListItem {
  skuId: string;
  warehouseId: string;
  availableQty: number;
  safetyStock: number;
  syncedAt: Date;
  skuName?: string;
  productName?: string;
  skuCode?: string;
  pic?: string;
  status: 'normal' | 'warning' | 'danger';
}

@Injectable()
export class StocksService {
  constructor(
    @InjectRepository(StockSnapshot)
    private readonly repo: Repository<StockSnapshot>,
    private readonly dataSource: DataSource,
  ) {}

  async upsertMany(snapshots: Partial<StockSnapshot>[]) {
    for (const s of snapshots) {
      const existing = await this.repo.findOne({
        where: { skuId: s.skuId, warehouseId: s.warehouseId },
      });
      if (existing) {
        existing.availableQty = s.availableQty ?? existing.availableQty;
        existing.syncedAt = new Date();
        await this.repo.save(existing);
      } else {
        await this.repo.save(this.repo.create({ ...s, syncedAt: new Date() }));
      }
    }
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    warehouseId?: string;
    status?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const query = this.dataSource
      .createQueryBuilder()
      .select([
        'ss.skuId as sku_id',
        'ss.warehouseId as warehouse_id',
        'ss.availableQty as available_qty',
        'ss.safetyStock as safety_stock',
        'ss.syncedAt as synced_at',
        'ps.skuName as sku_name',
        'ps.skuCode as sku_code',
        'ps.pic as pic',
        'p.name as product_name',
      ])
      .from('stock_snapshots', 'ss')
      .leftJoin('product_skus', 'ps', 'ss.sku_id = ps."skuCode"')
      .leftJoin('products', 'p', 'ps.product_id = p.id')
      .orderBy('ss.synced_at', 'DESC')
      .addOrderBy('ss.sku_id', 'ASC');

    if (params.keyword) {
      query.andWhere(
        `(p.name ILIKE :keyword OR ps.sku_name ILIKE :keyword OR ps.sku_code ILIKE :keyword OR ss.sku_id ILIKE :keyword)`,
        { keyword: `%${params.keyword}%` },
      );
    }

    if (params.warehouseId) {
      query.andWhere('ss.warehouse_id = :warehouseId', {
        warehouseId: params.warehouseId,
      });
    }

    const raw = await query.getRawMany();

    const items: StockListItem[] = raw.map((r: Record<string, unknown>) => {
      const availableQty = Number(r.available_qty || 0);
      const safetyStock = Number(r.safety_stock || 0);
      let status: 'normal' | 'warning' | 'danger' = 'normal';
      if (safetyStock > 0 && availableQty <= 0) {
        status = 'danger';
      } else if (safetyStock > 0 && availableQty < safetyStock) {
        status = 'warning';
      }

      return {
        skuId: String(r.sku_id),
        warehouseId: String(r.warehouse_id),
        availableQty,
        safetyStock,
        syncedAt: r.synced_at as Date,
        skuName: r.sku_name ? String(r.sku_name) : undefined,
        productName: r.product_name ? String(r.product_name) : undefined,
        skuCode: r.sku_code ? String(r.sku_code) : undefined,
        pic: r.pic ? String(r.pic) : undefined,
        status,
      };
    });

    let filteredItems = items;
    if (params.status) {
      filteredItems = items.filter((i) => i.status === params.status);
    }

    const total = filteredItems.length;
    const offset = (page - 1) * pageSize;
    const pagedItems = filteredItems.slice(offset, offset + pageSize);

    return {
      data: pagedItems,
      total,
      page,
      pageSize,
    };
  }

  async updateSafetyStock(
    skuId: string,
    warehouseId: string,
    safetyStock: number,
  ) {
    const snapshot = await this.repo.findOne({
      where: { skuId, warehouseId },
    });
    if (!snapshot) {
      throw new NotFoundException('库存记录不存在');
    }
    snapshot.safetyStock = safetyStock;
    return this.repo.save(snapshot);
  }

  async findWarehouses() {
    const result = await this.repo
      .createQueryBuilder('ss')
      .select('DISTINCT ss.warehouseId', 'warehouseId')
      .getRawMany();
    return result.map((r: { warehouseId: string }) => r.warehouseId);
  }

  findBySku(skuId: string) {
    return this.repo.find({ where: { skuId } });
  }
}
