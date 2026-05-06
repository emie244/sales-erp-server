import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { BomItem } from './bom-item.entity';

@Entity('bom_headers')
export class BomHeader extends BaseEntity {
  @Column({ name: 'product_id' })
  productId: string;

  @Column({ name: 'sku_id' })
  skuId: string;

  @Column({ default: 'v1' })
  version: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  remark: string;

  @OneToMany(() => BomItem, (item) => item.bomHeader, { cascade: true })
  items: BomItem[];
}
