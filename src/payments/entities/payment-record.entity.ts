import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('payment_records')
export class PaymentRecord extends BaseEntity {
  @Column({ name: 'sales_order_id' })
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
}
