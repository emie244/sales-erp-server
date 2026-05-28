import axios from './axios';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PurchaseRequest {
  id: string;
  prNo: string;
  salesOrderId?: string | null;
  status: string;
  totalAmount: number;
  remark?: string;
  creatorId?: string;
  convertedPoId?: string | null;
  items?: PurchaseRequestItem[];
  createdAt: string;
}

export interface PurchaseRequestItem {
  id: string;
  purchaseRequestId: string;
  skuId: string;
  skuCode?: string;
  skuName?: string;
  qty: number;
  estimatedUnitPrice?: number | null;
  supplierId?: string | null;
  supplierName?: string | null;
  bomId?: string | null;
  remark?: string;
}

export const fetchPurchaseRequests = (params?: {
  status?: string;
  salesOrderId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
}) =>
  axios.get('/purchase-requests', { params }) as Promise<
    PaginatedResponse<PurchaseRequest>
  >;

export const fetchPurchaseRequestById = (id: string) =>
  axios.get(`/purchase-requests/${id}`) as Promise<PurchaseRequest>;

export const createPurchaseRequest = (data: Partial<PurchaseRequest>) =>
  axios.post('/purchase-requests', data) as Promise<PurchaseRequest>;

export const updatePurchaseRequest = (id: string, data: Partial<PurchaseRequest>) =>
  axios.put(`/purchase-requests/${id}`, data) as Promise<PurchaseRequest>;

export const deletePurchaseRequest = (id: string) =>
  axios.delete(`/purchase-requests/${id}`) as Promise<{ id: string }>;

export const convertPurchaseRequestToPo = (id: string) =>
  axios.post(`/purchase-requests/${id}/convert-to-po`) as Promise<{
    prId: string;
    poIds: string[];
  }>;
