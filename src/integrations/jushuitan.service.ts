import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { SalesOrder } from '../sales/entities/sales-order.entity';

@Injectable()
export class JushuitanService {
  private readonly logger = new Logger(JushuitanService.name);
  private appKey: string;
  private appSecret: string;
  private accessToken: string;
  private refreshToken: string;
  private shopId: number;
  private baseUrl = 'https://openapi.jushuitan.com';

  constructor(private config: ConfigService) {
    this.appKey = this.config.get<string>('JUSHUITAN_APP_KEY') || '';
    this.appSecret = this.config.get<string>('JUSHUITAN_APP_SECRET') || '';
    this.accessToken = this.config.get<string>('JUSHUITAN_ACCESS_TOKEN') || '';
    this.refreshToken =
      this.config.get<string>('JUSHUITAN_REFRESH_TOKEN') || '';
    this.shopId = Number(this.config.get<string>('JUSHUITAN_SHOP_ID') || 0);
  }

  private sign(params: Record<string, unknown>): string {
    const sorted = Object.keys(params)
      .filter((k) => k !== 'sign' && params[k] != null && params[k] !== '')
      .sort()
      .map((k) => `${k}${String(params[k] as string | number)}`)
      .join('');
    const raw = this.appSecret + sorted;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  private async request(
    endpoint: string,
    bizParams: Record<string, unknown>,
  ): Promise<unknown> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const biz = JSON.stringify(bizParams);
    const params: Record<string, unknown> = {
      app_key: this.appKey,
      access_token: this.accessToken,
      timestamp,
      charset: 'utf-8',
      version: '2',
      biz,
    };
    params.sign = this.sign(params);

    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      body.append(k, String(v));
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { code: -1, msg: text };
    }
  }

  async createSalesOrder(order: SalesOrder): Promise<unknown> {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const created = order.createdAt ? new Date(order.createdAt) : new Date();
    const orderDate = `${created.getFullYear()}-${pad(created.getMonth() + 1)}-${pad(created.getDate())} ${pad(created.getHours())}:${pad(created.getMinutes())}:${pad(created.getSeconds())}`;
    const payAmount = Number(order.payAmount || 0);

    // 根据签单人获取店铺ID，必须配置
    if (!order.signer) {
      throw new Error('订单未指定签单人，请先选择签单人');
    }
    if (!order.signer.jushuitanShopId) {
      throw new Error(
        `签单人「${order.signer.name}」未配置聚水潭店铺ID，请联系管理员在「系统管理-用户管理」中配置`,
      );
    }
    const shopId = Number(order.signer.jushuitanShopId);

    // 构建推送报文，确保必填字段不为空
    const receiverName = order.consignee || order.customer?.name || '未知客户';
    const receiverMobile = order.consigneePhone || '13800000000';
    const receiverAddress =
      [
        order.consigneeProvince,
        order.consigneeCity,
        order.consigneeDistrict,
        order.consigneeTown,
        order.consigneeAddress,
      ]
        .filter(Boolean)
        .join(' ') || '未知地址';

    const items =
      order.items?.map((i, idx) => ({
        sku_id: i.jstSkuId || i.skuCode || i.skuId || 'UNKNOWN',
        shop_sku_id: i.skuCode || i.jstSkuId || i.skuId || 'UNKNOWN',
        outer_oi_id: `${order.id}_${idx}`,
        name: i.skuName || i.productName || '商品',
        qty: Number(i.qty || 0),
        price: Number(i.unitPrice || 0),
        base_price: Number(i.unitPrice || 0),
        amount: Number(i.lineAmount || 0),
      })) || [];

    // 如果没有明细，添加一个默认明细（聚水潭要求至少一条）
    if (items.length === 0) {
      items.push({
        sku_id: 'UNKNOWN',
        shop_sku_id: 'UNKNOWN',
        outer_oi_id: `${order.id}_0`,
        name: '商品',
        qty: 1,
        price: payAmount,
        base_price: payAmount,
        amount: payAmount,
      });
    }

    const payload: Record<string, unknown> = {
      so_id: order.id,
      shop_id: shopId,
      order_date: orderDate,
      shop_status: 'WAIT_SELLER_SEND_GOODS',
      shop_buyer_id: order.customer?.name || order.customerId || '未知客户',
      pay_amount: payAmount,
      freight: 0,
      receiver_name: receiverName,
      receiver_mobile: receiverMobile,
      receiver_phone: order.consigneeTel || receiverMobile,
      receiver_address: receiverAddress,
      receiver_state: order.consigneeProvince || '广东省',
      receiver_city: order.consigneeCity || '广州市',
      receiver_district: order.consigneeDistrict || '天河区',
      pay: {
        outer_pay_id: order.id,
        pay_date: orderDate,
        amount: payAmount,
        payment: '线下支付',
        seller_account: 'seller',
        buyer_account: 'buyer',
      },
      items,
    };

    // 可选字段：只有有值时才传递，避免传空字符串触发 schema 验证
    if (order.consigneeTown) payload.receiver_town = order.consigneeTown;
    if (order.logisticsCompany)
      payload.logistics_company = order.logisticsCompany;
    if (order.expressNo) payload.express_no = order.expressNo;
    if (order.buyerMessage) payload.buyer_message = order.buyerMessage;

    this.logger.log(`Pushing order to Jushuitan: ${JSON.stringify(payload)}`);
    return this.request('/open/jushuitan/orders/upload', { orders: [payload] });
  }

  buildSalesOrderPayload(order: SalesOrder): Record<string, unknown> {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const created = order.createdAt ? new Date(order.createdAt) : new Date();
    const orderDate = `${created.getFullYear()}-${pad(created.getMonth() + 1)}-${pad(created.getDate())} ${pad(created.getHours())}:${pad(created.getMinutes())}:${pad(created.getSeconds())}`;
    const payAmount = Number(order.payAmount || 0);

    // 根据签单人获取店铺ID，必须配置
    if (!order.signer) {
      throw new Error('订单未指定签单人，请先选择签单人');
    }
    if (!order.signer.jushuitanShopId) {
      throw new Error(
        `签单人「${order.signer.name}」未配置聚水潭店铺ID，请联系管理员在「系统管理-用户管理」中配置`,
      );
    }
    const shopId = Number(order.signer.jushuitanShopId);

    const receiverName = order.consignee || order.customer?.name || '未知客户';
    const receiverMobile = order.consigneePhone || '13800000000';
    const receiverAddress =
      [
        order.consigneeProvince,
        order.consigneeCity,
        order.consigneeDistrict,
        order.consigneeTown,
        order.consigneeAddress,
      ]
        .filter(Boolean)
        .join(' ') || '未知地址';

    const items =
      order.items?.map((i, idx) => ({
        sku_id: i.jstSkuId || i.skuCode || i.skuId || 'UNKNOWN',
        shop_sku_id: i.skuCode || i.jstSkuId || i.skuId || 'UNKNOWN',
        outer_oi_id: `${order.id}_${idx}`,
        name: i.skuName || i.productName || '商品',
        qty: Number(i.qty || 0),
        price: Number(i.unitPrice || 0),
        base_price: Number(i.unitPrice || 0),
        amount: Number(i.lineAmount || 0),
      })) || [];

    if (items.length === 0) {
      items.push({
        sku_id: 'UNKNOWN',
        shop_sku_id: 'UNKNOWN',
        outer_oi_id: `${order.id}_0`,
        name: '商品',
        qty: 1,
        price: payAmount,
        base_price: payAmount,
        amount: payAmount,
      });
    }

    const payload: Record<string, unknown> = {
      so_id: order.id,
      shop_id: shopId,
      order_date: orderDate,
      shop_status: 'WAIT_SELLER_SEND_GOODS',
      shop_buyer_id: order.customer?.name || order.customerId || '未知客户',
      pay_amount: payAmount,
      freight: 0,
      receiver_name: receiverName,
      receiver_mobile: receiverMobile,
      receiver_phone: order.consigneeTel || receiverMobile,
      receiver_address: receiverAddress,
      receiver_state: order.consigneeProvince || '广东省',
      receiver_city: order.consigneeCity || '广州市',
      receiver_district: order.consigneeDistrict || '天河区',
      pay: {
        outer_pay_id: order.id,
        pay_date: orderDate,
        amount: payAmount,
        payment: '线下支付',
        seller_account: 'seller',
        buyer_account: 'buyer',
      },
      items,
    };

    if (order.consigneeTown) payload.receiver_town = order.consigneeTown;
    if (order.logisticsCompany)
      payload.logistics_company = order.logisticsCompany;
    if (order.expressNo) payload.express_no = order.expressNo;
    if (order.buyerMessage) payload.buyer_message = order.buyerMessage;

    return payload;
  }

  async queryDeliveries(modifiedAfter: string): Promise<unknown[]> {
    const res = await this.request('/open/deliveries/query', {
      modified_after: modifiedAfter,
      page_index: 1,
      page_size: 50,
    });
    const r = res as Record<string, unknown>;
    return ((r?.data as Record<string, unknown>)?.datas as unknown[]) || [];
  }

  async queryStocks(daysBack: number = 365): Promise<unknown[]> {
    const all: unknown[] = [];
    const now = new Date();
    const windowMs = 6 * 24 * 60 * 60 * 1000; // 6天窗口（留余量）
    let windowStart = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    while (windowStart < now) {
      let windowEnd = new Date(windowStart.getTime() + windowMs);
      if (windowEnd > now) windowEnd = now;

      let pageIndex = 1;
      let windowHasMore = true;

      while (windowHasMore) {
        const res = await this.request('/open/inventory/query', {
          page_index: pageIndex,
          page_size: 100,
          modified_begin: fmt(windowStart),
          modified_end: fmt(windowEnd),
        });

        const r = res as Record<string, unknown>;
        const items =
          ((r?.data as Record<string, unknown>)?.inventorys as unknown[]) || [];
        const pageCount =
          ((r?.data as Record<string, unknown>)?.page_count as number) || 1;
        all.push(...items);
        windowHasMore = pageIndex < pageCount;
        pageIndex++;

        // 避免触发频次限制
        if (windowHasMore) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      windowStart = windowEnd;
      if (windowStart < now) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return all;
  }

  async querySkus(
    pageIndex: number = 1,
    pageSize: number = 100,
    modifiedBegin?: string,
    modifiedEnd?: string,
  ): Promise<unknown> {
    const payload: Record<string, unknown> = {
      page_index: pageIndex,
      page_size: pageSize,
    };
    if (modifiedBegin) payload.modified_begin = modifiedBegin;
    if (modifiedEnd) payload.modified_end = modifiedEnd;
    return this.request('/open/sku/query', payload);
  }

  async queryBoms(
    skuIds: string[],
    pageIndex: number = 1,
    pageSize: number = 50,
  ): Promise<unknown> {
    const payload: Record<string, unknown> = {
      sku_ids: skuIds,
      page: {
        current_page: pageIndex,
        page_size: pageSize,
      },
    };
    return this.request('/open/webapi/itemapi/bom/getskubompagelist', payload);
  }

  getTokens() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
    };
  }

  updateTokens(accessToken: string, refreshToken?: string) {
    this.accessToken = accessToken;
    if (refreshToken) this.refreshToken = refreshToken;
  }

  async getInitToken(
    code: string,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const params: Record<string, unknown> = {
      app_key: this.appKey,
      code,
      grant_type: 'authorization_code',
      timestamp,
      charset: 'utf-8',
    };
    params.sign = this.sign(params);

    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      body.append(k, String(v));
    }

    try {
      const res = await fetch(`${this.baseUrl}/openWeb/auth/getInitToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const data = await res.json();

      if (data.code === 0 && data.data?.access_token) {
        this.accessToken = data.data.access_token;
        if (data.data.refresh_token) {
          this.refreshToken = data.data.refresh_token;
        }
        this.logger.log('Jushuitan init token obtained successfully');
        return { success: true, data: data.data };
      }

      return { success: false, error: data.msg || 'Unknown error', data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async refreshAccessToken(): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }> {
    if (!this.refreshToken) {
      return {
        success: false,
        error:
          'No refresh token configured. Set JUSHUITAN_REFRESH_TOKEN in .env or call getInitToken first.',
      };
    }

    const timestamp = String(Math.floor(Date.now() / 1000));
    const params: Record<string, unknown> = {
      app_key: this.appKey,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
      timestamp,
      charset: 'utf-8',
      scope: 'all',
    };
    params.sign = this.sign(params);

    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      body.append(k, String(v));
    }

    try {
      const res = await fetch(`${this.baseUrl}/openWeb/auth/refreshToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const data = await res.json();

      if (data.code === 0 && data.data?.access_token) {
        this.accessToken = data.data.access_token;
        if (data.data.refresh_token) {
          this.refreshToken = data.data.refresh_token;
        }
        this.logger.log('Jushuitan token refreshed successfully');
        return { success: true, data: data.data };
      }

      return { success: false, error: data.msg || 'Unknown error', data };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
