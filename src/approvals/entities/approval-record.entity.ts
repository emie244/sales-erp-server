import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { SalesOrder } from '../../sales/entities/sales-order.entity';

@Entity('approval_records')
export class ApprovalRecord extends BaseEntity {
  @Column({ name: 'sales_order_id', unique: true })
  salesOrderId: string;

  @OneToOne(() => SalesOrder)
  @JoinColumn({ name: 'sales_order_id' })
  salesOrder: SalesOrder;

  @Column({ name: 'feishu_instance_code' })
  feishuInstanceCode: string;

  @Column({ name: 'feishu_approval_def_code' })
  feishuApprovalDefCode: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'approved' | 'rejected' | 'transferred';

  @Column({ type: 'jsonb', nullable: true })
  callbackPayload: any;
}
