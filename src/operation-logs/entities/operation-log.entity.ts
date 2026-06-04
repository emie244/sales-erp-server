import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('operation_logs')
export class OperationLog extends BaseEntity {
  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId: string;

  @Column({ name: 'user_name', type: 'varchar', nullable: true })
  userName: string;

  @Column()
  action: string;

  @Column({ type: 'varchar', nullable: true })
  resource: string;

  @Column({ name: 'resource_id', type: 'varchar', nullable: true })
  resourceId: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown>;

  @Column({ type: 'varchar', nullable: true })
  ip: string;

  @Column({ type: 'varchar', nullable: true })
  status: string;

  @Column({ name: 'error_message', type: 'varchar', nullable: true })
  errorMessage: string;

  @Column({ name: 'tenant_id', type: 'varchar', nullable: true })
  tenantId: string;
}
