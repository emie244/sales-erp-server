import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Customer } from '../../customers/entities/customer.entity';

export enum PrepaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('prepayment_records')
export class PrepaymentRecord extends BaseEntity {
  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  amount: number;

  @Column({ name: 'payment_method', nullable: true })
  paymentMethod: string;

  @Column({ name: 'payment_date', nullable: true, type: 'date' })
  paymentDate: Date;

  @Column({ name: 'receipt_url', nullable: true })
  receiptUrl: string;

  @Column({ nullable: true })
  remark: string;

  @Column({
    type: 'enum',
    enum: PrepaymentStatus,
    default: PrepaymentStatus.PENDING,
  })
  status: PrepaymentStatus;

  @Column({ name: 'approval_instance_code', nullable: true })
  approvalInstanceCode: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;
}
