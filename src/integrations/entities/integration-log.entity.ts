import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('integration_logs')
export class IntegrationLog extends BaseEntity {
  @Column()
  provider: string;

  @Column()
  action: string;

  @Column({ type: 'jsonb' })
  request: unknown;

  @Column({ type: 'jsonb', nullable: true })
  response: unknown;

  @Column({ default: false })
  success: boolean;

  @Column({ nullable: true })
  errorMessage: string;
}
