import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ProductSku } from './product-sku.entity';

export type ProductLifecycleStage =
  | 'concept'
  | 'launching'
  | 'new'
  | 'growth'
  | 'mature'
  | 'decline'
  | 'discontinued';

@Entity('products')
export class Product extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  category: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'jst_goods_id', type: 'varchar', nullable: true })
  jstGoodsId: string;

  @Column({ name: 'launch_date', type: 'date', nullable: true })
  launchDate: Date | null;

  @Column({
    name: 'lifecycle_stage',
    type: 'enum',
    enum: [
      'concept',
      'launching',
      'new',
      'growth',
      'mature',
      'decline',
      'discontinued',
    ],
    nullable: true,
  })
  lifecycleStage: ProductLifecycleStage | null;

  @OneToMany(() => ProductSku, (sku) => sku.product)
  skus: ProductSku[];

  @Column({ name: 'spu_code', type: 'varchar', nullable: true })
  spuCode: string | null;

  @Column({ name: 'is_draft', type: 'boolean', default: false })
  isDraft: boolean;

  @Column({ name: 'item_type', type: 'varchar', length: 16, nullable: true })
  itemType:
    | 'finished_good'
    | 'semi_finished'
    | 'raw_material'
    | 'packaging'
    | null;

  @Column({ name: 'tenant_id', type: 'varchar', nullable: true })
  tenantId: string;
}
