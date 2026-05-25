import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SyncLog,
  SyncJobName,
  SyncJobStatus,
  SyncTriggeredBy,
  SyncLogError,
} from './entities/sync-log.entity';

export interface SyncCounts {
  fetchedCount?: number;
  insertedCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  itemTypeNullCount?: number;
  codeNonCompliantCount?: number;
}

export interface StartSyncOptions {
  jobName: SyncJobName;
  triggeredBy?: SyncTriggeredBy;
  triggeredByUserId?: string | null;
  bullJobId?: string | null;
}

@Injectable()
export class SyncLogService {
  constructor(
    @InjectRepository(SyncLog)
    private readonly repo: Repository<SyncLog>,
  ) {}

  async start(opts: StartSyncOptions): Promise<SyncLog> {
    return this.repo.save(
      this.repo.create({
        jobName: opts.jobName,
        status: 'running',
        triggeredBy: opts.triggeredBy ?? 'cron',
        triggeredByUserId: opts.triggeredByUserId ?? null,
        bullJobId: opts.bullJobId ?? null,
      }),
    );
  }

  async finish(
    logId: string,
    status: SyncJobStatus,
    counts: SyncCounts,
    errors: SyncLogError[] = [],
  ): Promise<void> {
    await this.repo.update(logId, {
      status,
      finishedAt: new Date(),
      fetchedCount: counts.fetchedCount ?? 0,
      insertedCount: counts.insertedCount ?? 0,
      updatedCount: counts.updatedCount ?? 0,
      skippedCount: counts.skippedCount ?? 0,
      itemTypeNullCount: counts.itemTypeNullCount ?? 0,
      codeNonCompliantCount: counts.codeNonCompliantCount ?? 0,
      errors,
    });
  }

  async findRecent(jobName?: SyncJobName, limit = 50): Promise<SyncLog[]> {
    return this.repo.find({
      where: jobName ? { jobName } : undefined,
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }

  async findById(id: string): Promise<SyncLog | null> {
    return this.repo.findOneBy({ id });
  }

  async cleanupOld(
    retainDaysNormal = 90,
    retainDaysFailed = 180,
  ): Promise<{
    deletedNormal: number;
    deletedFailed: number;
  }> {
    const normalCutoff = new Date(
      Date.now() - retainDaysNormal * 24 * 60 * 60 * 1000,
    );
    const failedCutoff = new Date(
      Date.now() - retainDaysFailed * 24 * 60 * 60 * 1000,
    );

    const r1 = await this.repo
      .createQueryBuilder()
      .delete()
      .where(
        '"started_at" < :cutoff AND "status" = :ok AND "item_type_null_count" = 0 AND "code_non_compliant_count" = 0',
        { cutoff: normalCutoff, ok: 'succeeded' },
      )
      .execute();

    const r2 = await this.repo
      .createQueryBuilder()
      .delete()
      .where('"started_at" < :cutoff', { cutoff: failedCutoff })
      .execute();

    return {
      deletedNormal: r1.affected ?? 0,
      deletedFailed: r2.affected ?? 0,
    };
  }

  async aggregateMonthly(
    jobName: SyncJobName,
    months = 12,
  ): Promise<
    Array<{
      month: string;
      itemTypeNullSum: number;
      codeNonCompliantSum: number;
      jobCount: number;
    }>
  > {
    const cutoff = new Date(Date.now() - months * 31 * 24 * 60 * 60 * 1000);
    const rows = await this.repo
      .createQueryBuilder('s')
      .select("to_char(date_trunc('month', s.started_at), 'YYYY-MM')", 'month')
      .addSelect('SUM(s.item_type_null_count)::int', 'itemTypeNullSum')
      .addSelect('SUM(s.code_non_compliant_count)::int', 'codeNonCompliantSum')
      .addSelect('COUNT(*)::int', 'jobCount')
      .where('s.job_name = :jobName', { jobName })
      .andWhere('s.started_at >= :cutoff', { cutoff })
      .andWhere('s.status != :running', { running: 'running' })
      .groupBy("date_trunc('month', s.started_at)")
      .orderBy('month', 'DESC')
      .getRawMany();
    return rows as Array<{
      month: string;
      itemTypeNullSum: number;
      codeNonCompliantSum: number;
      jobCount: number;
    }>;
  }
}
