import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { SalesOrder } from './sales-order.entity';

@Entity('sales_order_items')
export class SalesOrderItem extends BaseEntity {
  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => SalesOrder, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order: SalesOrder;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ name: 'sku_id' })
  skuId: string;

  @Column({ name: 'jst_sku_id', nullable: true })
  jstSkuId: string;

  @Column({ name: 'product_name', nullable: true })
  productName: string;

  @Column()
  skuName: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  qty: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  lineAmount: number;
}
