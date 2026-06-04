import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { SalesOrderItem } from './sales-order-item.entity';

export enum SalesOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSING = 'processing',
  READY_TO_SHIP = 'ready_to_ship',
  SYNCED_JST = 'synced_jst',
  SHIPPED = 'shipped',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum SalesOrderType {
  SALES = 'sales',
  OVERSEAS = 'overseas',
}

@Entity('sales_orders')
export class SalesOrder extends BaseEntity {
  @Column({
    type: 'enum',
    enum: SalesOrderType,
    default: SalesOrderType.SALES,
  })
  type: SalesOrderType;

  @Column({
    type: 'enum',
    enum: SalesOrderStatus,
    default: SalesOrderStatus.DRAFT,
  })
  status: SalesOrderStatus;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ name: 'salesperson_id', type: 'varchar', nullable: true })
  salespersonId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'salesperson_id' })
  salesperson: User;

  @Column({ name: 'jst_shop_owner_id', type: 'uuid', nullable: true })
  jstShopOwnerId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'jst_shop_owner_id' })
  jstShopOwner?: User | null;

  @Column({ name: 'order_no', type: 'varchar', nullable: true })
  orderNo: string;

  @Column({ name: 'feishu_record_id', type: 'varchar', nullable: true })
  feishuRecordId: string;

  @Column({ name: 'migration_source', type: 'varchar', nullable: true })
  migrationSource: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  payAmount: number;

  @Column({ type: 'varchar', nullable: true })
  remark: string;

  @Column({ name: 'delivery_date', type: 'date', nullable: true })
  deliveryDate: Date | null;

  @Column({ name: 'credit_warning', type: 'text', nullable: true })
  creditWarning: string | null;

  @Column({ name: 'floor_price_warning', type: 'text', nullable: true })
  floorPriceWarning: string | null;

  @Column({ name: 'delivery_warning', type: 'text', nullable: true })
  deliveryWarning: string | null;

  @Column({ type: 'simple-json', nullable: true })
  attachments: string[];

  @Column({ type: 'varchar', nullable: true })
  consignee: string;

  @Column({ name: 'consignee_phone', type: 'varchar', nullable: true })
  consigneePhone: string;

  @Column({ name: 'consignee_address', type: 'varchar', nullable: true })
  consigneeAddress: string;

  @Column({ name: 'consignee_province', type: 'varchar', nullable: true })
  consigneeProvince: string;

  @Column({ name: 'consignee_city', type: 'varchar', nullable: true })
  consigneeCity: string;

  @Column({ name: 'consignee_district', type: 'varchar', nullable: true })
  consigneeDistrict: string;

  @Column({ name: 'consignee_town', type: 'varchar', nullable: true })
  consigneeTown: string;

  @Column({ name: 'consignee_tel', type: 'varchar', nullable: true })
  consigneeTel: string;

  @Column({
    name: 'collected_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  collectedAmount: number;

  @Column({
    name: 'prepayment_deducted',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  prepaymentDeducted: number;

  @Column({ name: 'invoice_date', type: 'date', nullable: true })
  invoiceDate: Date | null;

  @Column({ name: 'payment_due_date', type: 'date', nullable: true })
  paymentDueDate: Date | null;

  @Column({ name: 'invoiced_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  invoicedAmount: number;

  @Column({ name: 'payment_method', type: 'varchar', nullable: true })
  paymentMethod: string;

  @Column({ name: 'logistics_company', type: 'varchar', nullable: true })
  logisticsCompany: string;

  @Column({ name: 'express_no', type: 'varchar', nullable: true })
  expressNo: string;

  @Column({ name: 'buyer_message', type: 'varchar', nullable: true })
  buyerMessage: string;

  @Column({ name: 'jst_so_id', type: 'varchar', nullable: true })
  jstSoId: string | null;

  @Column({ name: 'collection_data', type: 'jsonb', nullable: true })
  collectionData: {
    records: {
      amount: number;
      method: string;
      remark?: string;
      attachments?: string[];
      invoiceIds?: string[];
    }[];
    originalStatus: SalesOrderStatus;
  } | null;

  @OneToMany(() => SalesOrderItem, (item) => item.order, { cascade: true })
  items: SalesOrderItem[];

  @Column({ name: 'tenant_id', type: 'varchar', nullable: true })
  tenantId: string;
}
