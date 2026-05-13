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

  /**
   * 高频轮询 approved 状态的审批：
   * 检测通过后撤销（REVERTED）。
   * 飞书对已批准但被撤销的实例，status 仍是 APPROVED，
   * 需要通过 reverted 字段判断。
   */
  @Cron('*/10 * * * * *')
  async pollApprovedApprovals() {
    const records = await this.repo.find({
      where: { status: 'approved' },
    });
    for (const record of records) {
      try {
        const res = await this.feishu.getApprovalInstance(
          record.feishuInstanceCode,
        );
        const r = res as Record<string, unknown>;
        const data = r?.data as Record<string, unknown>;
        if (data?.status) {
          const rawStatus =
            data.reverted === true ? 'REVERTED' : (data.status as string);
          const newStatus = this.parseStatus(rawStatus);
          // 状态无变化时跳过，避免重复写入状态变更记录
          if (newStatus === record.status) {
            continue;
          }
          await this.approvalService.handleCallback(
            record.feishuInstanceCode,
            {
              event: {
                status: rawStatus,
                instance_code: record.feishuInstanceCode,
              },
            },
          );
        }
      } catch (e: unknown) {
        this.logger.error(
          `Poll approved failed for ${record.feishuInstanceCode}`,
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  }

  /**
   * 低频轮询 pending 状态的审批：
   * 兜底机制，防止 WebSocket 长连接断线或丢事件导致
   * APPROVED/REJECTED/CANCELLED 状态未及时同步。
   */
  @Cron('*/10 * * * * *')
  async pollPendingApprovals() {
    const records = await this.repo.find({
      where: { status: 'pending' },
    });
    for (const record of records) {
      try {
        const res = await this.feishu.getApprovalInstance(
          record.feishuInstanceCode,
        );
        const r = res as Record<string, unknown>;
        const data = r?.data as Record<string, unknown>;
        if (data?.status) {
          const rawStatus =
            data.reverted === true ? 'REVERTED' : (data.status as string);
          const newStatus = this.parseStatus(rawStatus);
          // 状态无变化时跳过，避免重复写入状态变更记录
          if (newStatus === record.status) {
            continue;
          }
          await this.approvalService.handleCallback(
            record.feishuInstanceCode,
            {
              event: {
                status: rawStatus,
                instance_code: record.feishuInstanceCode,
              },
            },
          );
        }
      } catch (e: unknown) {
        this.logger.error(
          `Poll pending failed for ${record.feishuInstanceCode}`,
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  }

  private parseStatus(
    raw: string,
  ): 'pending' | 'approved' | 'rejected' | 'transferred' | 'cancelled' | 'reverted' {
    const map: Record<string, ApprovalRecord['status']> = {
      PENDING: 'pending',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      TRANSFERRED: 'transferred',
      CANCELLED: 'cancelled',
      CANCELED: 'cancelled',
      REVERTED: 'reverted',
    };
    return map[raw] || 'pending';
  }
}
