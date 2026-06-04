import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('delivery_orders')
export class DeliveryOrder extends BaseEntity {
  @Column({ name: 'sales_order_id' })
  salesOrderId: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ type: 'varchar', nullable: true })
  trackingNo: string;

  @Column({ type: 'varchar', nullable: true })
  carrier: string;

  @Column({ nullable: true })
  shippedAt: Date;

  @Column({ name: 'is_transferred_to_finance', type: 'boolean', default: false })
  isTransferredToFinance: boolean;
}
