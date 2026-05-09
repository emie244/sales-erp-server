import axios from './axios';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PurchaseOrder {
  id: string;
  orderNo: string;
  supplierId: string;
  supplierName: string;
  status: string;
  totalAmount: number;
  remark: string;
  approvalInstanceCode: string;
  creatorId: string;
  items: PurchaseOrderItem[];
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  qty: number;
  receivedQty: number;
  unitPrice: number;
  lineAmount: number;
  remark: string;
}

export const fetchPurchaseOrders = (params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  supplierId?: string;
  keyword?: string;
}) =>
  axios.get('/purchase-orders', { params }) as Promise<PaginatedResponse<PurchaseOrder>>;

export const fetchPurchaseOrderById = (id: string) =>
  axios.get(`/purchase-orders/${id}`) as Promise<PurchaseOrder>;

export const createPurchaseOrder = (data: any) =>
  axios.post('/purchase-orders', data) as Promise<PurchaseOrder>;

export const updatePurchaseOrder = (id: string, data: any) =>
  axios.put(`/purchase-orders/${id}`, data) as Promise<PurchaseOrder>;

export const deletePurchaseOrder = (id: string) =>
  axios.delete(`/purchase-orders/${id}`) as Promise<void>;

export const submitPurchaseOrder = (id: string, data: {
  feishuUserId: string;
  approvalDefCode: string;
  feishuUserIdType?: string;
}) =>
  axios.post(`/purchase-orders/${id}/submit`, data) as Promise<any>;

export const receivePurchaseOrder = (id: string, data: { items: { itemId: string; receiveQty: number }[] }) =>
  axios.post(`/purchase-orders/${id}/receive`, data) as Promise<PurchaseOrder>;
