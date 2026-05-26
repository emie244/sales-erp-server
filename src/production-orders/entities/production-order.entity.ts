import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ProductionOrderItem } from './production-order-item.entity';

export enum ProductionOrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('production_orders')
export class ProductionOrder extends BaseEntity {
  @Column({ name: 'order_no', unique: true })
  orderNo: string;

  @Column({ name: 'bom_id' })
  bomId: string;

  @Column({ name: 'sku_id' })
  skuId: string;

  @Column({ name: 'sku_name', nullable: true })
  skuName: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  qty: number;

  @Column({
    type: 'enum',
    enum: ProductionOrderStatus,
    default: ProductionOrderStatus.PENDING,
  })
  status: ProductionOrderStatus;

  @Column({ nullable: true })
  remark: string;

  @Column({ name: 'creator_id', nullable: true })
  creatorId: string;

  @Column({ name: 'sales_order_id', type: 'varchar', nullable: true })
  salesOrderId: string | null;

  @OneToMany(() => ProductionOrderItem, (item) => item.productionOrder, {
    cascade: true,
  })
  items: ProductionOrderItem[];
}
