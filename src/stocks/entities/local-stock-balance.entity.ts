import { Entity, Column, VersionColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('local_stock_balances')
@Index(['skuId'], { unique: true })
export class LocalStockBalance extends BaseEntity {
  @Column({ name: 'sku_id', unique: true })
  skuId: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  qty: number;

  @VersionColumn({ default: 0 })
  version: number;

  @Column({ name: 'last_updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastUpdatedAt: Date;
}
