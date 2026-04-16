import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryOrder } from './entities/delivery-order.entity';

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(DeliveryOrder)
    private readonly repo: Repository<DeliveryOrder>,
  ) {}

  findBySalesOrder(salesOrderId: string) {
    return this.repo.find({
      where: { salesOrderId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }
}
