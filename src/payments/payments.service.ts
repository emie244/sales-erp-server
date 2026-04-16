import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentRecord } from './entities/payment-record.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentRecord)
    private readonly repo: Repository<PaymentRecord>,
  ) {}

  create(dto: CreatePaymentDto) {
    return this.repo.save(
      this.repo.create({
        ...dto,
        receivedAt: new Date(dto.receivedAt),
      }),
    );
  }

  findByOrder(salesOrderId: string) {
    return this.repo.find({
      where: { salesOrderId },
      order: { receivedAt: 'DESC' },
    });
  }
}
