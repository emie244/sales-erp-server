import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { BomHeader } from './bom-header.entity';

@Entity('bom_items')
export class BomItem extends BaseEntity {
  @Column({ name: 'bom_header_id' })
  bomHeaderId: string;

  @ManyToOne(() => BomHeader, (header) => header.items)
  @JoinColumn({ name: 'bom_header_id' })
  bomHeader: BomHeader;

  @Column({ name: 'material_sku_id' })
  materialSkuId: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  qty: number;

  @Column({
    name: 'loss_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  lossRate: number;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'material_category_id', type: 'uuid', nullable: true })
  materialCategoryId: string | null;

  @Column({ name: 'material_category_name', type: 'varchar', nullable: true })
  materialCategoryName: string | null;

  @Column({ nullable: true })
  remark: string;
}
