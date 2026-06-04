import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { User } from '../../users/entities/user.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVERTED = 'reverted',
  PARTIAL_RECEIVED = 'partial_received',
  RECEIVED = 'received',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('purchase_orders')
export class PurchaseOrder extends BaseEntity {
  @Column({ name: 'order_no', unique: true })
  orderNo: string;

  @Column({ name: 'supplier_id', type: 'varchar', nullable: true })
  supplierId: string | null;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_name', type: 'varchar', nullable: true })
  supplierName: string;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.DRAFT,
  })
  status: PurchaseOrderStatus;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalAmount: number;

  @Column({ type: 'varchar', nullable: true })
  remark: string;

  @Column({ name: 'approval_instance_code', type: 'varchar', nullable: true })
  approvalInstanceCode: string | null;

  @Column({ name: 'creator_id', type: 'uuid', nullable: true })
  creatorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ name: 'expected_delivery_date', type: 'date', nullable: true })
  expectedDeliveryDate: Date | null;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, {
    cascade: true,
  })
  items: PurchaseOrderItem[];
}
