import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PrepaymentRecord,
  PrepaymentStatus,
} from './entities/prepayment-record.entity';
import { CreatePrepaymentDto } from './dto/create-prepayment.dto';
import { UpdatePrepaymentDto } from './dto/update-prepayment.dto';

@Injectable()
export class PrepaymentsService {
  constructor(
    @InjectRepository(PrepaymentRecord)
    private readonly prepaymentRepo: Repository<PrepaymentRecord>,
  ) {}

  async create(dto: CreatePrepaymentDto, createdBy: string) {
    const prepayment = this.prepaymentRepo.create({
      ...dto,
      status: PrepaymentStatus.PENDING,
      createdBy,
    });
    return this.prepaymentRepo.save(prepayment);
  }

  async findAll(customerId?: string, status?: string) {
    const query = this.prepaymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.customer', 'customer')
      .orderBy('p.createdAt', 'DESC');

    if (customerId) {
      query.andWhere('p.customerId = :customerId', { customerId });
    }

    if (status) {
      query.andWhere('p.status = :status', { status });
    }

    return query.getMany();
  }

  async findOne(id: string) {
    const prepayment = await this.prepaymentRepo.findOne({
      where: { id },
      relations: ['customer'],
    });
    if (!prepayment) throw new NotFoundException('Prepayment not found');
    return prepayment;
  }

  async update(id: string, dto: UpdatePrepaymentDto) {
    const prepayment = await this.findOne(id);
    if (dto.customerId !== undefined) prepayment.customerId = dto.customerId;
    if (dto.amount !== undefined) prepayment.amount = dto.amount;
    if (dto.paymentMethod !== undefined)
      prepayment.paymentMethod = dto.paymentMethod;
    if (dto.paymentDate !== undefined) prepayment.paymentDate = dto.paymentDate;
    if (dto.receiptUrl !== undefined) prepayment.receiptUrl = dto.receiptUrl;
    if (dto.remark !== undefined) prepayment.remark = dto.remark;
    return this.prepaymentRepo.save(prepayment);
  }

  async updateStatus(
    id: string,
    status: PrepaymentStatus,
    approvalInstanceCode?: string,
  ) {
    const prepayment = await this.findOne(id);
    prepayment.status = status;
    if (approvalInstanceCode !== undefined) {
      prepayment.approvalInstanceCode = approvalInstanceCode;
    }
    return this.prepaymentRepo.save(prepayment);
  }

  async remove(id: string) {
    const prepayment = await this.findOne(id);
    if (prepayment.status !== PrepaymentStatus.PENDING) {
      throw new Error('Only pending prepayments can be deleted');
    }
    return this.prepaymentRepo.remove(prepayment);
  }
}
