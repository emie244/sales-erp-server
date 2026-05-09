import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { SalesOrder } from '../../sales/entities/sales-order.entity';

export enum ApprovalType {
  SALES_ORDER = 'sales_order',
  PREPAYMENT = 'prepayment',
  COLLECTION = 'collection',
  PURCHASE_ORDER = 'purchase_order',
}

@Entity('approval_records')
export class ApprovalRecord extends BaseEntity {
  @Column({ name: 'sales_order_id', nullable: true })
  salesOrderId: string;

  @ManyToOne(() => SalesOrder)
  @JoinColumn({ name: 'sales_order_id' })
  salesOrder: SalesOrder;

  @Column({ name: 'purchase_order_id', nullable: true })
  purchaseOrderId: string;

  @Column({ name: 'prepayment_record_id', nullable: true })
  prepaymentRecordId: string;

  @Column({ name: 'payment_record_id', nullable: true })
  paymentRecordId: string;

  @Column({
    type: 'enum',
    enum: ApprovalType,
    default: ApprovalType.SALES_ORDER,
  })
  type: ApprovalType;

  @Column({ name: 'feishu_instance_code' })
  feishuInstanceCode: string;

  @Column({ name: 'feishu_approval_def_code' })
  feishuApprovalDefCode: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'approved' | 'rejected' | 'transferred';

  @Column({ type: 'jsonb', nullable: true })
  callbackPayload: unknown;
}
