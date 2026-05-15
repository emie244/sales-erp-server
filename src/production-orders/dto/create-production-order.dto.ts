import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations?: AllocationDto[];
}
