import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like } from 'typeorm';
import { ProductionOrder, ProductionOrderStatus } from './entities/production-order.entity';
import { ProductionOrderItem } from './entities/production-order-item.entity';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { CompleteProductionOrderDto } from './dto/complete-production-order.dto';
import { BomHeader } from '../boms/entities/bom-header.entity';
import { BomItem } from '../boms/entities/bom-item.entity';
import { StockSnapshot } from '../stocks/entities/stock-snapshot.entity';
import { ProductSku } from '../products/entities/product-sku.entity';

@Injectable()
export class ProductionOrdersService {
  constructor(
    @InjectRepository(ProductionOrder)
    private readonly orderRepo: Repository<ProductionOrder>,
    @InjectRepository(ProductionOrderItem)
    private readonly itemRepo: Repository<ProductionOrderItem>,
    @InjectRepository(BomHeader)
    private readonly bomRepo: Repository<BomHeader>,
    @InjectRepository(StockSnapshot)
    private readonly stockRepo: Repository<StockSnapshot>,
    @InjectRepository(ProductSku)
    private readonly skuRepo: Repository<ProductSku>,
    private readonly dataSource: DataSource,
  ) {}

  private async generateOrderNo(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SC-${dateStr}`;

    const count = await this.orderRepo.count({
      where: { orderNo: Like(`${prefix}-%`) },
    });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  async create(dto: CreateProductionOrderDto, creatorId?: string) {
    const bom = await this.bomRepo.findOne({
      where: { id: dto.bomId },
      relations: ['items'],
    });
    if (!bom) throw new NotFoundException('BOM 不存在');

    const sku = await this.skuRepo.findOneBy({ jstSkuId: bom.skuId });
    const skuName = sku?.skuName || sku?.skuCode || bom.skuId;

    const orderNo = await this.generateOrderNo();

    // 根据 BOM 计算原材料需求
    const items = (bom.items || []).map((bomItem: BomItem) => {
      const requiredQty = Number((bomItem.qty * dto.qty * (1 + (bomItem.lossRate || 0) / 100)).toFixed(4));
      return this.itemRepo.create({
        materialSkuId: bomItem.materialSkuId,
        requiredQty,
        actualQty: requiredQty,
      });
    });

    const order = this.orderRepo.create({
      orderNo,
      bomId: dto.bomId,
      skuId: bom.skuId,
      skuName,
      qty: dto.qty,
      status: ProductionOrderStatus.PENDING,
      remark: dto.remark,
      creatorId,
      items,
    });

    return this.orderRepo.save(order);
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    keyword?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const qb = this.orderRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.items', 'items')
      .orderBy('po.createdAt', 'DESC');

    if (params.status) {
      qb.andWhere('po.status = :status', { status: params.status });
    }
    if (params.keyword) {
      qb.andWhere(
        '(po.orderNo ILIKE :keyword OR po.skuName ILIKE :keyword)',
        { keyword: `%${params.keyword}%` },
      );
    }

    const [data, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return { data, total, page, pageSize };
  }

  async findOne(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('加工单不存在');
    return order;
  }

  async update(id: string, dto: UpdateProductionOrderDto) {
    const order = await this.orderRepo.findOne({ where: { id }, relations: ['items'] });
    if (!order) throw new NotFoundException('加工单不存在');
    if (order.status !== ProductionOrderStatus.PENDING) {
      throw new BadRequestException('仅待处理状态的加工单可编辑');
    }

    if (dto.qty !== undefined && dto.qty !== order.qty) {
      // 重新计算原材料需求
      const bom = await this.bomRepo.findOne({
        where: { id: order.bomId },
        relations: ['items'],
      });
      if (!bom) throw new NotFoundException('BOM 不存在');

      order.qty = dto.qty;

      if (order.items?.length) {
        await this.itemRepo.remove(order.items);
      }

      order.items = (bom.items || []).map((bomItem: BomItem) => {
        const requiredQty = Number((bomItem.qty * dto.qty! * (1 + (bomItem.lossRate || 0) / 100)).toFixed(4));
        return this.itemRepo.create({
          productionOrderId: order.id,
          materialSkuId: bomItem.materialSkuId,
          requiredQty,
          actualQty: requiredQty,
        });
      });
      await this.itemRepo.save(order.items);
    }

    if (dto.remark !== undefined) order.remark = dto.remark;

    return this.orderRepo.save(order);
  }

  async remove(id: string) {
    const order = await this.orderRepo.findOne({ where: { id }, relations: ['items'] });
    if (!order) throw new NotFoundException('加工单不存在');
    if (order.status !== ProductionOrderStatus.PENDING) {
      throw new BadRequestException('仅待处理状态的加工单可删除');
    }
    await this.orderRepo.remove(order);
    return { id };
  }

  async complete(id: string, dto?: CompleteProductionOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(ProductionOrder);
      const itemRepo = manager.getRepository(ProductionOrderItem);
      const stockRepo = manager.getRepository(StockSnapshot);

      const order = await orderRepo.findOne({ where: { id }, relations: ['items'] });
      if (!order) throw new NotFoundException('加工单不存在');
      if (order.status === ProductionOrderStatus.COMPLETED) {
        throw new BadRequestException('加工单已完成');
      }
      if (order.status === ProductionOrderStatus.CANCELLED) {
        throw new BadRequestException('加工单已取消');
      }

      const actualQty = dto?.actualQty ?? order.qty;

      // 1. 扣减原材料库存
      for (const item of order.items || []) {
        const consumeQty = Number((item.requiredQty * (actualQty / order.qty)).toFixed(4));
        item.actualQty = consumeQty;
        await itemRepo.save(item);

        // 查找该 SKU 的库存记录（任意仓库）
        const stocks = await stockRepo.find({ where: { skuId: item.materialSkuId } });
        if (!stocks.length) {
          throw new BadRequestException(`原材料 ${item.materialSkuId} 无库存记录`);
        }

        // 扣减第一个仓库的可用库存
        const stock = stocks[0];
        const newQty = Number(stock.availableQty) - consumeQty;
        if (newQty < 0) {
          throw new BadRequestException(
            `原材料 ${item.materialSkuId} 库存不足: 可用 ${stock.availableQty}, 需扣减 ${consumeQty}`,
          );
        }
        stock.availableQty = Number(newQty.toFixed(4));
        stock.syncedAt = new Date();
        await stockRepo.save(stock);
      }

      // 2. 增加成品库存
      const productStocks = await stockRepo.find({ where: { skuId: order.skuId } });
      if (productStocks.length) {
        const stock = productStocks[0];
        stock.availableQty = Number((Number(stock.availableQty) + actualQty).toFixed(4));
        stock.syncedAt = new Date();
        await stockRepo.save(stock);
      } else {
        // 创建新的库存记录（默认 warehouse_id = '0'）
        const newStock = stockRepo.create({
          skuId: order.skuId,
          warehouseId: '0',
          availableQty: actualQty,
          syncedAt: new Date(),
        });
        await stockRepo.save(newStock);
      }

      order.status = ProductionOrderStatus.COMPLETED;
      return orderRepo.save(order);
    });
  }
}
