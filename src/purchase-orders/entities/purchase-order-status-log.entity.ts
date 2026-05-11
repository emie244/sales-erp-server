import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('purchase_order_status_logs')
export class PurchaseOrderStatusLog extends BaseEntity {
  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @Column({ name: 'from_status', nullable: true })
  fromStatus: string | null;

  @Column({ name: 'to_status' })
  toStatus: string;

  @Column({ name: 'operator_id', nullable: true })
  operatorId: string | null;

  @Column({ name: 'remark', nullable: true })
  remark: string | null;
}
