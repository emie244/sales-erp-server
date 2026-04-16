import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('integration_logs')
export class IntegrationLog extends BaseEntity {
  @Column()
  provider: string;

  @Column()
  action: string;

  @Column({ type: 'jsonb' })
  request: any;

  @Column({ type: 'jsonb', nullable: true })
  response: any;

  @Column({ default: false })
  success: boolean;

  @Column({ nullable: true })
  errorMessage: string;
}
