import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum PaymentType {
  COLLECTION = 'collection',
  PREPAYMENT = 'prepayment',
}

export type PaymentMethodNormalized =
  | 'public_transfer'
  | 'private_wechat'
  | 'private_alipay'
  | 'cash'
  | 'other';

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
  invoiceIds: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  attachments: string[];

  @Column({
    name: 'tax_rate',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  taxRate: number | null;

  @Column({
    name: 'tax_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  taxAmount: number | null;

  @Column({ name: 'feishu_record_id', type: 'varchar', nullable: true })
  feishuRecordId: string | null;

  @Column({ name: 'migration_source', type: 'varchar', nullable: true })
  migrationSource: string | null;

  @Column({ name: 'orphan_order_no', type: 'varchar', nullable: true })
  orphanOrderNo: string | null;

  @Column({
    name: 'method_normalized',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  methodNormalized: PaymentMethodNormalized | null;

  @Column({
    name: 'tax_rate_normalized',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  taxRateNormalized: number | null;
}
