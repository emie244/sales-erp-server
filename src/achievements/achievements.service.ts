import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesRepAchievement } from './entities/sales-rep-achievement.entity';
import { CreateAchievementDto } from './dto/create-achievement.dto';

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(SalesRepAchievement)
    private readonly repo: Repository<SalesRepAchievement>,
  ) {}

  create(dto: CreateAchievementDto) {
    return this.repo.save(this.repo.create(dto));
  }

  findByUser(userId: string) {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async summaryByUser() {
    return this.repo
      .createQueryBuilder('a')
      .select('a.userId', 'userId')
      .addSelect('SUM(a.achievementAmount)', 'total')
      .groupBy('a.userId')
      .getRawMany();
  }
}
