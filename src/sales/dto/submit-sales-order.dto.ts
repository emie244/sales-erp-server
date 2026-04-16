import { IsString } from 'class-validator';

export class SubmitSalesOrderDto {
  @IsString()
  feishuUserId: string;

  @IsString()
  approvalDefCode: string;
}
