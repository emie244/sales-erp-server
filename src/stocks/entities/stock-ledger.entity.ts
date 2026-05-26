import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export type StockLedgerType = 'inbound' | 'outbound';
export type StockReferenceType =
  | 'sales_order'
  | 'purchase_order'
  | 'production_order'
  | 'adjustment'
  | 'initial';

@Entity('stock_ledger')
@Index(['skuId', 'createdAt'])
@Index(['referenceType', 'referenceId'])
export class StockLedger extends BaseEntity {
  @Column({ name: 'sku_id' })
  skuId: string;

  @Column({ type: 'enum', enum: ['inbound', 'outbound'] })
  type: StockLedgerType;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  qty: number;

  @Column({
    name: 'reference_type',
    type: 'enum',
    enum: [
      'sales_order',
      'purchase_order',
      'production_order',
      'adjustment',
      'initial',
    ],
  })
  referenceType: StockReferenceType;

  @Column({ name: 'reference_id' })
  referenceId: string;

  @Column({ name: 'before_qty', type: 'decimal', precision: 14, scale: 4 })
  beforeQty: number;

  @Column({ name: 'after_qty', type: 'decimal', precision: 14, scale: 4 })
  afterQty: number;

  @Column({ nullable: true })
  remark: string;
}
