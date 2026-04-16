import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApprovalService } from './approval.service';

@Controller()
export class ApprovalsController {
  constructor(private readonly service: ApprovalService) {}

  @Post('webhooks/feishu/approval')
  async handleWebhook(@Body() body: any) {
    const instanceCode = body?.event?.instance_code || body?.instance_code;
    if (instanceCode) {
      await this.service.handleCallback(instanceCode, body);
    }
    return { message: 'ok' };
  }

  @Get('approvals/:instanceCode')
  async findOne(@Param('instanceCode') instanceCode: string) {
    return { instanceCode };
  }
}
