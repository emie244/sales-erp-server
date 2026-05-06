import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesTarget } from './entities/sales-target.entity';

@Injectable()
export class TargetsService {
  constructor(
    @InjectRepository(SalesTarget)
    private readonly repo: Repository<SalesTarget>,
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

    if (existing) {
      existing.targetAmount = dto.targetAmount;
      existing.userName = dto.userName || existing.userName;
      return this.repo.save(existing);
    }

    const target = this.repo.create({
      userId: dto.userId,
      userName: dto.userName,
      targetAmount: dto.targetAmount,
      period: defaultPeriod,
    });
    return this.repo.save(target);
  }

  async update(id: string, dto: { targetAmount: number }) {
    const target = await this.repo.findOneBy({ id });
    if (!target) throw new NotFoundException('Target not found');
    target.targetAmount = dto.targetAmount;
    return this.repo.save(target);
  }

  async remove(id: string) {
    const target = await this.repo.findOneBy({ id });
    if (!target) throw new NotFoundException('Target not found');
    await this.repo.remove(target);
    return { message: 'deleted' };
  }
}
