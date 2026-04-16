import { IsString, IsNumber, IsOptional } from 'class-validator';

export class SalesOrderItemDto {
  @IsString()
  skuId: string;

  @IsNumber()
  qty: number;

  @IsNumber()
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;
}
