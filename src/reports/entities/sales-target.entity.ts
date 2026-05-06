import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('sales_targets')
export class SalesTarget extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'user_name', nullable: true })
  userName: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  targetAmount: number;

  @Column({ nullable: true })
  period: string; // e.g. '2026-04' for monthly

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;
}
