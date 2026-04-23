import { IsArray, IsString, IsOptional, IsUUID } from 'class-validator';

export class BatchSubmitDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];

  @IsString()
  feishuUserId: string;

  @IsString()
  approvalDefCode: string;

  @IsOptional()
  @IsString()
  feishuUserIdType?: string;
}
