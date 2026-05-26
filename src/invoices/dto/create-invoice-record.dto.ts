import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { InvoiceStatus } from '../entities/invoice-record.entity';

export class CreateInvoiceRecordDto {
  @IsString()
  invoiceNo: string;

  @IsString()
  @IsOptional()
  salesOrderId?: string;

  @IsNumber()
  amount: number;

  @IsDateString()
  invoiceDate: string;

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
