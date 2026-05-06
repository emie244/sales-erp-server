import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class JushuitanScheduler {
  constructor(@InjectQueue('jushuitan-sync') private readonly queue: Queue) {}

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
}
