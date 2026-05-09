import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApprovalService } from './approval.service';
import { FeishuWsService } from './feishu-ws.service';
import { Public } from '../auth/public.decorator';
import { Permissions } from '../auth/permissions.decorator';

@Controller()
export class ApprovalsController {
  constructor(
    private readonly service: ApprovalService,
    private readonly wsService: FeishuWsService,
    private readonly config: ConfigService,
  ) {}

  @Get('approvals')
  async findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  @Get('approvals/:instanceCode')
  async findOne(@Param('instanceCode') instanceCode: string) {
    return this.service.findOne(instanceCode);
  }

  @Post('approvals/:instanceCode/approve')
  async approve(@Param('instanceCode') instanceCode: string) {
    return this.service.approve(instanceCode);
  }

  @Post('approvals/:instanceCode/reject')
  async reject(@Param('instanceCode') instanceCode: string) {
    return this.service.reject(instanceCode);
  }

  @Public()
  @Post('webhooks/feishu/approval')
  async handleWebhook(@Body() body: any) {
    // 处理飞书 URL 校验挑战
    if (body?.challenge) {
      return {
        challenge: body.challenge,
        token: body.token,
        type: body.type,
      };
    }

    const instanceCode = body?.event?.instance_code || body?.instance_code;
    if (instanceCode) {
      await this.service.handleCallback(instanceCode, body);
    }
    return { message: 'ok' };
  }

  @Permissions('admin:settings')
  @Get('webhooks/feishu/diagnostics')
  async getDiagnostics() {
    const ngrokUrl = this.config.get<string>('NGROK_URL') || '';
    const appId = this.config.get<string>('FEISHU_APP_ID') || '';

    return {
      wsStatus: this.wsService.getStatus(),
      appId: appId ? `${appId.slice(0, 4)}****${appId.slice(-4)}` : '未配置',
      checklist: {
        step1_appPublished: '请在飞书开放平台「版本管理与发布」确认应用已发布',
        step2_appInstalled: '请在飞书管理后台「应用管理」确认应用已安装到企业',
        step3_eventSubscribed:
          '请在「事件订阅」确认已勾选 approval_instance (v1.0)',
        step4_wsMode: '请在「事件订阅」确认推送方式为「长连接」',
        step5_permission: '请在「权限管理」中开通「审批」和「通讯录」相关权限',
      },
      note: '长连接模式下，飞书不会发送 HTTP 回调，所有事件通过 WebSocket 推送。连接成功后如果 5 分钟内无任何事件，属于正常现象（没有事件时不会推送）。',
      fallbackWebhookUrl: ngrokUrl
        ? `${ngrokUrl}/api/v1/webhooks/feishu/approval`
        : null,
    };
  }

  @Permissions('admin:settings')
  @Post('webhooks/feishu/approval/test')
  async testWebhook(
    @Body() body: { instanceCode: string; status: 'approved' | 'rejected' },
  ) {
    const { instanceCode, status } = body;
    if (!instanceCode) {
      return { error: 'instanceCode 必填' };
    }

    const testPayload = {
      event: {
        instance_code: instanceCode,
        status: status === 'approved' ? 'APPROVED' : 'REJECTED',
      },
    };

    try {
      await this.service.handleCallback(instanceCode, testPayload);
      return {
        message: `已模拟触发审批${status === 'approved' ? '通过' : '驳回'}`,
        instanceCode,
        status,
      };
    } catch (err: any) {
      return { error: err.message || '处理失败' };
    }
  }
}
