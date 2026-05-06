export class CreateBomItemDto {
  materialSkuId: string;
  qty: number;
  lossRate?: number;
  sortOrder?: number;
  remark?: string;
}

export class CreateBomDto {
  productId: string;
  skuId: string;
  version?: string;
  remark?: string;
  items: CreateBomItemDto[];
}
