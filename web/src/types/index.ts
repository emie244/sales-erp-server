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

export interface PaymentRecord {
  id: string;
  salesOrderId: string;
  amount: number;
  method: string;
  receivedAt: string;
  receivedBy: string;
  remark?: string;
  type: string;
  attachments?: string[];
  createdAt: string;
}

export interface SalesOrder {
  id: string;
  customerId: string;
  customerName?: string;
  type?: string;
  salespersonId?: string;
  salespersonName?: string;
  creatorId?: string;
  creator?: { name?: string };
  customer?: { name?: string; prepaymentBalance?: number };
  salesperson?: { name?: string; jushuitanShopId?: string };
  payAmount: number;
  totalAmount: number;
  collectedAmount?: number;
  prepaymentDeducted?: number;
  paymentMethod?: string;
  collectionData?: {
    records: {
      amount: number;
      method: string;
      remark?: string;
      attachments?: string[];
    }[];
    originalStatus?: string;
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
  paymentRecords?: PaymentRecord[];
}

export interface SalesOrderItem {
  id: string;
  productId: string;
  skuId: string;
  skuName: string;
  skuCode?: string;
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
  type: string;
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

export type ProductLifecycleStage =
  | 'concept'
  | 'launching'
  | 'new'
  | 'growth'
  | 'mature'
  | 'decline'
  | 'discontinued';

export type ItemType =
  | 'finished_good'
  | 'semi_finished'
  | 'raw_material'
  | 'packaging';

export interface ProductSku {
  id: string;
  skuCode: string;
  skuName?: string;
  barcode?: string;
  spec?: string;
  weight?: number;
  isActive: boolean;
  productId: string;
  product?: {
    name: string;
    category?: string;
    launchDate?: string;
    lifecycleStage?: ProductLifecycleStage | null;
    inferredLifecycleStage?: ProductLifecycleStage;
  };
  jstSkuId?: string;
  pic?: string;
  localPic?: string;
  propertiesValue?: string;
  category?: string;
  brand?: string;
  salePrice?: number | null;
  costPrice?: number | null;
  itemType?: ItemType | null;
  materialCategoryId?: string | null;
  materialCategoryName?: string | null;
  codeCompliant?: boolean;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  category?: string;
  isActive: boolean;
  skus?: ProductSku[];
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
  updatedAt?: string;
}
