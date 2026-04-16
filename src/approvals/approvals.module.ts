import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalRecord } from './entities/approval-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalRecord])],
  exports: [TypeOrmModule],
})
export class ApprovalsModule {}
