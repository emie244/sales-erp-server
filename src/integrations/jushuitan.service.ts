import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SalesOrder } from '../sales/entities/sales-order.entity';

@Injectable()
export class JushuitanService {
  private appKey: string;
  private appSecret: string;
  private baseUrl = 'https://open.erp321.com/api/open';

  constructor(private config: ConfigService) {
    this.appKey = this.config.get<string>('JUSHUITAN_APP_KEY') || '';
    this.appSecret = this.config.get<string>('JUSHUITAN_APP_SECRET') || '';
  }

  private sign(params: Record<string, any>): string {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}${params[k]}`)
      .join('');
    return sorted + this.appSecret;
  }

  async createSalesOrder(order: SalesOrder): Promise<any> {
    const payload = {
      app_key: this.appKey,
      so_id: order.id,
      shop_id: 0,
      pay_amount: order.payAmount,
      items: order.items.map((i) => ({
        sku_id: i.skuId,
        name: i.skuName,
        qty: i.qty,
        price: i.unitPrice,
        amount: i.lineAmount,
      })),
    };

    const res = await fetch(`${this.baseUrl}/jushuitan/orders/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async queryDeliveries(modifiedAfter: string): Promise<any[]> {
    const payload = {
      app_key: this.appKey,
      modified_after: modifiedAfter,
      page_index: 1,
      page_size: 50,
    };
    const res = await fetch(`${this.baseUrl}/jushuitan/deliveries/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data?.data?.datas || [];
  }

  async queryStocks(): Promise<any[]> {
    const payload = {
      app_key: this.appKey,
      page_index: 1,
      page_size: 100,
    };
    const res = await fetch(`${this.baseUrl}/jushuitan/inventory/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data?.data?.datas || [];
  }
}
