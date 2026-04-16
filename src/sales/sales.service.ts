import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrder, SalesOrderStatus } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { ProductsService } from '../products/products.service';
import { ApprovalService } from '../approvals/approval.service';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    @InjectRepository(SalesOrderItem)
    private readonly itemRepo: Repository<SalesOrderItem>,
    private readonly productsService: ProductsService,
    private readonly approvalService: ApprovalService,
  ) {}

  async create(dto: CreateSalesOrderDto, creatorId: string) {
    let totalAmount = 0;
    const items: SalesOrderItem[] = [];

    for (const itemDto of dto.items) {
      const sku = await this.productsService.findSkuById(itemDto.skuId);
      if (!sku) throw new NotFoundException(`SKU ${itemDto.skuId} not found`);

      const lineAmount =
        itemDto.qty * itemDto.unitPrice - (itemDto.discountAmount || 0);
      totalAmount += lineAmount;

      items.push(
        this.itemRepo.create({
          skuId: itemDto.skuId,
          skuName: sku.skuCode,
          qty: itemDto.qty,
          unitPrice: itemDto.unitPrice,
          discountAmount: itemDto.discountAmount || 0,
          lineAmount,
        }),
      );
    }

    const order = this.orderRepo.create({
      customerId: dto.customerId,
      type: dto.type,
      creatorId,
      totalAmount,
      discountAmount: 0,
      payAmount: totalAmount,
      remark: dto.remark,
      status: SalesOrderStatus.DRAFT,
      items,
    });

    return this.orderRepo.save(order);
  }

  findAll() {
    return this.orderRepo.find({
      relations: ['customer', 'items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['customer', 'items', 'creator'],
    });
    if (!order) throw new NotFoundException('Sales order not found');
    return order;
  }

  async submit(orderId: string, feishuUserId: string, approvalDefCode: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['customer', 'items'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== SalesOrderStatus.DRAFT) {
      throw new BadRequestException('Only draft order can be submitted');
    }

    await this.approvalService.submitForApproval(
      order,
      feishuUserId,
      approvalDefCode,
    );
    order.status = SalesOrderStatus.PENDING_APPROVAL;
    return this.orderRepo.save(order);
  }
}
