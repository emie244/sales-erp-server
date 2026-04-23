import { Injectable } from '@nestjs/common';
import { FeishuApprovalService } from '../approvals/feishu-approval.service';

@Injectable()
export class FeishuMessageService {
  constructor(private readonly feishuApproval: FeishuApprovalService) {}

  async sendTextMessage(openId: string, text: string) {
    try {
      const token = await this.feishuApproval.getTenantAccessToken();
      const res = await fetch(
        'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            receive_id: openId,
            msg_type: 'text',
            content: JSON.stringify({ text }),
          }),
        },
      );
      const data: any = await res.json();
      if (data.code !== 0) {
        console.error(`Feishu message send failed: ${data.msg}`, { openId, text });
      }
      return data;
    } catch (err) {
      console.error('Feishu message send error:', err);
      return null;
    }
  }

  async notifyOrderApproved(openId: string, orderNo: string, amount: number) {
    const text = `您的销售订单已审批通过！\n订单号：${orderNo}\n金额：¥${amount.toFixed(2)}\n系统将自动推送至聚水潭ERP。`;
    return this.sendTextMessage(openId, text);
  }

  async notifyOrderRejected(openId: string, orderNo: string, reason?: string) {
    const text = `您的销售订单已被驳回。\n订单号：${orderNo}${reason ? `\n驳回原因：${reason}` : ''}\n请修改后重新提交。`;
    return this.sendTextMessage(openId, text);
  }

  async notifyCollectionApproved(openId: string, orderNo: string, amount: number) {
    const text = `您的回款记录已审批通过！\n订单号：${orderNo}\n回款金额：¥${amount.toFixed(2)}`;
    return this.sendTextMessage(openId, text);
  }

  async notifyOrderShipped(openId: string, orderNo: string, expressNo?: string) {
    let text = `您的销售订单已发货！\n订单号：${orderNo}`;
    if (expressNo) {
      text += `\n快递单号：${expressNo}`;
    }
    return this.sendTextMessage(openId, text);
  }
}
