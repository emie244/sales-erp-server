import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateVoucherItemDto {
  @IsString()
  accountCode: string;

  @IsString()
  @IsOptional()
  accountName?: string;

  @IsNumber()
  @IsOptional()
  debitAmount?: number;

  @IsNumber()
  @IsOptional()
  creditAmount?: number;

  @IsString()
  @IsOptional()
  description?: string;
}
