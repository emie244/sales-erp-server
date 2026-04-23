import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SubmitCollectionDto {
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
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  prepaymentRecordId?: string;

  @IsNotEmpty()
  @IsString()
  feishuUserId: string;

  @IsNotEmpty()
  @IsString()
  approvalDefCode: string;

  @IsOptional()
  @IsString()
  feishuUserIdType?: string;
}
