import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApprovalService } from './approval.service';

@Controller()
export class ApprovalsController {
  constructor(private readonly service: ApprovalService) {}

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

  @Post('webhooks/feishu/approval')
  async handleWebhook(@Body() body: any) {
    const instanceCode = body?.event?.instance_code || body?.instance_code;
    if (instanceCode) {
      await this.service.handleCallback(instanceCode, body);
    }
    return { message: 'ok' };
  }
}
