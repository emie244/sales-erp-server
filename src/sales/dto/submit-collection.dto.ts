import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CollectionRecordItemDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  amount: number;

  @IsNotEmpty()
  @IsString()
  method: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsArray()
  attachments?: string[];
}

export class SubmitCollectionDto {
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectionRecordItemDto)
  records: CollectionRecordItemDto[];

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
