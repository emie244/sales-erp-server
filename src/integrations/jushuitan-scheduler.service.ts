import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { JushuitanService } from './jushuitan.service';

@Injectable()
export class JushuitanScheduler {
  private readonly logger = new Logger(JushuitanScheduler.name);

  constructor(
    @InjectQueue('jushuitan-sync') private readonly queue: Queue,
    private readonly jushuitanService: JushuitanService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncDeliveries() {
    await this.queue.add('sync-deliveries', {});
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncStock() {
    await this.queue.add('sync-stock', {});
  }

  @Cron('0 2 * * *')
  async syncSkus() {
    await this.queue.add('sync-skus', { daysBack: 1 });
  }

  @Cron('0 3 * * *')
  async syncBoms() {
    await this.queue.add('sync-boms', {});
  }

  @Cron('30 1 * * *')
  async refreshToken() {
    this.logger.log('Proactive Jushuitan token refresh started');
    const result = await this.jushuitanService.refreshAccessToken();
    if (result.success) {
      this.logger.log('Proactive token refresh succeeded');
    } else {
      this.logger.error(`Proactive token refresh failed: ${result.error}`);
    }
  }
}
