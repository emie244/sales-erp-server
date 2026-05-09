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
}) => axios.get('/purchase-orders', { params });

export const fetchPurchaseOrderById = (id: string) =>
  axios.get(`/purchase-orders/${id}`);

export const createPurchaseOrder = (data: any) =>
  axios.post('/purchase-orders', data);

export const updatePurchaseOrder = (id: string, data: any) =>
  axios.put(`/purchase-orders/${id}`, data);

export const deletePurchaseOrder = (id: string) =>
  axios.delete(`/purchase-orders/${id}`);

export const submitPurchaseOrder = (
  id: string,
  data: {
    feishuUserId: string;
    approvalDefCode: string;
    feishuUserIdType?: string;
  },
) => axios.post(`/purchase-orders/${id}/submit`, data);

export const receivePurchaseOrder = (
  id: string,
  data: { items: { itemId: string; receiveQty: number }[] },
) => axios.post(`/purchase-orders/${id}/receive`, data);

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
