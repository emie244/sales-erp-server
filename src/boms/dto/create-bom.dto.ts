import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBomItemDto {
  @IsString()
  materialSkuId: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  qty: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  lossRate?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  materialCategoryId?: string;

  @IsOptional()
  @IsString()
  materialCategoryName?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class CreateBomDto {
  @IsString()
  productId: string;

  @IsString()
  skuId: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBomItemDto)
  items: CreateBomItemDto[];
}
