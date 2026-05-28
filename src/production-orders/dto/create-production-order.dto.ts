import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductionOrderType } from '../entities/production-order.entity';

export class AllocationDto {
  @IsString()
  materialSkuId: string;

  @IsOptional()
  @IsString()
  purchaseOrderItemId?: string;
}

export class CreateProductionOrderDto {
  @IsString()
  bomId: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  qty: number;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  salesOrderId?: string;

  @IsOptional()
  @IsEnum(ProductionOrderType)
  type?: ProductionOrderType;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  processingFee?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations?: AllocationDto[];
}
