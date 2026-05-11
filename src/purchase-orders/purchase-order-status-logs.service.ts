import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { PurchaseOrderStatusLog } from './entities/purchase-order-status-log.entity';

export interface CreateStatusLogDto {
  purchaseOrderId: string;
  fromStatus: string | null;
  toStatus: string;
  operatorId?: string | null;
  remark?: string | null;
}

@Injectable()
export class PurchaseOrderStatusLogsService {
  constructor(
    @InjectRepository(PurchaseOrderStatusLog)
    private readonly repo: Repository<PurchaseOrderStatusLog>,
  ) {}

  async create(
    dto: CreateStatusLogDto,
    manager?: EntityManager,
  ): Promise<PurchaseOrderStatusLog> {
    const repo = manager
      ? manager.getRepository(PurchaseOrderStatusLog)
      : this.repo;
    const log = repo.create({
      purchaseOrderId: dto.purchaseOrderId,
      fromStatus: dto.fromStatus,
      toStatus: dto.toStatus,
      operatorId: dto.operatorId ?? null,
      remark: dto.remark ?? null,
    });
    return repo.save(log);
  }

  async findByPurchaseOrderId(
    purchaseOrderId: string,
  ): Promise<PurchaseOrderStatusLog[]> {
    return this.repo.find({
      where: { purchaseOrderId },
      order: { createdAt: 'DESC' },
    });
  }
}
