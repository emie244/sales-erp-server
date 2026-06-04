import { IsString } from 'class-validator';

export class ParseOrderRequestDto {
  @IsString()
  text: string;
}
