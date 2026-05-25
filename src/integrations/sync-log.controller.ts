import { Controller, Get, Param, Query } from '@nestjs/common';
import { Permissions } from '../auth/permissions.decorator';
import { SyncLogService } from './sync-log.service';
import type { SyncJobName } from './entities/sync-log.entity';

@Controller('admin/sync-logs')
@Permissions('admin:sync_logs')
export class SyncLogController {
  constructor(private readonly service: SyncLogService) {}

  @Get()
  async list(
    @Query('jobName') jobName?: SyncJobName,
    @Query('limit') limit?: string,
  ) {
    const n = Math.min(Math.max(parseInt(limit || '50', 10) || 50, 1), 500);
    return this.service.findRecent(jobName, n);
  }

  @Get('aggregate/monthly')
  async monthly(
    @Query('jobName') jobName: SyncJobName,
    @Query('months') months?: string,
  ) {
    const m = Math.min(Math.max(parseInt(months || '12', 10) || 12, 1), 24);
    return this.service.aggregateMonthly(jobName, m);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.service.findById(id);
  }
}
