import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
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
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { ApprovalRecord } from '../approvals/entities/approval-record.entity';
import { DeliveryOrder } from '../deliveries/entities/delivery-order.entity';
import { JushuitanService } from '../integrations/jushuitan.service';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);
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
    private readonly jstService: JushuitanService,
    private readonly dataSource: DataSource,
  ) {}

  private calculateCommissionRate(
    launchDate: Date | null,
    lifecycleStage: string | null,
    orderDate: Date,
  ): number {
    // 优先使用显式设置的生命周期阶段
    if (lifecycleStage === 'new') return 0.03;
    if (lifecycleStage === 'growth') return 0.02;
    if (
      lifecycleStage === 'mature' ||
      lifecycleStage === 'decline' ||
      lifecycleStage === 'discontinued'
    )
      return 0.01;
    // 未设置阶段时，根据 launchDate 时间差推断
    if (!launchDate) return 0.01;
    const diffMs = orderDate.getTime() - new Date(launchDate).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 90) return 0.03;
    if (diffDays <= 180) return 0.02;
    return 0.01;
  }

  async create(dto: CreateSalesOrderDto, creatorId: string, tenantId?: string) {
    return this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(SalesOrderItem);
      const orderRepo = manager.getRepository(SalesOrder);

      let totalAmount = 0;
      const items: SalesOrderItem[] = [];

      for (const itemDto of dto.items || []) {
        const sku = await this.productsService.findSkuById(
          itemDto.skuId,
          tenantId,
        );
        if (!sku) throw new NotFoundException(`SKU ${itemDto.skuId} not found`);
        if (!sku.product) {
          throw new NotFoundException(
            `Product for SKU ${itemDto.skuId} not found`,
          );
        }

        const lineAmount =
          itemDto.qty * itemDto.unitPrice - (itemDto.discountAmount || 0);
        totalAmount += lineAmount;

        const commissionRate = this.calculateCommissionRate(
          sku.product?.launchDate || null,
          sku.product?.lifecycleStage || null,
          new Date(),
        );
        const commissionAmount = lineAmount * commissionRate;

        items.push(
          itemRepo.create({
            productId: itemDto.productId || sku.product.id,
            skuId: itemDto.skuId,
            jstSkuId: sku.jstSkuId || undefined,
            skuCode: sku.skuCode || undefined,
            productName: sku.product.name || '',
            skuName: sku.skuName || sku.skuCode || '',
            qty: itemDto.qty,
            unitPrice: itemDto.unitPrice,
            discountAmount: itemDto.discountAmount || 0,
            lineAmount,
            commissionRate,
            commissionAmount,
          }),
        );
      }

      const order = orderRepo.create({
        customerId: dto.customerId,
        type: dto.type,
        signerId: dto.signerId,
        creatorId,
        tenantId,
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

  async findAll(
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      status?: string;
      type?: string;
      customerId?: string;
      creatorId?: string;
      signerId?: string;
      keyword?: string;
      dateFrom?: string;
      dateTo?: string;
      minAmount?: number;
      maxAmount?: number;
      tenantId?: string;
    },
  ) {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.signer', 'signer')
      .leftJoinAndSelect('order.items', 'items')
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (filters?.status) {
      const statuses = filters.status.split(',').filter(Boolean);
      if (statuses.length === 1) {
        qb.andWhere('order.status = :status', { status: statuses[0] });
      } else if (statuses.length > 1) {
        qb.andWhere('order.status IN (:...statuses)', { statuses });
      }
    }

    if (filters?.type) {
      qb.andWhere('order.type = :type', { type: filters.type });
    }

    if (filters?.customerId) {
      qb.andWhere('order.customerId = :customerId', {
        customerId: filters.customerId,
      });
    }

    if (filters?.creatorId) {
      qb.andWhere('order.creatorId = :creatorId', {
        creatorId: filters.creatorId,
      });
    }

    if (filters?.signerId) {
      qb.andWhere('order.signerId = :signerId', { signerId: filters.signerId });
    }

    if (filters?.keyword) {
      const keyword = `%${filters.keyword}%`;
      qb.andWhere(
        `(order.remark LIKE :keyword OR order.consignee LIKE :keyword OR order.expressNo LIKE :keyword OR customer.name LIKE :keyword)`,
        { keyword },
      );
    }

    if (filters?.dateFrom) {
      qb.andWhere('order.createdAt >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    }

    if (filters?.dateTo) {
      qb.andWhere('order.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }

    if (filters?.minAmount !== undefined) {
      qb.andWhere('order.totalAmount >= :minAmount', {
        minAmount: filters.minAmount,
      });
    }

    if (filters?.maxAmount !== undefined) {
      qb.andWhere('order.totalAmount <= :maxAmount', {
        maxAmount: filters.maxAmount,
      });
    }

    if (filters?.tenantId) {
      qb.andWhere('order.tenantId = :tenantId', { tenantId: filters.tenantId });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async findOne(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['customer', 'items', 'creator', 'signer'],
    });
    if (!order) throw new NotFoundException('Sales order not found');

    // 查询关联的审批记录（包含销售订单审批和回款审批）
    const approvalRecords = await this.approvalRepo.find({
      where: {
        salesOrderId: id,
      },
      order: { createdAt: 'DESC' },
    });

    // 查询关联的发货单
    const deliveryOrders = await this.deliveryRepo.find({
      where: { salesOrderId: id },
      order: { createdAt: 'DESC' },
    });

    // 查询关联的回款记录
    const paymentRecords = await this.paymentRepo.find({
      where: { salesOrderId: id },
      order: { receivedAt: 'DESC' },
    });

    return {
      ...order,
      approvalRecords,
      deliveryOrders,
      paymentRecords,
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

  async batchSubmit(
    ids: string[],
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ) {
    const results = {
      success: [] as string[],
      failed: [] as { id: string; reason: string }[],
    };

    for (const id of ids) {
      try {
        await this.submit(id, feishuUserId, approvalDefCode, feishuUserIdType);
        results.success.push(id);
      } catch (err: unknown) {
        results.failed.push({
          id,
          reason: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  async batchPushJushuitan(ids: string[]) {
    const results = {
      success: [] as { id: string; jushuitanOrderId: string | null }[],
      failed: [] as { id: string; reason: string }[],
    };

    for (const id of ids) {
      try {
        const order = await this.orderRepo.findOne({
          where: { id },
          relations: ['items', 'customer', 'signer'],
        });
        if (!order) {
          results.failed.push({ id, reason: 'Order not found' });
          continue;
        }
        if (order.status !== SalesOrderStatus.APPROVED) {
          results.failed.push({
            id,
            reason: 'Only approved orders can be pushed',
          });
          continue;
        }
        if (!order.signer?.jushuitanShopId) {
          results.failed.push({
            id,
            reason: `Signer「${order.signer?.name || '-'}」has no Jushuitan shop ID`,
          });
          continue;
        }

        // 兼容历史订单：补充 skuCode 和 jstSkuId
        const missingCodes: string[] = [];
        for (const item of order.items || []) {
          if (item.skuId) {
            const sku = await this.productsService.findSkuById(item.skuId);
            if (sku) {
              if (!item.skuCode) item.skuCode = sku.skuCode;
              if (!item.jstSkuId) item.jstSkuId = sku.jstSkuId;
            }
          }
          if (!item.jstSkuId) {
            missingCodes.push(item.skuName || item.productName || '未知商品');
          }
        }

        if (missingCodes.length) {
          results.failed.push({
            id,
            reason: `以下商品缺少聚水潭平台编码（jstSkuId），请先在「产品管理」中维护或通过聚水潭同步：${missingCodes.join('、')}`,
          });
          continue;
        }

        const res = await this.jstService.createSalesOrder(order);
        const r = res as Record<string, unknown>;
        const isSuccess = r?.code === 0 || r?.success === true;
        if (isSuccess) {
          order.status = SalesOrderStatus.SYNCED_JST;
          await this.orderRepo.save(order);
          const data = r?.data as Record<string, unknown>;
          const datas = data?.datas as Record<string, unknown>[];
          results.success.push({
            id,
            jushuitanOrderId: (datas?.[0]?.o_id as string) || null,
          });
        } else {
          results.failed.push({
            id,
            reason: (r?.msg as string) || 'Jushuitan push failed',
          });
        }
      } catch (err: unknown) {
        results.failed.push({
          id,
          reason: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  async submitCollectionForApproval(
    orderId: string,
    dto: CreateCollectionDto,
    feishuUserId: string,
    approvalDefCode: string,
    feishuUserIdType?: string,
  ) {
    this.logger.log(
      `submitCollectionForApproval called: orderId=${orderId}, feishuUserId=${feishuUserId}, approvalDefCode=${approvalDefCode}`,
    );

    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['customer', 'items'],
    });
    if (!order) throw new NotFoundException('Order not found');

    // 检查订单状态
    if (!['approved', 'synced_jst', 'shipped'].includes(order.status)) {
      throw new BadRequestException('订单状态不允许回款');
    }

    const records = dto.records || [];
    const totalCollection = records.reduce(
      (sum, r) => sum + (r.amount || 0),
      0,
    );
    const prepaymentDeducted = records
      .filter((r) => r.method === 'prepayment')
      .reduce((sum, r) => sum + (r.amount || 0), 0);

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
    try {
      await this.approvalService.submitCollectionForApproval(
        order,
        {
          records,
          prepaymentDeducted,
        },
        feishuUserId,
        approvalDefCode,
        feishuUserIdType,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `ApprovalService.submitCollectionForApproval failed for order=${orderId}: ${msg}`,
      );
      throw err;
    }

    // 更新订单状态为审批中（先保存原状态）
    const originalStatus = order.status;
    order.status = SalesOrderStatus.PENDING_APPROVAL;
    order.collectionData = {
      records,
      prepaymentDeducted,
      originalStatus,
    } as SalesOrder['collectionData'];
    const saved = await this.orderRepo.save(order);
    this.logger.log(
      `Collection approval submitted for order=${orderId}, status set to pending_approval`,
    );
    return saved;
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

      // 草稿、已驳回、已批准的订单可以编辑；已推送聚水潭后不可编辑
      if (
        ![
          SalesOrderStatus.DRAFT,
          SalesOrderStatus.REJECTED,
          SalesOrderStatus.APPROVED,
        ].includes(order.status)
      ) {
        throw new BadRequestException('只有草稿、已驳回或已批准的订单可以编辑');
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

          const commissionRate = this.calculateCommissionRate(
            sku.product?.launchDate || null,
            sku.product?.lifecycleStage || null,
            order.createdAt,
          );
          const commissionAmount = lineAmount * commissionRate;

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
              commissionRate,
              commissionAmount,
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

    const records = dto.records || [];
    const totalCollection = records.reduce(
      (sum, r) => sum + (r.amount || 0),
      0,
    );

    // 检查是否超额回款
    const remainingAmount =
      order.payAmount - order.collectedAmount - order.prepaymentDeducted;
    if (totalCollection > remainingAmount + 0.01) {
      throw new BadRequestException(
        `回款金额超过剩余应收款。剩余应收: ¥${remainingAmount.toFixed(2)}`,
      );
    }

    order.collectionData = {
      ...order.collectionData,
      records,
    };

    return this.orderRepo.save(order);
  }
}
