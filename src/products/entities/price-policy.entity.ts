import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ProductSku } from './product-sku.entity';

@Entity('price_policies')
export class PricePolicy extends BaseEntity {
  @Column({ name: 'sku_id' })
  skuId: string;

  @ManyToOne(() => ProductSku)
  @JoinColumn({ name: 'sku_id' })
  sku: ProductSku;

  @Column()
  customerLevel: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  minQty: number;
}
