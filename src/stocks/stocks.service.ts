import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockSnapshot } from './entities/stock-snapshot.entity';

@Injectable()
export class StocksService {
  constructor(
    @InjectRepository(StockSnapshot)
    private readonly repo: Repository<StockSnapshot>,
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

  findBySku(skuId: string) {
    return this.repo.find({ where: { skuId } });
  }
}
