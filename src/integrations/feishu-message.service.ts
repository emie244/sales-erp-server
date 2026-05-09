import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FeishuMessageService {
  private readonly logger = new Logger(FeishuMessageService.name);

  constructor(private readonly config: ConfigService) {}

  private async getTenantAccessToken(): Promise<string> {
    const appId = this.config.get<string>('FEISHU_APP_ID') || '';
    const appSecret = this.config.get<string>('FEISHU_APP_SECRET') || '';
    const res = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      },
    );
    const data = (await res.json()) as Record<string, unknown>;
    if (data.code !== 0)
      throw new Error(`Feishu token error: ${data.msg as string}`);
    return data.tenant_access_token as string;
  }

  async sendTextMessage(openId: string, text: string) {
    try {
      const token = await this.getTenantAccessToken();
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
      const data = (await res.json()) as Record<string, unknown>;
      if (data.code !== 0) {
        this.logger.error(`Feishu message send failed: ${data.msg as string}`, {
          openId,
          text,
        });
      }
      return data;
    } catch (err) {
      this.logger.error(
        `Feishu message send error: ${err instanceof Error ? err.message : String(err)}`,
      );
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

  async notifyCollectionApproved(
    openId: string,
    orderNo: string,
    amount: number,
  ) {
    const text = `您的回款记录已审批通过！\n订单号：${orderNo}\n回款金额：¥${amount.toFixed(2)}`;
    return this.sendTextMessage(openId, text);
  }

  async notifyOrderShipped(
    openId: string,
    orderNo: string,
    expressNo?: string,
  ) {
    let text = `您的销售订单已发货！\n订单号：${orderNo}`;
    if (expressNo) {
      text += `\n快递单号：${expressNo}`;
    }
    return this.sendTextMessage(openId, text);
  }
}
