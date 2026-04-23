import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SalesOrderItemDto {
  @IsString()
  productId: string;

  @IsString()
  skuId: string;

  @IsNumber()
  @Type(() => Number)
  qty: number;

  @IsNumber()
  @Type(() => Number)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  discountAmount?: number;
}
