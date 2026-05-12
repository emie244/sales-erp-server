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
  bomId?: string;
  supplierId?: string;
  supplierName?: string;
}

export const fetchPurchaseOrders = (params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  supplierId?: string;
  keyword?: string;
}) =>
  axios.get('/purchase-orders', { params }) as Promise<
    PaginatedResponse<PurchaseOrder>
  >;

export const fetchPurchaseOrderById = (id: string) =>
  axios.get(`/purchase-orders/${id}`) as Promise<PurchaseOrder>;

export const createPurchaseOrder = (data: any) =>
  axios.post('/purchase-orders', data) as Promise<PurchaseOrder>;

export const updatePurchaseOrder = (id: string, data: any) =>
  axios.put(`/purchase-orders/${id}`, data) as Promise<PurchaseOrder>;

export const deletePurchaseOrder = (id: string) =>
  axios.delete(`/purchase-orders/${id}`) as Promise<void>;

export const submitPurchaseOrder = (
  id: string,
  data: {
    feishuUserId: string;
    approvalDefCode: string;
    feishuUserIdType?: string;
  },
) => axios.post(`/purchase-orders/${id}/submit`, data) as Promise<any>;

export const receivePurchaseOrder = (
  id: string,
  data: { items: { itemId: string; receiveQty: number }[] },
) => axios.post(`/purchase-orders/${id}/receive`, data) as Promise<any>;

export const exportPurchaseOrders = async (params?: {
  status?: string;
  supplierId?: string;
  keyword?: string;
}) => {
  const res = await axios.get('/purchase-orders/export', {
    params,
    responseType: 'blob',
  });
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute(
    'download',
    `purchase-orders-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export interface PurchaseOrderStatusLog {
  id: string;
  purchaseOrderId: string;
  fromStatus: string | null;
  toStatus: string;
  operatorId: string | null;
  remark: string | null;
  createdAt: string;
}

export const fetchPurchaseOrderStatusLogs = (id: string) =>
  axios.get(`/purchase-orders/${id}/status-logs`) as Promise<
    PurchaseOrderStatusLog[]
  >;
