import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FeishuApprovalService {
  private appId: string;
  private appSecret: string;

  constructor(private config: ConfigService) {
    this.appId = this.config.get<string>('FEISHU_APP_ID') || '';
    this.appSecret = this.config.get<string>('FEISHU_APP_SECRET') || '';
  }

  async getTenantAccessToken(): Promise<string> {
    const res = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: this.appId,
          app_secret: this.appSecret,
        }),
      },
    );
    const data: any = await res.json();
    if (data.code !== 0) throw new Error(`Feishu token error: ${data.msg}`);
    return data.tenant_access_token;
  }

  async createApprovalInstance(params: {
    approvalCode: string;
    userId: string;
    form: Record<string, any>;
  }): Promise<string> {
    const token = await this.getTenantAccessToken();
    const res = await fetch(
      'https://open.feishu.cn/open-apis/approval/v4/instances',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approval_code: params.approvalCode,
          user_id: params.userId,
          form: JSON.stringify(params.form),
        }),
      },
    );
    const data: any = await res.json();
    if (data.code !== 0) throw new Error(`Feishu approval error: ${data.msg}`);
    return data.data.instance_code;
  }

  async getApprovalInstance(instanceCode: string): Promise<any> {
    const token = await this.getTenantAccessToken();
    const res = await fetch(
      `https://open.feishu.cn/open-apis/approval/v4/instances/${instanceCode}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return res.json();
  }
}
