import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like } from 'typeorm';
import {
  PurchaseRequest,
  PurchaseRequestStatus,
} from './entities/purchase-request.entity';
import { PurchaseRequestItem } from './entities/purchase-request-item.entity';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import { PurchaseOrder, PurchaseOrderStatus } from '../purchase-orders/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-orders/entities/purchase-order-item.entity';

@Injectable()
export class PurchaseRequestsService {
  constructor(
    @InjectRepository(PurchaseRequest)
    private readonly prRepo: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseRequestItem)
    private readonly itemRepo: Repository<PurchaseRequestItem>,
    private readonly dataSource: DataSource,
  ) {}

  private async generatePrNo(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PR-${dateStr}`;

    const count = await this.prRepo.count({
      where: { prNo: Like(`${prefix}-%`) },
    });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  async create(dto: CreatePurchaseRequestDto, creatorId?: string) {
    const prNo = await this.generatePrNo();

    let totalAmount = 0;
    const items = (dto.items || []).map((item) => {
      const lineAmount = Number(
        ((item.qty || 0) * (item.estimatedUnitPrice || 0)).toFixed(2),
      );
      totalAmount += lineAmount;
      return this.itemRepo.create({
        skuId: item.skuId,
        skuCode: item.skuCode,
        skuName: item.skuName,
        qty: item.qty,
        estimatedUnitPrice: item.estimatedUnitPrice ?? null,
        supplierId: item.supplierId || null,
        supplierName: item.supplierName || null,
        bomId: item.bomId || null,
        remark: item.remark,
      });
    });

    const pr = this.prRepo.create({
      prNo,
      salesOrderId: dto.salesOrderId || null,
      status: PurchaseRequestStatus.DRAFT,
      totalAmount: Number(totalAmount.toFixed(2)),
      remark: dto.remark,
      creatorId,
      items,
    });

    return this.prRepo.save(pr);
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    salesOrderId?: string;
    keyword?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const qb = this.prRepo
      .createQueryBuilder('pr')
      .leftJoinAndSelect('pr.items', 'items')
      .orderBy('pr.createdAt', 'DESC');

    if (params.status) {
      qb.andWhere('pr.status = :status', { status: params.status });
    }
    if (params.salesOrderId) {
      qb.andWhere('pr.salesOrderId = :salesOrderId', {
        salesOrderId: params.salesOrderId,
      });
    }
    if (params.keyword) {
      qb.andWhere('(pr.prNo ILIKE :keyword)', {
        keyword: `%${params.keyword}%`,
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data, total, page, pageSize };
  }

  async findOne(id: string) {
    const pr = await this.prRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!pr) throw new NotFoundException('采购申请不存在');
    return pr;
  }

  async update(id: string, dto: UpdatePurchaseRequestDto) {
    return this.dataSource.transaction(async (manager) => {
      const prRepo = manager.getRepository(PurchaseRequest);
      const itemRepo = manager.getRepository(PurchaseRequestItem);

      const pr = await prRepo.findOne({
        where: { id },
        relations: ['items'],
      });
      if (!pr) throw new NotFoundException('采购申请不存在');
      if (pr.status !== PurchaseRequestStatus.DRAFT) {
        throw new BadRequestException('仅草稿状态的采购申请可编辑');
      }

      if (dto.remark !== undefined) pr.remark = dto.remark;

      if (dto.items) {
        if (pr.items?.length) {
          await itemRepo.remove(pr.items);
        }

        let totalAmount = 0;
        const newItems = dto.items.map((item) => {
          const lineAmount = Number(
            ((item.qty || 0) * (item.estimatedUnitPrice || 0)).toFixed(2),
          );
          totalAmount += lineAmount;
          return itemRepo.create({
            purchaseRequestId: pr.id,
            skuId: item.skuId,
            skuCode: item.skuCode,
            skuName: item.skuName,
            qty: item.qty,
            estimatedUnitPrice: item.estimatedUnitPrice ?? null,
            supplierId: item.supplierId || null,
            supplierName: item.supplierName || null,
            bomId: item.bomId || null,
            remark: item.remark,
          });
        });
        await itemRepo.save(newItems);
        pr.totalAmount = Number(totalAmount.toFixed(2));
        pr.items = newItems;
      }

      return prRepo.save(pr);
    });
  }

  async remove(id: string) {
    const pr = await this.prRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!pr) throw new NotFoundException('采购申请不存在');
    if (pr.status !== PurchaseRequestStatus.DRAFT) {
      throw new BadRequestException('仅草稿状态的采购申请可删除');
    }
    await this.prRepo.remove(pr);
    return { id };
  }

  async convertToPo(id: string, creatorId?: string) {
    return this.dataSource.transaction(async (manager) => {
      const prRepo = manager.getRepository(PurchaseRequest);
      const poRepo = manager.getRepository(PurchaseOrder);
      const poItemRepo = manager.getRepository(PurchaseOrderItem);

      const pr = await prRepo.findOne({
        where: { id },
        relations: ['items'],
      });
      if (!pr) throw new NotFoundException('采购申请不存在');
      if (pr.status !== PurchaseRequestStatus.APPROVED) {
        throw new BadRequestException('仅已批准的采购申请可转为采购单');
      }
      if (pr.convertedPoId) {
        throw new BadRequestException('该采购申请已转采购单');
      }

      // Group items by supplier
      const supplierGroups = new Map<string, typeof pr.items>();
      for (const item of pr.items || []) {
        const sid = item.supplierId || 'default';
        if (!supplierGroups.has(sid)) supplierGroups.set(sid, []);
        supplierGroups.get(sid)!.push(item);
      }

      // For simplicity, create one PO per supplier. If all same supplier, one PO.
      const createdPoIds: string[] = [];
      for (const [supplierId, items] of supplierGroups) {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `CG-${dateStr}`;
        const count = await poRepo.count({
          where: { orderNo: Like(`${prefix}-%`) },
        });
        const orderNo = `${prefix}-${String(count + 1).padStart(3, '0')}`;

        let totalAmount = 0;
        const poItems = items.map((item) => {
          const lineAmount = Number(
            (Number(item.qty) * (Number(item.estimatedUnitPrice) || 0)).toFixed(2),
          );
          totalAmount += lineAmount;
          return poItemRepo.create({
            skuId: item.skuId,
            skuCode: item.skuCode,
            skuName: item.skuName,
            qty: Number(item.qty),
            unitPrice: Number(item.estimatedUnitPrice) || 0,
            lineAmount,
            supplierId: (item.supplierId || supplierId === 'default' ? undefined : supplierId) as string,
            supplierName: item.supplierName,
            bomId: item.bomId,
            remark: item.remark,
          } as any);
        });

        const po = poRepo.create({
          orderNo,
          supplierId: supplierId === 'default' ? null : supplierId,
          status: PurchaseOrderStatus.DRAFT,
          totalAmount: Number(totalAmount.toFixed(2)),
          creatorId,
          items: poItems,
        } as any);

        const saved: any = await poRepo.save(po);
        createdPoIds.push(Array.isArray(saved) ? saved[0].id : saved.id);
      }

      pr.status = PurchaseRequestStatus.CONVERTED;
      pr.convertedPoId = createdPoIds[0] || null;
      await prRepo.save(pr);

      return { prId: pr.id, poIds: createdPoIds };
    });
  }
}
