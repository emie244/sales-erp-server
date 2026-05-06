import axios from './axios';

export interface StockItem {
  skuId: string;
  warehouseId: string;
  availableQty: number;
  safetyStock: number;
  syncedAt: string;
  skuName?: string;
  productName?: string;
  skuCode?: string;
  pic?: string;
  status: 'normal' | 'warning' | 'danger';
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const fetchStocks = (params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  warehouseId?: string;
  status?: string;
}) =>
  axios.get('/stocks', { params }) as Promise<PaginatedResponse<StockItem>>;

export const fetchWarehouses = () =>
  axios.get('/stocks/warehouses') as Promise<string[]>;

export const updateSafetyStock = (
  skuId: string,
  warehouseId: string,
  safetyStock: number,
) =>
  axios.patch(`/stocks/${skuId}/${warehouseId}/safety-stock`, {
    safetyStock,
  }) as Promise<any>;
