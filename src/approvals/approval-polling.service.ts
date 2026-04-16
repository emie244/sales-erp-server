import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalRecord } from './entities/approval-record.entity';
import { FeishuApprovalService } from './feishu-approval.service';
import { ApprovalService } from './approval.service';

@Injectable()
export class ApprovalPollingService {
  private readonly logger = new Logger(ApprovalPollingService.name);

  constructor(
    @InjectRepository(ApprovalRecord)
    private readonly repo: Repository<ApprovalRecord>,
    private readonly feishu: FeishuApprovalService,
    private readonly approvalService: ApprovalService,
  ) {}

  @Cron('*/3 * * * *')
  async pollPendingApprovals() {
    const pending = await this.repo.find({ where: { status: 'pending' } });
    for (const record of pending) {
      try {
        const res = await this.feishu.getApprovalInstance(
          record.feishuInstanceCode,
        );
        if (res?.data?.status) {
          await this.approvalService.handleCallback(record.feishuInstanceCode, {
            event: {
              status: res.data.status,
              instance_code: record.feishuInstanceCode,
            },
          });
        }
      } catch (e: any) {
        this.logger.error(
          `Poll failed for ${record.feishuInstanceCode}`,
          e.message,
        );
      }
    }
  }
}
