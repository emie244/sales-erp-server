import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsBoolean,
  IsArray,
} from 'class-validator';
import type {
  CustomerStatus,
  CustomerType,
  CustomerSettlementType,
} from '../entities/customer.entity';

export class CreateCustomerDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactTitle?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  wechat?: string;

  @IsOptional()
  @IsIn(['active', 'lead', 'dormant'])
  customerStatus?: CustomerStatus;

  @IsOptional()
  @IsIn(['standard', 'distributor', 'platform_shop'])
  customerType?: CustomerType;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isStrategic?: boolean;

  @IsOptional()
  @IsString()
  primaryAssigneeId?: string;

  @IsOptional()
  @IsNumber()
  creditLimit?: number;

  @IsOptional()
  @IsBoolean()
  isCreditBlocked?: boolean;

  @IsOptional()
  @IsNumber()
  paymentTerms?: number;

  @IsOptional()
  @IsIn(['one_off', 'monthly', 'quarterly'])
  settlementType?: CustomerSettlementType;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  invoiceTitle?: string;

  @IsOptional()
  @IsString()
  invoiceAddress?: string;

  @IsOptional()
  @IsString()
  invoicePhone?: string;

  @IsOptional()
  @IsString()
  invoiceBank?: string;

  @IsOptional()
  @IsString()
  invoiceBankAccount?: string;

  @IsOptional()
  @IsString()
  jstCustomerId?: string;

  @IsOptional()
  @IsString()
  latestRemark?: string;

  @IsOptional()
  @IsArray()
  onlineShopUrls?: string[];
}
