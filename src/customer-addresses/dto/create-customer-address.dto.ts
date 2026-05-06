import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class CreateCustomerAddressDto {
  @IsUUID()
  customerId: string;

  @IsString()
  consignee: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  detailAddress?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
