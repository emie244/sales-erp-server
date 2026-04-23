import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async findAll(page: number = 1, pageSize: number = 50, tenantId?: string) {
    const [data, total] = await this.repo.findAndCount({
      where: tenantId ? { tenantId } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, pageSize };
  }
}
