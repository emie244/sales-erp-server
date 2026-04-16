export interface ApiResponse<T = any> {
  code: number;
  data: T;
  message: string;
}

export interface SalesOrder {
  id: string;
  customerId: string;
  customerName?: string;
  payAmount: number;
  status: string;
  createdAt: string;
  items: SalesOrderItem[];
}

export interface SalesOrderItem {
  id: string;
  skuId: string;
  skuName: string;
  qty: number;
  unitPrice: number;
  lineAmount: number;
}

export interface ApprovalRecord {
  id: string;
  instanceCode: string;
  salesOrderId: string;
  status: string;
  feishuStatus: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
}

export interface ProductSku {
  id: string;
  skuCode: string;
  skuName: string;
  productId: string;
}
