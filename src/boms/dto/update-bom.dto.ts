export class UpdateBomItemDto {
  materialSkuId: string;
  qty: number;
  lossRate?: number;
  sortOrder?: number;
  remark?: string;
}

export class UpdateBomDto {
  version?: string;
  remark?: string;
  items?: UpdateBomItemDto[];
}
