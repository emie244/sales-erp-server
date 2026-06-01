import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

interface CustomerInfo {
  id: string;
  name: string;
}

interface SkuInfo {
  id: string;
  productId: string;
  skuName: string | null;
  skuCode: string | null;
  productName: string;
  salePrice: number | null;
  floorPrice: number | null;
}

interface ParsedItem {
  productName: string;
  skuName: string | null;
  qty: number;
  unitPrice: number | null;
}

interface ParsedOrder {
  customerName: string;
  items: ParsedItem[];
  deliveryDate: string | null;
  remark: string | null;
  orderType: 'sales' | 'overseas';
}

export interface OrderDraftItem {
  productId: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  qty: number;
  unitPrice: number;
  lineAmount: number;
}

export interface OrderDraft {
  customerId: string;
  customerName: string;
  type: 'sales' | 'overseas';
  items: OrderDraftItem[];
  deliveryDate: string | null;
  payAmount: number;
  totalAmount: number;
  remark: string | null;
}

@Injectable()
export class AiService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  // ============ 自然语言解析订单 ============

  async parseOrder(
    text: string,
    tenantId?: string,
  ): Promise<{
    draft: OrderDraft | null;
    warnings: string[];
    missingFields: string[];
    confidence: 'high' | 'medium' | 'low';
  }> {
    const [customers, skus] = await Promise.all([
      this.getCustomerList(tenantId),
      this.getSkuList(tenantId),
    ]);

    const prompt = this.buildPrompt(text, customers, skus);
    const rawJson = await this.callClaude(prompt);

    let parsed: ParsedOrder;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new BadRequestException('AI 解析失败，返回了非法的 JSON');
    }

    // 基础校验
    if (!parsed.customerName || !parsed.items?.length) {
      return {
        draft: null,
        warnings: ['未能识别出客户或商品信息'],
        missingFields: [],
        confidence: 'low',
      };
    }

    // 模糊匹配客户
    const customer = this.fuzzyMatchCustomer(parsed.customerName, customers);
    if (!customer) {
      return {
        draft: null,
        warnings: [`未找到客户「${parsed.customerName}」`],
        missingFields: [],
        confidence: 'low',
      };
    }

    // 模糊匹配 SKU
    const draftItems: OrderDraftItem[] = [];
    const warnings: string[] = [];
    const missingFields: string[] = [];

    for (const item of parsed.items) {
      const sku = this.fuzzyMatchSku(
        item.productName + (item.skuName ? ' ' + item.skuName : ''),
        skus,
      );
      if (!sku) {
        warnings.push(`未找到 SKU「${item.productName} ${item.skuName || ''}」`);
        continue;
      }

      const qty = Number(item.qty) || 1;
      let unitPrice = Number(item.unitPrice) || sku.salePrice || 0;

      // 底价检查
      if (sku.floorPrice && unitPrice < sku.floorPrice) {
        warnings.push(
          `SKU「${sku.productName} ${sku.skuName || sku.skuCode}」报价 ¥${unitPrice} 低于底价 ¥${sku.floorPrice}，已自动调整为底价`,
        );
        unitPrice = sku.floorPrice;
      }

      draftItems.push({
        productId: sku.productId,
        skuId: sku.id,
        skuCode: sku.skuCode || '',
        skuName: sku.skuName || sku.skuCode || '',
        qty,
        unitPrice,
        lineAmount: qty * unitPrice,
      });
    }

    if (draftItems.length === 0) {
      return {
        draft: null,
        warnings,
        missingFields,
        confidence: 'low',
      };
    }

    if (!parsed.deliveryDate) {
      missingFields.push('deliveryDate');
    }

    const totalAmount = draftItems.reduce((s, it) => s + it.lineAmount, 0);

    const draft: OrderDraft = {
      customerId: customer.id,
      customerName: customer.name,
      type: parsed.orderType || 'sales',
      items: draftItems,
      deliveryDate: parsed.deliveryDate,
      payAmount: totalAmount,
      totalAmount,
      remark: parsed.remark || null,
    };

    // 库存检查
    const stockWarnings = await this.checkStock(draftItems);
    warnings.push(...stockWarnings);

    // 信用检查
    const creditWarning = await this.checkCredit(customer.id, totalAmount);
    if (creditWarning) warnings.push(creditWarning);

    const confidence =
      warnings.length === 0 && missingFields.length === 0
        ? 'high'
        : warnings.length <= 2 && missingFields.length <= 1
          ? 'medium'
          : 'low';

    return { draft, warnings, missingFields, confidence };
  }

  // ============ 客户推荐 ============

  async getRecommendations(customerId: string, tenantId?: string) {
    const customer = await this.dataSource
      .getRepository('Customer')
      .findOne({ where: { id: customerId } });

    // Top SKU 聚合
    const topSkus = await this.dataSource.query(
      `
      SELECT
        soi.sku_id as "skuId",
        soi.sku_name as "skuName",
        soi.sku_code as "skuCode",
        MAX(soi.product_id) as "productId",
        SUM(soi.qty) as "totalQty",
        COUNT(DISTINCT soi.order_id) as "orderCount",
        AVG(soi.unit_price) as "avgPrice",
        MAX(so.created_at) as "lastOrderDate"
      FROM sales_order_items soi
      JOIN sales_orders so ON so.id = soi.order_id
      WHERE so.customer_id = $1
        AND so.status NOT IN ('draft', 'cancelled')
      GROUP BY soi.sku_id, soi.sku_name, soi.sku_code
      ORDER BY SUM(soi.qty) DESC
      LIMIT 10
      `,
      [customerId],
    );

    // 补充库存和价格信息
    const enriched = await Promise.all(
      topSkus.map(async (s: any) => {
        const stock = await this.dataSource.query(
          `SELECT COALESCE(SUM(qty), 0) as qty FROM local_stock_balances WHERE sku_id = $1`,
          [s.skuId],
        );
        return {
          ...s,
          stockQty: Number(stock[0]?.qty || 0),
          totalQty: Number(s.totalQty || 0),
          orderCount: Number(s.orderCount || 0),
          avgPrice: Number(Number(s.avgPrice || 0).toFixed(2)),
        };
      }),
    );

    // 信用状态
    const creditUsed = await this.dataSource.query(
      `
      SELECT COALESCE(SUM(pay_amount - collected_amount - prepayment_deducted), 0) as used
      FROM sales_orders
      WHERE customer_id = $1 AND status NOT IN ('completed', 'cancelled')
      `,
      [customerId],
    );

    return {
      creditStatus: {
        creditLimit: Number(customer?.creditLimit || 0),
        usedCredit: Number(creditUsed[0]?.used || 0),
        isBlocked: !!customer?.isCreditBlocked,
      },
      topSkus: enriched,
    };
  }

  // ============ 内部方法 ============

  private async getCustomerList(tenantId?: string): Promise<CustomerInfo[]> {
    const qb = this.dataSource
      .getRepository('Customer')
      .createQueryBuilder('c')
      .select(['c.id', 'c.name'])
      .where("c.customerStatus IN ('active', 'lead')")
      .orderBy('c.name', 'ASC')
      .limit(200);

    if (tenantId) qb.andWhere('c.tenantId = :tenantId', { tenantId });

    return qb.getMany() as Promise<CustomerInfo[]>;
  }

  private async getSkuList(tenantId?: string): Promise<SkuInfo[]> {
    const qb = this.dataSource
      .createQueryBuilder()
      .select([
        'ps.id',
        'ps.skuName',
        'ps.skuCode',
        'p.name',
        'p.id',
        'ps.salePrice',
        'ps.floorPrice',
      ])
      .from('product_skus', 'ps')
      .leftJoin('products', 'p', 'p.id = ps.product_id')
      .where('ps.isActive = true')
      .orderBy('p.name', 'ASC')
      .limit(300);

    if (tenantId) qb.andWhere('p.tenantId = :tenantId', { tenantId });

    const rows = await qb.getRawMany();
    return rows.map((r: any) => ({
      id: r.ps_id,
      skuName: r.ps_skuName,
      skuCode: r.ps_skuCode,
      productName: r.p_name,
      productId: r.p_id,
      salePrice: r.ps_salePrice ? Number(r.ps_salePrice) : null,
      floorPrice: r.ps_floorPrice ? Number(r.ps_floorPrice) : null,
    }));
  }

  private buildPrompt(
    text: string,
    customers: CustomerInfo[],
    skus: SkuInfo[],
  ): { system: string; user: string } {
    const today = new Date().toISOString().split('T')[0];

    const system = `你是 ERP 销售订单解析助手。将用户的自然语言描述解析为结构化的 JSON。

## 输出格式（严格 JSON）
{
  "customerName": "客户名称（保持用户原文）",
  "items": [
    {
      "productName": "产品名称",
      "skuName": "规格/型号名称，没有则 null",
      "qty": 数量（纯数字，没有则 1）,
      "unitPrice": 单价（纯数字，元，没有则 null）
    }
  ],
  "deliveryDate": "交货日期（YYYY-MM-DD 格式，没有则 null）",
  "remark": "备注，没有则 null",
  "orderType": "sales（默认）或 overseas"
}

## 解析规则
1. 数量：从"500个"提取 500，从"一千件"提取 1000
2. 价格：从"单价45元"提取 45，从"45块"提取 45
3. 日期："6月15日"→当年6月15日；"下周三"→具体日期；"明天"→明天日期
4. 如果用户说"按照上次再来一单"，items 留空，remark 写"复用上次的订单"
5. 不要编造产品名称，保持用户原文中的名称
6. 如果没有提到具体规格型号，skuName 设为 null

## 当前日期
今天是：${today}`;

    const customerList = customers.map((c) => `- ${c.name}`).join('\n');
    const skuList = skus
      .map((s) => `- ${s.productName} ${s.skuName || s.skuCode || ''}`.trim())
      .join('\n');

    const user = `## 用户输入
${text}

## 可用客户列表（请从中匹配）
${customerList}

## 可用 SKU 列表（请从中匹配）
${skuList}

请解析上述输入，输出 JSON。`;

    return { system, user };
  }

  private async callClaude(prompt: {
    system: string;
    user: string;
  }): Promise<string> {
    const apiKey = this.config.get<string>('AI_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('AI 服务未配置，请设置 AI_API_KEY 环境变量');
    }

    const model = this.config.get<string>('AI_MODEL') || 'claude-3-5-sonnet-20241022';
    const maxTokens = Number(this.config.get('AI_MAX_TOKENS')) || 2000;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.1,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new BadRequestException(`AI 服务调用失败: ${err}`);
    }

    const data = (await res.json()) as any;
    const content = data.content?.[0]?.text || '';

    // 尝试从 markdown code block 中提取 JSON
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) return jsonMatch[1].trim();

    // 否则直接返回内容（假设已经是 JSON）
    return content.trim();
  }

  private fuzzyMatchCustomer(
    name: string,
    customers: CustomerInfo[],
  ): CustomerInfo | null {
    const input = name.trim().toLowerCase();

    // 1. 精确匹配
    let match = customers.find((c) => c.name.toLowerCase() === input);
    if (match) return match;

    // 2. 输入包含在客户名中
    match = customers.find((c) => c.name.toLowerCase().includes(input));
    if (match) return match;

    // 3. 客户名包含在输入中
    match = customers.find((c) => input.includes(c.name.toLowerCase()));
    if (match) return match;

    return null;
  }

  private fuzzyMatchSku(nameHint: string, skus: SkuInfo[]): SkuInfo | null {
    const input = nameHint.trim().toLowerCase().replace(/\s+/g, '');

    // 1. 精确匹配 skuCode
    let match = skus.find((s) => s.skuCode?.toLowerCase() === input);
    if (match) return match;

    // 2. 组合名称精确匹配
    const fullNames = skus.map((s) => ({
      sku: s,
      full: (s.productName + (s.skuName || '')).toLowerCase().replace(/\s+/g, ''),
    }));
    match = fullNames.find((f) => f.full === input)?.sku;
    if (match) return match;

    // 3. 包含匹配
    match = fullNames.find((f) => f.full.includes(input))?.sku;
    if (match) return match;

    // 4. 输入包含在组合名称中
    match = fullNames.find((f) => input.includes(f.full))?.sku;
    if (match) return match;

    return null;
  }

  private async checkStock(items: OrderDraftItem[]): Promise<string[]> {
    const warnings: string[] = [];
    for (const item of items) {
      const stock = await this.dataSource.query(
        `SELECT COALESCE(SUM(qty), 0) as qty FROM local_stock_balances WHERE sku_id = $1`,
        [item.skuId],
      );
      const qty = Number(stock[0]?.qty || 0);
      if (qty < item.qty) {
        warnings.push(
          `SKU「${item.skuName}」库存不足：当前库存 ${qty}，需求 ${item.qty}`,
        );
      }
    }
    return warnings;
  }

  private async checkCredit(
    customerId: string,
    orderAmount: number,
  ): Promise<string | null> {
    const customer = await this.dataSource
      .getRepository('Customer')
      .findOne({ where: { id: customerId } });

    if (customer?.isCreditBlocked) {
      return '该客户已被信用冻结';
    }

    const creditUsed = await this.dataSource.query(
      `
      SELECT COALESCE(SUM(pay_amount - collected_amount - prepayment_deducted), 0) as used
      FROM sales_orders
      WHERE customer_id = $1 AND status NOT IN ('completed', 'cancelled')
      `,
      [customerId],
    );

    const used = Number(creditUsed[0]?.used || 0);
    const limit = Number(customer?.creditLimit || 0);

    if (limit > 0 && used + orderAmount > limit) {
      return `信用额度预警：已用 ¥${used.toFixed(2)}，本次订单 ¥${orderAmount.toFixed(2)}，超出额度 ¥${(used + orderAmount - limit).toFixed(2)}`;
    }

    return null;
  }
}
