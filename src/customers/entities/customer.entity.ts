import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { CustomerAddress } from '../../customer-addresses/entities/customer-address.entity';
import { User } from '../../users/entities/user.entity';

export type CustomerStatus = 'active' | 'lead' | 'dormant';
export type CustomerType = 'standard' | 'distributor' | 'platform_shop';
export type CustomerAutoTier = 'strategic' | 'active' | 'dormant' | 'new';
export type CustomerSettlementType = 'one_off' | 'monthly' | 'quarterly';

@Entity('customers')
export class Customer extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  contactName: string;

  @Column({ name: 'contact_title', type: 'varchar', nullable: true })
  contactTitle: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string;

  @Column({ type: 'varchar', nullable: true })
  wechat: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  creditLimit: number;

  @Column({ name: 'is_credit_blocked', type: 'boolean', default: false })
  isCreditBlocked: boolean;

  @Column({ type: 'int', default: 0 })
  paymentTerms: number;

  @Column({ name: 'settlement_type', type: 'varchar', default: 'one_off' })
  settlementType: CustomerSettlementType;

  @Column({ type: 'varchar', nullable: true })
  address: string;

  @Column({
    name: 'customer_status',
    type: 'varchar',
    default: 'active',
  })
  customerStatus: CustomerStatus;

  @Column({
    name: 'customer_type',
    type: 'varchar',
    default: 'standard',
  })
  customerType: CustomerType;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tags: string[];

  @Column({ name: 'auto_tier', type: 'varchar', default: 'new' })
  autoTier: CustomerAutoTier;

  @Column({ name: 'is_strategic', type: 'boolean', default: false })
  isStrategic: boolean;

  @Column({ name: 'primary_assignee_id', type: 'uuid', nullable: true })
  primaryAssigneeId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'primary_assignee_id' })
  primaryAssignee?: User | null;

  @Column({ name: 'tax_id', type: 'varchar', nullable: true })
  taxId: string;

  @Column({ name: 'invoice_title', type: 'varchar', nullable: true })
  invoiceTitle: string;

  @Column({ name: 'invoice_address', type: 'varchar', nullable: true })
  invoiceAddress: string;

  @Column({ name: 'invoice_phone', type: 'varchar', nullable: true })
  invoicePhone: string;

  @Column({ name: 'invoice_bank', type: 'varchar', nullable: true })
  invoiceBank: string;

  @Column({ name: 'invoice_bank_account', type: 'varchar', nullable: true })
  invoiceBankAccount: string;

  @Column({ name: 'jst_customer_id', type: 'varchar', nullable: true })
  jstCustomerId: string;

  @Column({ name: 'legacy_customer_id', type: 'varchar', nullable: true })
  legacyCustomerId: string;

  @Column({ name: 'feishu_record_id', type: 'varchar', nullable: true })
  feishuRecordId: string;

  @Column({ name: 'migration_source', type: 'varchar', nullable: true })
  migrationSource: string;

  @Column({ name: 'latest_remark', type: 'text', nullable: true })
  latestRemark: string;

  @Column({ name: 'online_shop_urls', type: 'jsonb', nullable: true })
  onlineShopUrls: string[] | null;

  @Column({
    name: 'prepayment_balance',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  prepaymentBalance: number;

  @OneToMany(() => CustomerAddress, (address) => address.customer)
  addresses: CustomerAddress[];

  @Column({ name: 'tenant_id', type: 'varchar', nullable: true })
  tenantId: string;
}
