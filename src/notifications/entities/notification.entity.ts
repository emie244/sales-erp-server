import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export type NotificationType =
  | 'sku_sync_failed'
  | 'bom_sync_failed'
  | 'order_push_failed'
  | 'stock_alert'
  | 'system';

@Entity('notifications')
@Index(['userId', 'isRead'])
@Index(['createdAt'])
export class Notification extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'related_id', type: 'varchar', nullable: true })
  relatedId: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt: Date | null;
}
