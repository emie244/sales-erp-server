import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SalesOrderItemDto } from './sales-order-item.dto';

export class UpdateSalesOrderDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  signerId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items?: SalesOrderItemDto[];

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  consignee?: string;

  @IsOptional()
  @IsString()
  consigneePhone?: string;

  @IsOptional()
  @IsString()
  consigneeAddress?: string;
}
