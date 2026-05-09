import { IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CompleteProductionOrderDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  actualQty?: number;
}
