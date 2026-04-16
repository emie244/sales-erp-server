import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('delivery_order_items')
export class DeliveryOrderItem extends BaseEntity {
  @Column({ name: 'delivery_order_id' })
  deliveryOrderId: string;

  @Column({ name: 'sales_order_item_id' })
  salesOrderItemId: string;

  @Column({ name: 'sku_id' })
  skuId: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  qty: number;
}
