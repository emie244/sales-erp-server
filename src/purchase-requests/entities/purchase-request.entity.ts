import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { PurchaseRequestItem } from './purchase-request-item.entity';

export enum PurchaseRequestStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CONVERTED = 'converted',
  CANCELLED = 'cancelled',
}

@Entity('purchase_requests')
export class PurchaseRequest extends BaseEntity {
  @Column({ name: 'pr_no', unique: true })
  prNo: string;

  @Column({ name: 'sales_order_id', type: 'varchar', nullable: true })
  salesOrderId: string | null;

  @Column({
    type: 'enum',
    enum: PurchaseRequestStatus,
    default: PurchaseRequestStatus.DRAFT,
  })
  status: PurchaseRequestStatus;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ nullable: true })
  remark: string;

  @Column({ name: 'creator_id', nullable: true })
  creatorId: string;

  @Column({ name: 'converted_po_id', type: 'varchar', nullable: true })
  convertedPoId: string | null;

  @OneToMany(() => PurchaseRequestItem, (item) => item.purchaseRequest, {
    cascade: true,
  })
  items: PurchaseRequestItem[];
}
