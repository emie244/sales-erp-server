import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrepaymentRecord } from './entities/prepayment-record.entity';
import { PrepaymentsController } from './prepayments.controller';
import { PrepaymentsService } from './prepayments.service';
import { ApprovalsModule } from '../approvals/approvals.module';
import { PrepaymentApprovalHandler } from './handlers/prepayment-approval.handler';
import { ApprovalHandlerRegistry } from '../approvals/approval-handler.registry';
import { Customer } from '../customers/entities/customer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrepaymentRecord, Customer]),
    ApprovalsModule,
  ],
  controllers: [PrepaymentsController],
  providers: [PrepaymentsService, PrepaymentApprovalHandler],
  exports: [PrepaymentsService],
})
export class PrepaymentsModule implements OnModuleInit {
  constructor(
    private readonly registry: ApprovalHandlerRegistry,
    private readonly handler: PrepaymentApprovalHandler,
  ) {}

  onModuleInit() {
    this.registry.register('prepayment', this.handler);
  }
}
