import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesRepAchievement } from './entities/sales-rep-achievement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SalesRepAchievement])],
  exports: [TypeOrmModule],
})
export class AchievementsModule {}
