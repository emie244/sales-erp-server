import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export type SyncJobName =
  | 'sync-stock'
  | 'sync-deliveries'
  | 'sync-skus'
  | 'push-order';

export type SyncJobStatus = 'running' | 'succeeded' | 'failed' | 'partial';

export type SyncTriggeredBy = 'cron' | 'manual' | 'webhook';

export interface SyncLogError {
  skuCode?: string;
  message: string;
  stack?: string;
}

@Entity('sync_logs')
@Index('IDX_sync_logs_job_name_started_at', ['jobName', 'startedAt'])
@Index('IDX_sync_logs_status', ['status'])
@Index('IDX_sync_logs_started_at', ['startedAt'])
export class SyncLog extends BaseEntity {
  @Column({ name: 'job_name', type: 'varchar', length: 32 })
  jobName: SyncJobName;

  @Column({ type: 'varchar', length: 16, default: 'running' })
  status: SyncJobStatus;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'fetched_count', type: 'integer', default: 0 })
  fetchedCount: number;

  @Column({ name: 'inserted_count', type: 'integer', default: 0 })
  insertedCount: number;

  @Column({ name: 'updated_count', type: 'integer', default: 0 })
  updatedCount: number;

  @Column({ name: 'skipped_count', type: 'integer', default: 0 })
  skippedCount: number;

  @Column({ name: 'item_type_null_count', type: 'integer', default: 0 })
  itemTypeNullCount: number;

  @Column({ name: 'code_non_compliant_count', type: 'integer', default: 0 })
  codeNonCompliantCount: number;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  errors: SyncLogError[];

  @Column({
    name: 'triggered_by',
    type: 'varchar',
    length: 16,
    default: 'cron',
  })
  triggeredBy: SyncTriggeredBy;

  @Column({ name: 'triggered_by_user_id', type: 'uuid', nullable: true })
  triggeredByUserId: string | null;

  @Column({ name: 'bull_job_id', type: 'varchar', length: 64, nullable: true })
  bullJobId: string | null;
}
