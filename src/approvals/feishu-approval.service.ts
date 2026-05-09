import { Injectable, BadRequestException } from '@nestjs/common';
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
    const data = (await res.json()) as Record<string, unknown>;
    if (data.code !== 0) throw new Error(`Feishu token error: ${data.msg as string}`);
    return data.tenant_access_token as string;
  }

  async getApprovalDefinition(approvalCode: string): Promise<unknown[]> {
    const token = await this.getTenantAccessToken();
    const res = await fetch(
      `https://open.feishu.cn/open-apis/approval/v4/approvals/${encodeURIComponent(approvalCode)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = (await res.json()) as Record<string, unknown>;
    if (data.code !== 0) {
      throw new Error(`Feishu getApprovalDefinition error: ${data.msg}`);
    }
    try {
      const d = data.data as Record<string, unknown>;
      return JSON.parse((d?.form as string) || '[]');
    } catch {
      return [];
    }
  }

  async createApprovalInstance(params: {
    approvalCode: string;
    userId: string;
    userIdType?: string;
    form: unknown[];
  }): Promise<string> {
    const token = await this.getTenantAccessToken();
    const userIdType = params.userIdType || 'user_id';
    if (userIdType !== 'user_id') {
      throw new BadRequestException(
        `飞书审批必须使用 user_id（员工编号），当前传入的是 ${userIdType}。请联系管理员在「系统管理-用户管理」中补充飞书 User ID。`,
      );
    }
    const res = await fetch(
      `https://open.feishu.cn/open-apis/approval/v4/instances?user_id_type=${userIdType}`,
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
    const data = (await res.json()) as Record<string, unknown>;
    if (data.code !== 0) {
      console.error(
        `Feishu approval create failed: approvalCode=${params.approvalCode}, userId=${params.userId}, userIdType=${userIdType}, form=${JSON.stringify(params.form)}, response=${JSON.stringify(data)}`,
      );
      throw new Error(`Feishu approval error: ${data.msg as string}`);
    }
    return (data.data as Record<string, unknown>)?.instance_code as string;
  }

  async uploadFile(
    buffer: Buffer,
    filename: string,
    type: 'attachment' | 'image' = 'attachment',
  ): Promise<string> {
    const token = await this.getTenantAccessToken();

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)]), filename);
    form.append('name', filename);
    form.append('type', type);

    const res = await fetch(
      'https://open.feishu.cn/open-apis/approval/v4/files/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      },
    );
    const data = (await res.json()) as Record<string, unknown>;
    if (data.code !== 0) {
      throw new Error(`Feishu file upload error: ${data.msg as string}`);
    }
    const d = data.data as Record<string, unknown>;
    return (d?.urls_detail as Record<string, unknown>[])?.[0]?.code as string || (d?.file_token as string) || '';
  }

  async getApprovalInstance(instanceCode: string): Promise<unknown> {
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
