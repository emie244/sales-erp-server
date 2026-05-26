import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalHandler } from '../../approvals/approval-handler.interface';
import { ApprovalRecord } from '../../approvals/entities/approval-record.entity';
import {
  PrepaymentRecord,
  PrepaymentStatus,
} from '../entities/prepayment-record.entity';
import { Customer } from '../../customers/entities/customer.entity';

@Injectable()
export class PrepaymentApprovalHandler implements ApprovalHandler {
  private readonly logger = new Logger(PrepaymentApprovalHandler.name);

  constructor(
    @InjectRepository(PrepaymentRecord)
    private readonly prepaymentRepo: Repository<PrepaymentRecord>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async buildForm(_ctx: unknown): Promise<unknown> {
    throw new Error('PrepaymentApprovalHandler does not build forms directly');
  }

  async onSubmitted(_record: ApprovalRecord): Promise<void> {
    // Prepayment status already set to PENDING by PrepaymentsService
  }

  async onApproved(record: ApprovalRecord): Promise<void> {
    const prepayment = await this.prepaymentRepo.findOne({
      where: { id: record.prepaymentRecordId },
      relations: ['customer'],
    });
    if (!prepayment) return;

    prepayment.status = PrepaymentStatus.APPROVED;
    if (prepayment.customer) {
      prepayment.customer.prepaymentBalance =
        Number(prepayment.customer.prepaymentBalance || 0) +
        Number(prepayment.amount || 0);
      await this.customerRepo.save(prepayment.customer);
    }
    await this.prepaymentRepo.save(prepayment);

    this.logger.log(`Prepayment ${prepayment.id} approved`);
  }

  async onRejected(record: ApprovalRecord): Promise<void> {
    const prepayment = await this.prepaymentRepo.findOneBy({
      id: record.prepaymentRecordId,
    });
    if (!prepayment) return;

    prepayment.status = PrepaymentStatus.REJECTED;
    await this.prepaymentRepo.save(prepayment);

    this.logger.log(`Prepayment ${prepayment.id} rejected`);
  }

  async onCancelled(record: ApprovalRecord): Promise<void> {
    const prepayment = await this.prepaymentRepo.findOne({
      where: { id: record.prepaymentRecordId },
      relations: ['customer'],
    });
    if (!prepayment) return;

    const wasApproved = prepayment.status === PrepaymentStatus.APPROVED;
    prepayment.status = PrepaymentStatus.PENDING;
    prepayment.approvalInstanceCode = null;

    if (wasApproved && prepayment.customer) {
      prepayment.customer.prepaymentBalance = Math.max(
        0,
        Number(prepayment.customer.prepaymentBalance || 0) -
          Number(prepayment.amount || 0),
      );
      await this.customerRepo.save(prepayment.customer);
    }

    await this.prepaymentRepo.save(prepayment);
    this.logger.log(`Prepayment ${prepayment.id} cancelled`);
  }
}
