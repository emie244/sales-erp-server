import { IsString, IsNumber, IsEnum } from 'class-validator';

export class CreateAchievementDto {
  @IsString()
  salesOrderId: string;

  @IsString()
  userId: string;

  @IsEnum(['primary', 'assistant'])
  role: 'primary' | 'assistant';

  @IsNumber()
  shareRatio: number;

  @IsNumber()
  achievementAmount: number;
}
