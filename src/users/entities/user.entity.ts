import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ name: 'feishu_open_id', unique: true, nullable: true })
  feishuOpenId: string;

  @Column({ name: 'feishu_user_id', type: 'varchar', nullable: true })
  feishuUserId: string;

  @Column({ name: 'feishu_union_id', type: 'varchar', nullable: true })
  feishuUnionId: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ default: 'user' })
  role: string;

  @Column({ type: 'varchar', nullable: true })
  password: string;

  @Column({ name: 'jushuitan_shop_id', type: 'varchar', nullable: true })
  jushuitanShopId: string;

  @Column({ type: 'jsonb', default: [] })
  permissions: string[];

  @Column({ name: 'tenant_id', type: 'varchar', nullable: true })
  tenantId: string;

  @Column({ type: 'varchar', nullable: true })
  avatar: string;

  @Column({ name: 'is_first_login', type: 'boolean', default: true })
  isFirstLogin: boolean;
}
