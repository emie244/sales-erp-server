import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryOrder } from './entities/delivery-order.entity';
import { DeliveryOrderItem } from './entities/delivery-order-item.entity';

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(DeliveryOrder)
    private readonly repo: Repository<DeliveryOrder>,
    @InjectRepository(DeliveryOrderItem)
    private readonly itemRepo: Repository<DeliveryOrderItem>,
  ) {}

  async create(data: {
    salesOrderId: string;
    items: { salesOrderItemId: string; skuId: string; qty: number }[];
    isTransferredToFinance?: boolean;
  }) {
    const order = this.repo.create({
      salesOrderId: data.salesOrderId,
      status: 'pending',
      isTransferredToFinance: data.isTransferredToFinance ?? false,
    });
    const saved = await this.repo.save(order);

    const items = data.items.map((it) =>
      this.itemRepo.create({
        deliveryOrderId: saved.id,
        salesOrderItemId: it.salesOrderItemId,
        skuId: it.skuId,
        qty: it.qty,
      }),
    );
    await this.itemRepo.save(items);

    return saved;
  }

  findBySalesOrder(salesOrderId: string) {
    return this.repo.find({
      where: { salesOrderId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }
}
