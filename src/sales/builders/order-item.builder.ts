import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductsService } from '../../products/products.service';
import { CommissionPolicy } from '../policies/commission.policy';
import { SalesOrderItemDto } from '../dto/sales-order-item.dto';

export interface BuiltOrderItem {
  productId: string;
  skuId: string;
  jstSkuId: string | undefined;
  skuCode: string | undefined;
  productName: string;
  skuName: string;
  qty: number;
  unitPrice: number;
  discountAmount: number;
  lineAmount: number;
  commissionRate: number;
  commissionAmount: number;
}

@Injectable()
export class OrderItemBuilder {
  constructor(
    private readonly productsService: ProductsService,
    private readonly commissionPolicy: CommissionPolicy,
  ) {}

  async build(
    itemDtos: SalesOrderItemDto[],
    orderDate: Date,
    tenantId?: string,
  ): Promise<{ items: BuiltOrderItem[]; totalAmount: number }> {
    let totalAmount = 0;
    const items: BuiltOrderItem[] = [];

    for (const itemDto of itemDtos) {
      const sku = await this.productsService.findSkuById(
        itemDto.skuId,
        tenantId,
      );
      if (!sku) {
        throw new NotFoundException(`SKU ${itemDto.skuId} not found`);
      }
      if (!sku.product) {
        throw new NotFoundException(
          `Product for SKU ${itemDto.skuId} not found`,
        );
      }

      const lineAmount =
        itemDto.qty * itemDto.unitPrice - (itemDto.discountAmount || 0);
      totalAmount += lineAmount;

      const commissionRate = this.commissionPolicy.calculateRate({
        launchDate: sku.product?.launchDate || null,
        lifecycleStage: sku.product?.lifecycleStage || null,
        orderDate,
      });
      const commissionAmount = this.commissionPolicy.calculateAmount(
        lineAmount,
        commissionRate,
      );

      items.push({
        productId: itemDto.productId || sku.product.id,
        skuId: itemDto.skuId,
        jstSkuId: sku.jstSkuId || undefined,
        skuCode: sku.skuCode || undefined,
        productName: sku.product.name || '',
        skuName: sku.skuName || sku.skuCode || '',
        qty: itemDto.qty,
        unitPrice: itemDto.unitPrice,
        discountAmount: itemDto.discountAmount || 0,
        lineAmount,
        commissionRate,
        commissionAmount,
      });
    }

    return { items, totalAmount };
  }
}
