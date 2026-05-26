import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Voucher } from './voucher.entity';

@Entity('voucher_items')
export class VoucherItem extends BaseEntity {
  @Column({ name: 'voucher_id' })
  voucherId: string;

  @Column({ name: 'account_code' })
  accountCode: string;

  @Column({ name: 'account_name', type: 'varchar', nullable: true })
  accountName: string | null;

  @Column({
    name: 'debit_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  debitAmount: number;

  @Column({
    name: 'credit_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  creditAmount: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToOne(() => Voucher, (voucher) => voucher.items)
  @JoinColumn({ name: 'voucher_id' })
  voucher?: Voucher;
}
