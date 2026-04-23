import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PrepaymentsService } from './prepayments.service';
import { ApprovalService } from '../approvals/approval.service';
import { CreatePrepaymentDto } from './dto/create-prepayment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';


@Controller('prepayments')
@UseGuards(JwtAuthGuard)
export class PrepaymentsController {
  constructor(
    private readonly prepaymentsService: PrepaymentsService,
    private readonly approvalService: ApprovalService,
  ) {}

  @Permissions('prepayment:create')
  @Post()
  create(@Body() dto: CreatePrepaymentDto, @Request() req: any) {
    return this.prepaymentsService.create(dto, req.user?.userId);
  }

  @Permissions('prepayment:view')
  @Get()
  findAll(
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    return this.prepaymentsService.findAll(customerId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prepaymentsService.findOne(id);
  }

  @Post(':id/submit')
  async submitForApproval(
    @Param('id') id: string,
    @Body()
    body: {
      feishuUserId: string;
      approvalDefCode: string;
      feishuUserIdType?: string;
    },
    @Request() req: any,
  ) {
    const prepayment = await this.prepaymentsService.findOne(id);
    return this.approvalService.submitPrepaymentForApproval(
      prepayment,
      body.feishuUserId,
      body.approvalDefCode,
      body.feishuUserIdType,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prepaymentsService.remove(id);
  }
}
