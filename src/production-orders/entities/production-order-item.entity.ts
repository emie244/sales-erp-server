import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ProductionOrder } from './production-order.entity';
import { ProductionOrderItemAllocation } from './production-order-item-allocation.entity';

@Entity('production_order_items')
export class ProductionOrderItem extends BaseEntity {
  @Column({ name: 'production_order_id' })
  productionOrderId: string;

  @ManyToOne(() => ProductionOrder, (order) => order.items)
  @JoinColumn({ name: 'production_order_id' })
  productionOrder: ProductionOrder;

  @Column({ name: 'material_sku_id' })
  materialSkuId: string;

  @Column({ name: 'material_sku_name', nullable: true })
  materialSkuName: string;

  @Column({ name: 'required_qty', type: 'decimal', precision: 14, scale: 4 })
  requiredQty: number;

  @Column({
    name: 'actual_qty',
    type: 'decimal',
    precision: 14,
    scale: 4,
    default: 0,
  })
  actualQty: number;

  @Column({ nullable: true })
  remark: string;

  @OneToMany(
    () => ProductionOrderItemAllocation,
    (allocation) => allocation.productionOrderItem,
  )
  allocations: ProductionOrderItemAllocation[];
}
