import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { VoucherItem } from './voucher-item.entity';

export enum VoucherType {
  RECEIVABLE = 'receivable',
  RECEIPT = 'receipt',
  PAYMENT = 'payment',
  ADJUSTMENT = 'adjustment',
}

export enum VoucherStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
  CANCELLED = 'cancelled',
}

@Entity('vouchers')
@Index(['sourceType', 'sourceId'])
export class Voucher extends BaseEntity {
  @Column({ name: 'voucher_no' })
  voucherNo: string;

  @Column({ name: 'voucher_date', type: 'date' })
  voucherDate: Date;

  @Column({
    type: 'enum',
    enum: VoucherType,
    default: VoucherType.ADJUSTMENT,
  })
  type: VoucherType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2 })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: VoucherStatus,
    default: VoucherStatus.DRAFT,
  })
  status: VoucherStatus;

  @Column({ name: 'source_type', type: 'varchar', nullable: true })
  sourceType: string | null;

  @Column({ name: 'source_id', type: 'varchar', nullable: true })
  sourceId: string | null;

  @OneToMany(() => VoucherItem, (item) => item.voucher, {
    cascade: true,
  })
  items?: VoucherItem[];
}
