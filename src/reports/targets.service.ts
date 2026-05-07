import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesTarget } from './entities/sales-target.entity';
import { ReportsCacheService } from './reports-cache.service';

@Injectable()
export class TargetsService {
  constructor(
    @InjectRepository(SalesTarget)
    private readonly repo: Repository<SalesTarget>,
    private readonly cache: ReportsCacheService,
  ) {}

  async findAll(period?: string) {
    const where: any = {};
    if (period) where.period = period;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findByUser(userId: string, period?: string) {
    const where: any = { userId };
    if (period) where.period = period;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async create(dto: { userId: string; userName?: string; targetAmount: number; period?: string }) {
    const now = new Date();
    const defaultPeriod = dto.period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const existing = await this.repo.findOne({
      where: { userId: dto.userId, period: defaultPeriod },
    });

    let result: SalesTarget;
    if (existing) {
      existing.targetAmount = dto.targetAmount;
      existing.userName = dto.userName || existing.userName;
      result = await this.repo.save(existing);
    } else {
      const target = this.repo.create({
        userId: dto.userId,
        userName: dto.userName,
        targetAmount: dto.targetAmount,
        period: defaultPeriod,
      });
      result = await this.repo.save(target);
    }

    await this.cache.invalidate('targetProgress');
    return result;
  }

  async update(id: string, dto: { targetAmount: number }) {
    const target = await this.repo.findOneBy({ id });
    if (!target) throw new NotFoundException('Target not found');
    target.targetAmount = dto.targetAmount;
    const result = await this.repo.save(target);
    await this.cache.invalidate('targetProgress');
    return result;
  }

  async remove(id: string) {
    const target = await this.repo.findOneBy({ id });
    if (!target) throw new NotFoundException('Target not found');
    await this.repo.remove(target);
    await this.cache.invalidate('targetProgress');
    return { message: 'deleted' };
  }
}
