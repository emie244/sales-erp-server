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

  @Cron('*/10 * * * * *')
  async pollPendingApprovals() {
    // 轮询 pending 和 approved 状态的审批：
    // - pending: 检查是否已通过/驳回/撤销
    // - approved: 检查是否被撤销（REVERTED）
    const records = await this.repo.find({
      where: [{ status: 'pending' }, { status: 'approved' }],
    });
    for (const record of records) {
      try {
        const res = await this.feishu.getApprovalInstance(
          record.feishuInstanceCode,
        );
        const r = res as Record<string, unknown>;
        const data = r?.data as Record<string, unknown>;
        if (data?.status) {
          // 飞书已批准但被撤销的实例，status 仍是 APPROVED，
          // 但 reverted 字段为 true
          const rawStatus = data.reverted === true ? 'REVERTED' : data.status;
          await this.approvalService.handleCallback(record.feishuInstanceCode, {
            event: {
              status: rawStatus,
              instance_code: record.feishuInstanceCode,
            },
          });
        }
      } catch (e: unknown) {
        this.logger.error(
          `Poll failed for ${record.feishuInstanceCode}`,
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  }
}
