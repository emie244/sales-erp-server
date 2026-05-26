import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VoucherType, VoucherStatus } from '../entities/voucher.entity';
import { CreateVoucherItemDto } from './create-voucher-item.dto';

export class CreateVoucherDto {
  @IsString()
  voucherNo: string;

  @IsDateString()
  voucherDate: string;

  @IsEnum(VoucherType)
  @IsOptional()
  type?: VoucherType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  totalAmount: number;

  @IsEnum(VoucherStatus)
  @IsOptional()
  status?: VoucherStatus;

  @IsString()
  @IsOptional()
  sourceType?: string;

  @IsString()
  @IsOptional()
  sourceId?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateVoucherItemDto)
  @IsOptional()
  items?: CreateVoucherItemDto[];
}
