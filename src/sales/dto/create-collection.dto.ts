import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateCollectionDto {
  @IsOptional()
  @IsString()
  salesOrderId?: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsNumber()
  prepaymentDeducted?: number;

  @IsNotEmpty()
  @IsString()
  method: string;

  @IsOptional()
  receivedAt?: Date;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsUUID()
  prepaymentRecordId?: string;
}
