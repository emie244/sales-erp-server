import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  salesOrderId: string;

  @IsNumber()
  amount: number;

  @IsString()
  method: string;

  @IsDateString()
  receivedAt: string;

  @IsString()
  receivedBy: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
