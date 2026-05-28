import axios from './axios';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductionOrder {
  id: string;
  orderNo: string;
  bomId: string;
  skuId: string;
  skuName: string;
  qty: number;
  status: string;
  remark: string;
  creatorId: string;
  items: ProductionOrderItem[];
  createdAt: string;
}

export interface ProductionOrderItem {
  id: string;
  materialSkuId: string;
  materialSkuName: string;
  requiredQty: number;
  actualQty: number;
  remark: string;
}

export const fetchProductionOrders = (params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
  sortBy?: string;
}) =>
  axios.get('/production-orders', { params }) as Promise<PaginatedResponse<ProductionOrder>>;

export const fetchProductionOrderById = (id: string) =>
  axios.get(`/production-orders/${id}`) as Promise<ProductionOrder>;

export const createProductionOrder = (data: any) =>
  axios.post('/production-orders', data) as Promise<ProductionOrder>;

export const updateProductionOrder = (id: string, data: any) =>
  axios.put(`/production-orders/${id}`, data) as Promise<ProductionOrder>;

export const deleteProductionOrder = (id: string) =>
  axios.delete(`/production-orders/${id}`) as Promise<void>;

export const completeProductionOrder = (id: string, data?: { actualQty?: number }) =>
  axios.post(`/production-orders/${id}/complete`, data) as Promise<ProductionOrder>;
