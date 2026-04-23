import { IsArray, IsUUID } from 'class-validator';

export class BatchPushJushuitanDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];
}
