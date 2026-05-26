import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreatePurchaseOrderItemDto {
  @IsString()
  skuId: string;

  @IsOptional()
  @IsString()
  skuCode?: string;

  @IsOptional()
  @IsString()
  skuName?: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  qty: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsString()
  bomId?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class CreatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  expectedDeliveryDate?: Date | string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}
