import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SalesOrder, SalesOrderStatus } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { ProductsService } from '../products/products.service';
import { ApprovalService } from '../approvals/approval.service';
import { Customer } from '../customers/entities/customer.entity';
import {
  PaymentRecord,
  PaymentType,
} from '../payments/entities/payment-record.entity';
import {
  ApprovalRecord,
  ApprovalType,
} from '../approvals/entities/approval-record.entity';
import { DeliveryOrder } from '../deliveries/entities/delivery-order.entity';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    @InjectRepository(SalesOrderItem)
    private readonly itemRepo: Repository<SalesOrderItem>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRepo: Repository<PaymentRecord>,
    @InjectRepository(ApprovalRecord)
    private readonly approvalRepo: Repository<ApprovalRecord>,
    @InjectRepository(DeliveryOrder)
    private readonly deliveryRepo: Repository<DeliveryOrder>,
    private readonly productsService: ProductsService,
    private readonly approvalService: ApprovalService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateSalesOrderDto, creatorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(SalesOrderItem);
      const orderRepo = manager.getRepository(SalesOrder);

      let totalAmount = 0;
      const items: SalesOrderItem[] = [];

      for (const itemDto of dto.items || []) {
        const sku = await this.productsService.findSkuById(itemDto.skuId);
        if (!sku) throw new NotFoundException(`SKU ${itemDto.skuId} not found`);
        if (!sku.product) {
          throw new NotFoundException(
            `Product for SKU ${itemDto.skuId} not found`,
          );
        }

        const lineAmount =
          itemDto.qty * itemDto.unitPrice - (itemDto.discountAmount || 0);
        totalAmount += lineAmount;

        items.push(
          itemRepo.create({
            productId: itemDto.productId || sku.product.id,
            skuId: itemDto.skuId,
            jstSkuId: sku.jstSkuId || undefined,
            productName: sku.product.name || '',
            skuName: sku.skuName || sku.skuCode || '',
            qty: itemDto.qty,
            unitPrice: itemDto.unitPrice,
            discountAmount: itemDto.discountAmount || 0,
            lineAmount,
          }),
        );
      }

      const order = orderRepo.create({
        customerId: dto.customerId,
        type: dto.type,
        signerId: dto.signerId,
        creatorId,
        totalAmount,
        discountAmount: 0,
        payAmount: totalAmount,
        remark: dto.remark,
        attachments: dto.attachments || [],
        consignee: dto.consignee,
        consigneePhone: dto.consigneePhone,
        consigneeAddress: dto.consigneeAddress,
        status: SalesOrderStatus.DRAFT,
        items,
      });

      return orderRepo.save(order);
    });
  }

  async findAll(page: number = 1, pageSize: number = 20) {
    const [data, total] = await this.orderRepo.findAndCount({
      relations: ['customer', 'items', 'signer'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, pageSize };
  }

  async findOne(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['customer', 'items', 'creator', 'signer'],
    });
    if (!order) throw new NotFoundException('Sales order not found');

    // 查询关联的审批记录
    const approvalRecords = await this.approvalRepo.find({
      where: {
        salesOrderId: id,
        type: ApprovalType.SALES_ORDER,
      },
      order: { createdAt: 'DESC' },
    });

    // 查询关联的发货单
    const deliveryOrders = await this.deliveryRepo.find({
      where: { salesOrderId: id },
      order: { createdAt: 'DESC' },
    });

    return {
      ...order,
      approvalRecords,
      deliveryOrders,
    };
  }

  async submit(
    orderId: string,
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['customer', 'items', 'signer'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== SalesOrderStatus.DRAFT) {
      throw new BadRequestException('Only draft order can be submitted');
    }

    await this.approvalService.submitForApproval(
      order,
      feishuUserId,
      approvalDefCode,
      feishuUserIdType,
    );
    order.status = SalesOrderStatus.PENDING_APPROVAL;
    return this.orderRepo.save(order);
  }

  async submitCollectionForApproval(
    orderId: string,
    dto: CreateCollectionDto,
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['customer'],
    });
    if (!order) throw new NotFoundException('Order not found');

    // 检查订单状态
    if (!['approved', 'synced_jst', 'shipped'].includes(order.status)) {
      throw new BadRequestException('订单状态不允许回款');
    }

    const prepaymentDeducted = dto.prepaymentDeducted || 0;
    const totalCollection = dto.amount + prepaymentDeducted;

    // 检查是否超额回款
    const remainingAmount =
      order.payAmount - order.collectedAmount - order.prepaymentDeducted;
    if (totalCollection > remainingAmount + 0.01) {
      throw new BadRequestException(
        `回款金额超过剩余应收款。剩余应收: ¥${remainingAmount.toFixed(2)}`,
      );
    }

    // 检查预付款余额
    if (prepaymentDeducted > 0 && order.customer) {
      if (order.customer.prepaymentBalance < prepaymentDeducted) {
        throw new BadRequestException('客户预付款余额不足');
      }
    }

    // 提交回款审批
    await this.approvalService.submitCollectionForApproval(
      order,
      {
        amount: dto.amount,
        prepaymentDeducted,
        method: dto.method,
        remark: dto.remark,
        prepaymentRecordId: dto.prepaymentRecordId,
      },
      feishuUserId,
      approvalDefCode,
      feishuUserIdType,
    );

    // 更新订单状态为审批中
    order.status = SalesOrderStatus.PENDING_APPROVAL;
    return this.orderRepo.save(order);
  }

  async updateOrder(orderId: string, dto: UpdateSalesOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(SalesOrder);
      const itemRepo = manager.getRepository(SalesOrderItem);

      const order = await orderRepo.findOne({
        where: { id: orderId },
        relations: ['items'],
      });
      if (!order) throw new NotFoundException('Order not found');

      // 草稿和已驳回状态的订单可以编辑
      if (
        ![SalesOrderStatus.DRAFT, SalesOrderStatus.REJECTED].includes(
          order.status,
        )
      ) {
        throw new BadRequestException('只有草稿或已驳回的订单可以编辑');
      }

      // 更新订单信息
      if (dto.customerId) order.customerId = dto.customerId;
      if (dto.signerId !== undefined) order.signerId = dto.signerId;
      if (dto.remark !== undefined) order.remark = dto.remark;
      if (dto.consignee !== undefined) order.consignee = dto.consignee;
      if (dto.consigneePhone !== undefined)
        order.consigneePhone = dto.consigneePhone;
      if (dto.consigneeAddress !== undefined)
        order.consigneeAddress = dto.consigneeAddress;

      // 更新商品明细
      if (dto.items) {
        // 删除旧明细
        if (order.items) {
          await itemRepo.remove(order.items);
        }

        // 创建新明细
        let totalAmount = 0;
        const items: SalesOrderItem[] = [];

        for (const itemDto of dto.items) {
          const sku = await this.productsService.findSkuById(itemDto.skuId);
          if (!sku)
            throw new NotFoundException(`SKU ${itemDto.skuId} not found`);
          if (!sku.product) {
            throw new NotFoundException(
              `Product for SKU ${itemDto.skuId} not found`,
            );
          }

          const lineAmount =
            itemDto.qty * itemDto.unitPrice - (itemDto.discountAmount || 0);
          totalAmount += lineAmount;

          items.push(
            itemRepo.create({
              productId: itemDto.productId || sku.product.id,
              skuId: itemDto.skuId,
              jstSkuId: sku.jstSkuId || undefined,
              productName: sku.product.name || '',
              skuName: sku.skuName || sku.skuCode || '',
              qty: itemDto.qty,
              unitPrice: itemDto.unitPrice,
              discountAmount: itemDto.discountAmount || 0,
              lineAmount,
            }),
          );
        }

        order.totalAmount = totalAmount;
        order.payAmount = totalAmount;
        order.items = items;
      }

      // 更新为草稿状态，可以重新提交审批
      order.status = SalesOrderStatus.DRAFT;
      return orderRepo.save(order);
    });
  }

  async updateCollection(orderId: string, dto: CreateCollectionDto) {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');

    // 只有驳回状态且有待审批回款数据的订单可以编辑回款
    if (order.status !== SalesOrderStatus.REJECTED || !order.collectionData) {
      throw new BadRequestException('订单状态不允许编辑回款信息');
    }

    // 更新回款数据
    const prepaymentDeducted = dto.prepaymentDeducted || 0;
    const totalCollection = dto.amount + prepaymentDeducted;

    // 检查是否超额回款
    const remainingAmount =
      order.payAmount - order.collectedAmount - order.prepaymentDeducted;
    if (totalCollection > remainingAmount + 0.01) {
      throw new BadRequestException(
        `回款金额超过剩余应收款。剩余应收: ¥${remainingAmount.toFixed(2)}`,
      );
    }

    order.collectionData = {
      amount: dto.amount,
      prepaymentDeducted,
      method: dto.method,
      remark: dto.remark,
      prepaymentRecordId: dto.prepaymentRecordId,
    };

    return this.orderRepo.save(order);
  }
}
