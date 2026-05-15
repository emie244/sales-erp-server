import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeishuApprovalService } from './feishu-approval.service';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { PurchaseOrder } from '../purchase-orders/entities/purchase-order.entity';

export function safeString(value: unknown): string {
  if (value == null) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(safeString).join(',');
  }
  return JSON.stringify(value);
}

interface CachedDefinition {
  form: unknown[];
  expiresAt: number;
}

@Injectable()
export class ApprovalFormBuilder {
  private cache = new Map<string, CachedDefinition>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes - 缩短缓存时间以便模板修改快速生效

  constructor(
    private readonly feishu: FeishuApprovalService,
    private readonly config: ConfigService,
  ) {}

  private skipFeishu(): boolean {
    return this.config.get<string>('SKIP_FEISHU_APPROVAL') === 'true';
  }

  async build(approvalCode: string, order: SalesOrder): Promise<unknown[]> {
    const definition = await this.getDefinition(approvalCode);
    if (!definition.length) {
      if (this.skipFeishu()) {
        return [];
      }
      throw new Error('无法获取审批模板定义，请检查 approvalCode 是否正确');
    }

    const typeMap: Record<string, string> = {
      sales: '销售订单',
      overseas: '海外提货单',
    };

    const valuesByName: Record<string, unknown> = {
      订单类型: typeMap[order.type] || order.type,
      签单人: order.signer?.name || '',
      客户名称: order.customer?.name || '',
      收货人: order.consignee || '',
      收货电话: order.consigneePhone || '',
      收货地址: order.consigneeAddress || '',
      收款方式: order.paymentMethod || '',
      订单总金额: Number(order.totalAmount),
      应付金额: Number(order.payAmount),
      备注: order.remark || '无',
      商品清单: (order.items || []).map((i) => ({
        商品名称: i.productName || '',
        SKU: i.skuName || '',
        数量: Number(i.qty),
        单价: Number(i.unitPrice),
        折扣: Number(i.discountAmount || 0),
        小计: Number(i.lineAmount),
      })),
    };

    return definition
      .map((widget) => {
        const w = widget as Record<string, unknown>;
        return this.buildWidget(widget, valuesByName[w.name as string]);
      })
      .filter(Boolean);
  }

  async buildPrepaymentForm(
    approvalCode: string,
    data: {
      customerName: string;
      amount: number;
      paymentMethod?: string;
      paymentDate?: string;
      remark?: string;
      receiptFileTokens?: string[];
    },
  ): Promise<unknown[]> {
    const definition = await this.getDefinition(approvalCode);
    if (!definition.length) {
      if (this.skipFeishu()) {
        return [];
      }
      throw new Error('无法获取审批模板定义，请检查 approvalCode 是否正确');
    }

    const valuesByName: Record<string, unknown> = {
      客户名称: data.customerName,
      预付款金额: Number(data.amount),
      支付方式: data.paymentMethod || '',
      支付时间: data.paymentDate || '',
      收款凭证: data.receiptFileTokens || [],
      备注: data.remark || '-',
    };

    return definition
      .map((widget) => {
        const w = widget as Record<string, unknown>;
        return this.buildWidget(widget, valuesByName[w.name as string]);
      })
      .filter(Boolean);
  }

  async buildCollectionForm(
    approvalCode: string,
    data: {
      orderId: string;
      customerName: string;
      orderTotalAmount?: number;
      remainingAmount?: number;
      remark?: string;
      records: {
        amount: number;
        method: string;
        remark?: string;
        attachmentTokens?: string[];
      }[];
    },
  ): Promise<unknown[]> {
    const definition = await this.getDefinition(approvalCode);
    if (!definition.length) {
      if (this.skipFeishu()) {
        return [];
      }
      throw new Error('无法获取审批模板定义，请检查 approvalCode 是否正确');
    }

    const totalAmount = data.records.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0,
    );

    const methodMap: Record<string, string> = {
      bank_transfer: '银行转账',
      alipay: '支付宝',
      wechat: '微信',
      cash: '现金',
      prepayment: '预付款抵扣',
    };

    const normalizeMethod = (method: string): string => {
      const mapped = methodMap[method];
      if (mapped) return mapped;
      return method || '';
    };

    const valuesByName: Record<string, unknown> = {
      订单号: data.orderId,
      客户名称: data.customerName || '',
      订单金额: Number(data.orderTotalAmount || 0),
      剩余应收: Number(data.remainingAmount || 0),
      回款总额: totalAmount,
      收款明细: data.records.map((r) => ({
        回款方式: normalizeMethod(r.method || ''),
        金额: Number(r.amount || 0),
        备注: r.remark || '-',
        回款凭证: r.attachmentTokens || [],
      })),
      备注: data.remark || '-',
    };

    return definition
      .map((widget) => {
        const w = widget as Record<string, unknown>;
        return this.buildWidget(widget, valuesByName[w.name as string]);
      })
      .filter(Boolean);
  }

  async buildPurchaseOrderForm(
    approvalCode: string,
    order: PurchaseOrder,
  ): Promise<unknown[]> {
    const definition = await this.getDefinition(approvalCode);
    if (!definition.length) {
      if (this.skipFeishu()) {
        return [];
      }
      throw new Error('无法获取审批模板定义，请检查 approvalCode 是否正确');
    }

    const bomMap = (order as any).bomMap as Record<
      string,
      { skuId: string; version: string }
    >;
    const finishedProducts = [
      ...new Set(
        (order.items || [])
          .map((i) => i.bomId)
          .filter(Boolean)
          .map((bomId) => {
            const bom = bomMap?.[bomId];
            return bom ? `${bom.skuId} (BOM ${bom.version})` : null;
          })
          .filter(Boolean),
      ),
    ];

    const valuesByName: Record<string, unknown> = {
      订单类型: '采购订单',
      采购单号: order.orderNo,
      供应商: order.supplier?.name || order.supplierName || '',
      采购总金额: Number(order.totalAmount || 0),
      备注: order.remark || '无',
      成品清单: finishedProducts.join('; ') || '无',
      采购明细: (order.items || []).map((i) => ({
        所属成品: i.bomId ? bomMap?.[i.bomId]?.skuId || '-' : '-',
        SKU: i.skuName || i.skuCode || i.skuId,
        数量: Number(i.qty),
        单价: Number(i.unitPrice),
        小计: Number(i.lineAmount),
      })),
    };

    return definition
      .map((widget) => {
        const w = widget as Record<string, unknown>;
        return this.buildWidget(widget, valuesByName[w.name as string]);
      })
      .filter(Boolean);
  }

  async getDefinition(approvalCode: string): Promise<unknown[]> {
    if (this.skipFeishu()) {
      return [];
    }
    const cached = this.cache.get(approvalCode);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.form;
    }
    const form = await this.feishu.getApprovalDefinition(approvalCode);
    this.cache.set(approvalCode, { form, expiresAt: Date.now() + this.TTL_MS });
    return form;
  }

  private buildWidget(widget: unknown, value: unknown): unknown {
    const w = widget as Record<string, unknown>;
    const type = w.type as string;

    switch (type) {
      case 'input':
      case 'textarea':
        return {
          id: w.id,
          type,
          value: value != null ? safeString(value) : '',
        };

      case 'number':
        return {
          id: w.id,
          type,
          value: value != null ? Number(value) : 0,
        };

      case 'amount':
        return {
          id: w.id,
          type,
          value: value != null ? Number(value) : 0,
          currency: w.currency || 'CNY',
        };

      case 'fieldList':
        return {
          id: w.id,
          type,
          value: this.buildDetailRows(
            (w.children as unknown[]) || [],
            value as unknown[],
          ),
        };

      case 'radioV2':
      case 'radio':
        return {
          id: w.id,
          type: 'radioV2',
          value: this.mapOptionValue(widget, value),
        };

      case 'checkboxV2':
      case 'checkbox':
        return {
          id: w.id,
          type: 'checkboxV2',
          value: Array.isArray(value)
            ? value.map((v) => this.mapOptionValue(widget, v))
            : value != null
              ? [this.mapOptionValue(widget, value)]
              : [],
        };

      case 'date':
        return {
          id: w.id,
          type,
          value: value != null ? safeString(value) : '',
        };

      case 'dateInterval':
        return {
          id: w.id,
          type,
          value: value || { start: '', end: '', interval: 0 },
        };

      case 'contact':
        return {
          id: w.id,
          type,
          value: Array.isArray(value) ? value.map(safeString) : [],
        };

      case 'department':
        return {
          id: w.id,
          type,
          value: Array.isArray(value) ? value : [],
        };

      case 'image':
      case 'imageV2': {
        const imageValue = Array.isArray(value) ? value : [];
        if (!imageValue.length) return null;
        return { id: w.id, type: 'image', value: imageValue };
      }

      case 'attachment':
      case 'attachmentV2': {
        const attachValue = Array.isArray(value) ? value : [];
        if (!attachValue.length) return null;
        return { id: w.id, type: 'attachmentV2', value: attachValue };
      }

      case 'telephone':
        return {
          id: w.id,
          type,
          value: value || { countryCode: '+86', nationalNumber: '' },
        };

      case 'address':
        return {
          id: w.id,
          type,
          value: Array.isArray(value) ? value : [],
        };

      default:
        // Fallback for unknown types: pass as-is stringified
        return { id: w.id, type, value: value != null ? value : '' };
    }
  }

  private mapOptionValue(widget: unknown, value: unknown): string {
    if (value == null) return '';
    const w = widget as Record<string, unknown>;
    const options = (w.option || w.options || []) as Record<string, unknown>[];
    if (!options.length) return safeString(value);
    const found = options.find((o) => o.text === safeString(value));
    return found ? (found.value as string) : safeString(value);
  }

  private buildDetailRows(children: unknown[], rows: unknown[]): unknown[][] {
    if (!Array.isArray(rows) || !rows.length) {
      return [];
    }
    return rows.map((row) =>
      children.map((child) => {
        const r = row as Record<string, unknown>;
        const c = child as Record<string, unknown>;
        return this.buildWidget(child, r[c.name as string]);
      }),
    );
  }
}
