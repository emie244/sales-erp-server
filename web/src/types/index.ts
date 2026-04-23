export interface ApiResponse<T = any> {
  code: number;
  data: T;
  message: string;
}

export interface DeliveryOrder {
  id: string;
  salesOrderId: string;
  status: string;
  trackingNo?: string;
  carrier?: string;
  shippedAt?: string;
  createdAt: string;
}

export interface SalesOrder {
  id: string;
  customerId: string;
  customerName?: string;
  type?: string;
  signerId?: string;
  signerName?: string;
  creatorId?: string;
  creator?: { name?: string };
  customer?: { name?: string; prepaymentBalance?: number };
  signer?: { name?: string; jushuitanShopId?: string };
  payAmount: number;
  totalAmount: number;
  collectedAmount?: number;
  prepaymentDeducted?: number;
  paymentMethod?: string;
  collectionData?: {
    amount: number;
    prepaymentDeducted?: number;
    method: string;
    remark?: string;
    prepaymentRecordId?: string;
  } | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
  remark?: string;
  attachments?: string[];
  consignee?: string;
  consigneePhone?: string;
  consigneeTel?: string;
  consigneeProvince?: string;
  consigneeCity?: string;
  consigneeDistrict?: string;
  consigneeTown?: string;
  consigneeAddress?: string;
  logisticsCompany?: string;
  expressNo?: string;
  buyerMessage?: string;
  items?: SalesOrderItem[];
  approvalRecords?: ApprovalRecord[];
  deliveryOrders?: DeliveryOrder[];
}

export interface SalesOrderItem {
  id: string;
  productId: string;
  skuId: string;
  skuName: string;
  productName?: string;
  qty: number;
  unitPrice: number;
  discountAmount: number;
  lineAmount: number;
}

export interface ApprovalRecord {
  id: string;
  instanceCode: string;
  salesOrderId: string;
  status: string;
  feishuStatus: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  address?: string;
}

export interface ProductSku {
  id: string;
  skuCode: string;
  skuName: string;
  productId: string;
}

export interface PrepaymentRecord {
  id: string;
  customerId: string;
  customer?: { name?: string };
  amount: number;
  paymentMethod?: string;
  paymentDate?: string;
  receiptUrl?: string;
  remark?: string;
  status: string;
  approvalInstanceCode?: string;
  createdBy?: string;
  createdAt: string;
}
