import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ProductSku } from './product-sku.entity';

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

  @OneToMany(() => ProductSku, (sku) => sku.product)
  skus: ProductSku[];

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;
}
