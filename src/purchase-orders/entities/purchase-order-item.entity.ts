import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { PurchaseOrder } from './purchase-order.entity';

@Entity('purchase_order_items')
export class PurchaseOrderItem extends BaseEntity {
  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (order) => order.items)
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'sku_id' })
  skuId: string;

  @Column({ name: 'sku_code', nullable: true })
  skuCode: string;

  @Column({ name: 'sku_name', nullable: true })
  skuName: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  qty: number;

  @Column({
    name: 'received_qty',
    type: 'decimal',
    precision: 14,
    scale: 4,
    default: 0,
  })
  receivedQty: number;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  unitPrice: number;

  @Column({
    name: 'line_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  lineAmount: number;

  @Column({ name: 'supplier_id', nullable: true })
  supplierId: string;

  @Column({ name: 'supplier_name', nullable: true })
  supplierName: string;

  @Column({ name: 'bom_id', nullable: true })
  bomId: string;

  @Column({ nullable: true })
  remark: string;
}
