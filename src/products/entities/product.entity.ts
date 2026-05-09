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

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  category: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ name: 'jst_goods_id', nullable: true })
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

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;
}
