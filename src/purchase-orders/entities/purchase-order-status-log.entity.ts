import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('purchase_order_status_logs')
export class PurchaseOrderStatusLog extends BaseEntity {
  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @Column({ name: 'from_status', type: 'varchar', nullable: true })
  fromStatus: string | null;

  @Column({ name: 'to_status', type: 'varchar' })
  toStatus: string;

  @Column({ name: 'operator_id', type: 'varchar', nullable: true })
  operatorId: string | null;

  @Column({ name: 'remark', type: 'varchar', nullable: true })
  remark: string | null;
}
