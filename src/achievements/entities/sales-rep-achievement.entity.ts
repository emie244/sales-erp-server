import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('sales_rep_achievements')
export class SalesRepAchievement extends BaseEntity {
  @Column({ name: 'sales_order_id' })
  salesOrderId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  role: 'primary' | 'assistant';

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  shareRatio: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  achievementAmount: number;
}
