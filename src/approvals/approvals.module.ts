import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ApprovalRecord } from './entities/approval-record.entity';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { PrepaymentRecord } from '../prepayments/entities/prepayment-record.entity';
import { Customer } from '../customers/entities/customer.entity';
import { FeishuApprovalService } from './feishu-approval.service';
import { ApprovalService } from './approval.service';
import { ApprovalFormBuilder } from './approval-form.builder';
import { ApprovalsController } from './approvals.controller';
import { FeishuWsService } from './feishu-ws.service';
import { ApprovalPollingService } from './approval-polling.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalRecord,
      SalesOrder,
      PrepaymentRecord,
      Customer,
    ]),
    BullModule.registerQueue({ name: 'jushuitan-sync' }),
  ],
  controllers: [ApprovalsController],
  providers: [
    FeishuApprovalService,
    ApprovalService,
    ApprovalFormBuilder,
    FeishuWsService,
    ApprovalPollingService,
  ],
  exports: [ApprovalService],
})
export class ApprovalsModule {}
