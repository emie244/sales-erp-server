import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from './product.entity';

@Entity('product_skus')
export class ProductSku extends BaseEntity {
  @Column()
  skuCode: string;

  @Column({ nullable: true })
  barcode: string;

  @Column({ nullable: true })
  skuName: string;

  @Column({ nullable: true })
  spec: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  weight: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.skus)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'jst_sku_id', nullable: true })
  jstSkuId: string;

  @Column({ nullable: true })
  pic: string;

  @Column({ name: 'properties_value', nullable: true })
  propertiesValue: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  brand: string;

  @Column({
    name: 'sale_price',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  salePrice: number | null;

  @Column({
    name: 'cost_price',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  costPrice: number | null;
}
