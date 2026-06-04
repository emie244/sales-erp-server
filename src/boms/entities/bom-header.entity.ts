import { Entity, Column, OneToMany, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { BomItem } from './bom-item.entity';

@Entity('bom_headers')
@Unique(['productId', 'skuId', 'version'])
export class BomHeader extends BaseEntity {
  @Column({ name: 'product_id' })
  productId: string;

  @Column({ name: 'sku_id' })
  skuId: string;

  @Column({ default: 'v1' })
  version: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', nullable: true })
  remark: string;

  @OneToMany(() => BomItem, (item) => item.bomHeader, { cascade: true })
  items: BomItem[];
}
