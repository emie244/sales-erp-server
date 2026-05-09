import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductionOrderDto {
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  qty?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}
