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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSkuDto)
  skus?: CreateSkuDto[];
}
