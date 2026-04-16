import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalRecord } from './entities/approval-record.entity';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { FeishuApprovalService } from './feishu-approval.service';
import { ApprovalService } from './approval.service';
import { ApprovalsController } from './approvals.controller';
import { FeishuWsService } from './feishu-ws.service';
import { ApprovalPollingService } from './approval-polling.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalRecord, SalesOrder])],
  controllers: [ApprovalsController],
  providers: [
    FeishuApprovalService,
    ApprovalService,
    FeishuWsService,
    ApprovalPollingService,
  ],
  exports: [ApprovalService],
})
export class ApprovalsModule {}
