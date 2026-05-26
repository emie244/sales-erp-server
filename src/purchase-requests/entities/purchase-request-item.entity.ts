import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { PurchaseRequest } from './purchase-request.entity';

@Entity('purchase_request_items')
export class PurchaseRequestItem extends BaseEntity {
  @Column({ name: 'purchase_request_id' })
  purchaseRequestId: string;

  @ManyToOne(() => PurchaseRequest, (pr) => pr.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_request_id' })
  purchaseRequest: PurchaseRequest;

  @Column({ name: 'sku_id' })
  skuId: string;

  @Column({ name: 'sku_code', nullable: true })
  skuCode: string;

  @Column({ name: 'sku_name', nullable: true })
  skuName: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  qty: number;

  @Column({
    name: 'estimated_unit_price',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  estimatedUnitPrice: number | null;

  @Column({ name: 'supplier_id', type: 'varchar', nullable: true })
  supplierId: string | null;

  @Column({ name: 'supplier_name', type: 'varchar', nullable: true })
  supplierName: string | null;

  @Column({ name: 'bom_id', type: 'varchar', nullable: true })
  bomId: string | null;

  @Column({ nullable: true })
  remark: string;
}
