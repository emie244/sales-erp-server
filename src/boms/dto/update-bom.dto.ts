import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBomItemDto {
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

export class UpdateBomDto {
  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateBomItemDto)
  items?: UpdateBomItemDto[];
}
