import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ name: 'feishu_open_id', unique: true, nullable: true })
  feishuOpenId: string;

  @Column({ name: 'feishu_user_id', nullable: true })
  feishuUserId: string;

  @Column({ name: 'feishu_union_id', nullable: true })
  feishuUnionId: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 'user' })
  role: string;

  @Column({ nullable: true })
  password: string;

  @Column({ name: 'jushuitan_shop_id', nullable: true })
  jushuitanShopId: string;

  @Column({ type: 'jsonb', default: [] })
  permissions: string[];

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @Column({ nullable: true })
  avatar: string;
}
