import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('suppliers')
export class Supplier extends BaseEntity {
  @Column()
  name: string;

  @Column({ name: 'contact_name', type: 'varchar', nullable: true })
  contactName: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string;

  @Column({ type: 'varchar', nullable: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  address: string;

  @Column({ type: 'varchar', nullable: true })
  remark: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
