import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  CANCELLED = 'cancelled',
}

@Entity('invoice_records')
@Index(['salesOrderId'])
@Index(['invoiceNo'])
export class InvoiceRecord extends BaseEntity {
  @Column({ name: 'invoice_no' })
  invoiceNo: string;

  @Column({ name: 'sales_order_id', type: 'varchar', nullable: true })
  salesOrderId: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ name: 'invoice_date', type: 'date' })
  invoiceDate: Date;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  paidAmount: number;

  @Column({
    name: 'remaining_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  remainingAmount: number;

  @Column({ nullable: true })
  issuer: string;

  @Column({ nullable: true })
  remark: string;
}
