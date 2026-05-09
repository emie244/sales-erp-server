import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePrepaymentDto {
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  paymentDate?: Date;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
