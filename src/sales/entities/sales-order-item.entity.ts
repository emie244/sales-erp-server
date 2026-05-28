import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { SalesOrder } from './sales-order.entity';

export type SalesOrderItemMatchMethod =
  | 'barcode'
  | 'fuzzy'
  | 'misc'
  | 'unmatched';

@Entity('sales_order_items')
export class SalesOrderItem extends BaseEntity {
  @Column({ name: 'order_id', type: 'varchar', nullable: true })
  orderId: string | null;

  @ManyToOne(() => SalesOrder, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order: SalesOrder;

  @Column({ name: 'product_id', nullable: true })
  productId: string;

  @Column({ name: 'sku_id', type: 'varchar', nullable: true })
  skuId: string | null;

  @Column({ name: 'jst_sku_id', nullable: true })
  jstSkuId: string;

  @Column({ name: 'sku_code', nullable: true })
  skuCode: string;

  @Column({ name: 'product_name', nullable: true })
  productName: string;

  @Column({ nullable: true })
  skuName: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  qty: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  lineAmount: number;

  @Column({
    name: 'commission_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  commissionRate: number | null;

  @Column({
    name: 'commission_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  commissionAmount: number | null;

  @Column({
    name: 'match_method',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  matchMethod: SalesOrderItemMatchMethod | null;

  @Column({
    name: 'match_confidence',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  matchConfidence: number | null;

  @Column({ name: 'misc_description', type: 'varchar', nullable: true })
  miscDescription: string | null;

  @Column({ name: 'barcode_text', type: 'varchar', nullable: true })
  barcodeText: string | null;

  @Column({ name: 'product_name_text', type: 'varchar', nullable: true })
  productNameText: string | null;

  @Column({ name: 'spec_text', type: 'varchar', nullable: true })
  specText: string | null;

  @Column({ name: 'feishu_record_id', type: 'varchar', nullable: true })
  feishuRecordId: string | null;

  @Column({ name: 'orphan_order_no', type: 'varchar', nullable: true })
  orphanOrderNo: string | null;

  @Column({ name: 'bom_id', type: 'uuid', nullable: true })
  bomId: string | null;
}
