import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum PaymentType {
  COLLECTION = 'collection',
  PREPAYMENT = 'prepayment',
}

@Entity('payment_records')
export class PaymentRecord extends BaseEntity {
  @Column({ name: 'sales_order_id', nullable: true })
  salesOrderId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column()
  method: string;

  @Column({ name: 'received_at' })
  receivedAt: Date;

  @Column({ name: 'received_by' })
  receivedBy: string;

  @Column({ nullable: true })
  remark: string;

  @Column({ type: 'enum', enum: PaymentType, default: PaymentType.COLLECTION })
  type: PaymentType;

  @Column({ name: 'prepayment_record_id', nullable: true })
  prepaymentRecordId: string;

  @Column({ type: 'simple-json', nullable: true })
  attachments: string[];
}
