import { IsString, IsNumber } from 'class-validator';

export class SetPriceDto {
  @IsString()
  skuId: string;

  @IsString()
  customerLevel: string;

  @IsNumber()
  price: number;

  @IsNumber()
  minQty: number;
}
