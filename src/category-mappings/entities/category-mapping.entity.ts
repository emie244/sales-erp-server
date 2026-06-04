import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('category_mappings')
@Index(['erpCategory'], { unique: true })
export class CategoryMapping extends BaseEntity {
  @Column({ name: 'erp_category', type: 'varchar', unique: true })
  erpCategory: string;

  @Column({ name: 'jst_category', type: 'varchar' })
  jstCategory: string;

  @Column({ name: 'jst_category_id', type: 'varchar', nullable: true })
  jstCategoryId: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
