import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSkuDto {
  @IsOptional()
  @IsString()
  skuCode?: string;

  @IsOptional()
  @IsString()
  skuName?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  spec?: string;

  @IsOptional()
  weight?: number;

  @IsOptional()
  floorPrice?: number;

  @IsOptional()
  @IsString()
  itemType?: 'finished_good' | 'semi_finished' | 'raw_material' | 'packaging';

  @IsOptional()
  salePrice?: number;

  @IsOptional()
  costPrice?: number;

  @IsOptional()
  @IsString()
  pic?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  materialCategoryId?: string;

  @IsOptional()
  pics?: string[];
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  launchDate?: string;

  @IsOptional()
  @IsString()
  lifecycleStage?: string;

  @IsOptional()
  @IsString()
  itemType?: 'finished_good' | 'semi_finished' | 'raw_material' | 'packaging';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSkuDto)
  skus?: CreateSkuDto[];
}
