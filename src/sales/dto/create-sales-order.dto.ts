import {
  IsString,
  IsEnum,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SalesOrderType } from '../entities/sales-order.entity';
import { SalesOrderItemDto } from './sales-order-item.dto';

export class CreateSalesOrderDto {
  @IsString()
  customerId: string;

  @IsEnum(SalesOrderType)
  type: SalesOrderType;

  @IsOptional()
  @IsString()
  salespersonId?: string;

  @IsOptional()
  @IsString()
  jstShopOwnerId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items?: SalesOrderItemDto[];

  @IsOptional()
  @IsNumber()
  payAmount?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsArray()
  attachments?: string[];

  @IsOptional()
  @IsString()
  consignee?: string;

  @IsOptional()
  @IsString()
  consigneePhone?: string;

  @IsOptional()
  @IsString()
  consigneeAddress?: string;

  @IsOptional()
  @IsString()
  consigneeProvince?: string;

  @IsOptional()
  @IsString()
  consigneeCity?: string;

  @IsOptional()
  @IsString()
  consigneeDistrict?: string;

  @IsOptional()
  @IsString()
  consigneeTown?: string;

  @IsOptional()
  @IsString()
  consigneeTel?: string;

  @IsOptional()
  @IsString()
  logisticsCompany?: string;

  @IsOptional()
  @IsString()
  expressNo?: string;

  @IsOptional()
  @IsString()
  buyerMessage?: string;
}
