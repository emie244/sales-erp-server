import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type FindOptionsWhere, Between, Like } from 'typeorm';
import { OperationLog } from './entities/operation-log.entity';

@Injectable()
export class OperationLogsService {
  constructor(
    @InjectRepository(OperationLog)
    private readonly repo: Repository<OperationLog>,
  ) {}

  async create(data: Partial<OperationLog>) {
    const log = this.repo.create(data);
    return this.repo.save(log);
  }

  async findAll(
    page: number = 1,
    pageSize: number = 50,
    filters: {
      tenantId?: string;
      userName?: string;
      action?: string;
      resource?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {},
  ) {
    const where: FindOptionsWhere<OperationLog> = {};

    if (filters.tenantId) {
      where.tenantId = filters.tenantId;
    }
    if (filters.userName) {
      where.userName = Like(`%${filters.userName}%`);
    }
    if (filters.action) {
      where.action = Like(`%${filters.action}%`);
    }
    if (filters.resource) {
      where.resource = filters.resource;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.dateFrom && filters.dateTo) {
      where.createdAt = Between(
        new Date(filters.dateFrom),
        new Date(filters.dateTo),
      );
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, pageSize };
  }
}
