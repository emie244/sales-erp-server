import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ProductionOrderItem } from './production-order-item.entity';

@Entity('production_order_item_allocations')
export class ProductionOrderItemAllocation extends BaseEntity {
  @Column({ name: 'production_order_item_id', type: 'uuid' })
  productionOrderItemId: string;

  @ManyToOne(() => ProductionOrderItem, (item) => item.allocations)
  @JoinColumn({ name: 'production_order_item_id' })
  productionOrderItem: ProductionOrderItem;

  @Column({ name: 'purchase_order_item_id', type: 'uuid' })
  purchaseOrderItemId: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  qty: number;
}
