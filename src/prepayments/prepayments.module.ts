import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrepaymentRecord } from './entities/prepayment-record.entity';
import { PrepaymentsController } from './prepayments.controller';
import { PrepaymentsService } from './prepayments.service';
import { ApprovalsModule } from '../approvals/approvals.module';

@Module({
  imports: [TypeOrmModule.forFeature([PrepaymentRecord]), ApprovalsModule],
  controllers: [PrepaymentsController],
  providers: [PrepaymentsService],
  exports: [PrepaymentsService],
})
export class PrepaymentsModule {}
