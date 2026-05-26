import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { InvoiceStatus } from '../entities/invoice-record.entity';

export class UpdateInvoiceRecordDto {
  @IsString()
  @IsOptional()
  invoiceNo?: string;

  @IsString()
  @IsOptional()
  salesOrderId?: string;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsDateString()
  @IsOptional()
  invoiceDate?: string;

  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @IsString()
  @IsOptional()
  issuer?: string;

  @IsString()
  @IsOptional()
  remark?: string;
}
