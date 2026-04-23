import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PrepaymentRecord,
  PrepaymentStatus,
} from './entities/prepayment-record.entity';
import { CreatePrepaymentDto } from './dto/create-prepayment.dto';

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

  async updateStatus(
    id: string,
    status: PrepaymentStatus,
    approvalInstanceCode?: string,
  ) {
    const prepayment = await this.findOne(id);
    prepayment.status = status;
    if (approvalInstanceCode) {
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
