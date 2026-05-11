import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('material_categories')
export class MaterialCategory extends BaseEntity {
  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string | null;

  @Column({ default: 1 })
  level: number;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
