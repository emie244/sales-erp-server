import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { CustomerLevel } from '../entities/customer.entity';

export class CreateCustomerDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(CustomerLevel)
  level?: CustomerLevel;

  @IsOptional()
  @IsNumber()
  creditLimit?: number;

  @IsOptional()
  @IsNumber()
  paymentTerms?: number;

  @IsOptional()
  @IsString()
  address?: string;
}
