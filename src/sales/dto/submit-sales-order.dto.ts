import { IsString, IsOptional } from 'class-validator';

export class SubmitSalesOrderDto {
  @IsString()
  feishuUserId: string;

  @IsOptional()
  @IsString()
  feishuUserIdType?: string;

  @IsString()
  approvalDefCode: string;
}
