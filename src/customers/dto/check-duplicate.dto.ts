import { IsOptional, IsString } from 'class-validator';

export class CheckDuplicateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  excludeId?: string;
}
