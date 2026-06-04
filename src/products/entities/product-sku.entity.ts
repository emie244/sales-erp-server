import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from './product.entity';

@Entity('product_skus')
export class ProductSku extends BaseEntity {
  @Column()
  skuCode: string;

  @Column({ type: 'varchar', nullable: true })
  barcode: string;

  @Column({ type: 'varchar', nullable: true })
  skuName: string;

  @Column({ type: 'varchar', nullable: true })
  spec: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  weight: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.skus)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'jst_sku_id', type: 'varchar', nullable: true })
  jstSkuId: string;

  @Column({ type: 'varchar', nullable: true })
  pic: string;

  @Column({ name: 'local_pic', type: 'varchar', nullable: true })
  localPic: string;

  @Column({ type: 'simple-json', nullable: true })
  pics: string[] | null;

  @Column({ name: 'properties_value', type: 'varchar', nullable: true })
  propertiesValue: string;

  @Column({ type: 'varchar', nullable: true })
  category: string;

  @Column({ type: 'varchar', nullable: true })
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

  @Column({
    name: 'floor_price',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  floorPrice: number | null;

  @Column({ name: 'item_type', type: 'varchar', length: 16, nullable: true })
  itemType:
    | 'finished_good'
    | 'semi_finished'
    | 'raw_material'
    | 'packaging'
    | null;

  @Column({ name: 'material_category_id', type: 'uuid', nullable: true })
  materialCategoryId: string | null;

  @Column({
    name: 'material_category_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  materialCategoryName: string | null;

  @Column({ name: 'code_compliant', type: 'boolean', default: false })
  codeCompliant: boolean;

  @Column({ name: 'default_supplier_id', type: 'uuid', nullable: true })
  defaultSupplierId: string | null;

  @Column({ name: 'default_processor_id', type: 'uuid', nullable: true })
  defaultProcessorId: string | null;

  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: ['pending', 'syncing', 'synced', 'failed'],
    default: 'pending',
  })
  syncStatus: string;

  @Column({ name: 'sync_error_message', type: 'text', nullable: true })
  syncErrorMessage: string | null;

  @Column({ name: 'last_sync_at', type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;
}
