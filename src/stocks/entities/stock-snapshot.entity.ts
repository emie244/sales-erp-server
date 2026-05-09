import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('stock_snapshots')
export class StockSnapshot {
  @PrimaryColumn({ name: 'sku_id' })
  skuId: string;

  @PrimaryColumn({ name: 'warehouse_id' })
  warehouseId: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  availableQty: number;

  @Column({ name: 'synced_at' })
  syncedAt: Date;

  @Column({
    name: 'safety_stock',
    type: 'decimal',
    precision: 14,
    scale: 4,
    default: 0,
  })
  safetyStock: number;
}
