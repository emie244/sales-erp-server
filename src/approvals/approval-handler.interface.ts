import { ApprovalRecord } from './entities/approval-record.entity';
import { EntityManager } from 'typeorm';

export interface ApprovalHandler {
  /** 构建飞书审批表单 */
  buildForm(ctx: unknown): Promise<unknown>;

  /** 审批实例创建后的回调（保存关联实体状态） */
  onSubmitted(record: ApprovalRecord): Promise<void>;

  /** 审批通过 */
  onApproved(record: ApprovalRecord, manager?: EntityManager): Promise<void>;

  /** 审批驳回 */
  onRejected(record: ApprovalRecord, manager?: EntityManager): Promise<void>;

  /** 审批撤销 */
  onCancelled(record: ApprovalRecord, manager?: EntityManager): Promise<void>;
}
