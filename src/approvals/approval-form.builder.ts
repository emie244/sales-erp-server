import { Injectable } from '@nestjs/common';
import { FeishuApprovalService } from './feishu-approval.service';
import { SalesOrder } from '../sales/entities/sales-order.entity';

interface CachedDefinition {
  form: any[];
  expiresAt: number;
}

@Injectable()
export class ApprovalFormBuilder {
  private cache = new Map<string, CachedDefinition>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes - 缩短缓存时间以便模板修改快速生效

  constructor(private readonly feishu: FeishuApprovalService) {}

  async build(approvalCode: string, order: SalesOrder): Promise<any[]> {
    const definition = await this.getDefinition(approvalCode);
    if (!definition.length) {
      throw new Error('无法获取审批模板定义，请检查 approvalCode 是否正确');
    }

    const typeMap: Record<string, string> = {
      sales: '销售订单',
      overseas: '海外提货单',
    };

    const valuesByName: Record<string, any> = {
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

    return definition.map((widget) =>
      this.buildWidget(widget, valuesByName[widget.name]),
    );
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
  ): Promise<any[]> {
    const definition = await this.getDefinition(approvalCode);
    if (!definition.length) {
      throw new Error('无法获取审批模板定义，请检查 approvalCode 是否正确');
    }

    const valuesByName: Record<string, any> = {
      客户名称: data.customerName,
      预付款金额: Number(data.amount),
      支付方式: data.paymentMethod || '',
      支付时间: data.paymentDate || '',
      收款凭证: data.receiptFileTokens || [],
      备注: data.remark || '-',
    };

    return definition.map((widget) =>
      this.buildWidget(widget, valuesByName[widget.name]),
    );
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
  ): Promise<any[]> {
    const definition = await this.getDefinition(approvalCode);
    if (!definition.length) {
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

    const valuesByName: Record<string, any> = {
      订单号: data.orderId,
      客户名称: data.customerName || '',
      订单金额: Number(data.orderTotalAmount || 0),
      剩余应收: Number(data.remainingAmount || 0),
      回款总额: totalAmount,
      收款明细: data.records.map((r) => ({
        回款方式: methodMap[r.method] || r.method || '',
        金额: Number(r.amount || 0),
        备注: r.remark || '-',
        回款凭证: r.attachmentTokens || [],
      })),
      备注: data.remark || '-',
    };

    return definition.map((widget) =>
      this.buildWidget(widget, valuesByName[widget.name]),
    );
  }

  async getDefinition(approvalCode: string): Promise<any[]> {
    const cached = this.cache.get(approvalCode);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.form;
    }
    const form = await this.feishu.getApprovalDefinition(approvalCode);
    this.cache.set(approvalCode, { form, expiresAt: Date.now() + this.TTL_MS });
    return form;
  }

  private buildWidget(widget: any, value: any): any {
    const type = widget.type;

    switch (type) {
      case 'input':
      case 'textarea':
        return {
          id: widget.id,
          type,
          value: value != null ? String(value) : '',
        };

      case 'number':
        return {
          id: widget.id,
          type,
          value: value != null ? Number(value) : 0,
        };

      case 'amount':
        return {
          id: widget.id,
          type,
          value: value != null ? Number(value) : 0,
          currency: widget.currency || 'CNY',
        };

      case 'fieldList':
        return {
          id: widget.id,
          type,
          value: this.buildDetailRows(widget.children || [], value),
        };

      case 'radioV2':
      case 'radio':
        return {
          id: widget.id,
          type: 'radioV2',
          value: this.mapOptionValue(widget, value),
        };

      case 'checkboxV2':
      case 'checkbox':
        return {
          id: widget.id,
          type: 'checkboxV2',
          value: Array.isArray(value)
            ? value.map((v) => this.mapOptionValue(widget, v))
            : value != null
              ? [this.mapOptionValue(widget, value)]
              : [],
        };

      case 'date':
        return {
          id: widget.id,
          type,
          value: value != null ? String(value) : '',
        };

      case 'dateInterval':
        return {
          id: widget.id,
          type,
          value: value || { start: '', end: '', interval: 0 },
        };

      case 'contact':
        return {
          id: widget.id,
          type,
          value: Array.isArray(value) ? value.map(String) : [],
        };

      case 'department':
        return {
          id: widget.id,
          type,
          value: Array.isArray(value) ? value : [],
        };

      case 'image':
      case 'imageV2':
        return {
          id: widget.id,
          type: 'image',
          value: Array.isArray(value) ? value : [],
        };

      case 'attachment':
      case 'attachmentV2':
        return {
          id: widget.id,
          type: 'attachmentV2',
          value: Array.isArray(value) ? value : [],
        };

      case 'telephone':
        return {
          id: widget.id,
          type,
          value: value || { countryCode: '+86', nationalNumber: '' },
        };

      case 'address':
        return {
          id: widget.id,
          type,
          value: Array.isArray(value) ? value : [],
        };

      default:
        // Fallback for unknown types: pass as-is stringified
        return { id: widget.id, type, value: value != null ? value : '' };
    }
  }

  private mapOptionValue(widget: any, value: any): string {
    if (value == null) return '';
    const options: any[] = widget.option || widget.options || [];
    if (!options.length) return String(value);
    const found = options.find((o) => o.text === String(value));
    return found ? found.value : String(value);
  }

  private buildDetailRows(children: any[], rows: any[]): any[][] {
    if (!Array.isArray(rows) || !rows.length) {
      return [];
    }
    return rows.map((row) =>
      children.map((child) => this.buildWidget(child, row[child.name])),
    );
  }
}
