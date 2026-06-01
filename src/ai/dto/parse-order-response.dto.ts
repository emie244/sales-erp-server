interface OrderDraftItem {
  productId: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  qty: number;
  unitPrice: number;
  lineAmount: number;
}

interface OrderDraft {
  customerId: string;
  customerName: string;
  type: 'sales' | 'overseas';
  items: OrderDraftItem[];
  deliveryDate: string | null;
  payAmount: number;
  totalAmount: number;
  remark: string | null;
}

export interface ParseOrderResponse {
  draft: OrderDraft | null;
  warnings: string[];
  missingFields: string[];
  confidence: 'high' | 'medium' | 'low';
}
