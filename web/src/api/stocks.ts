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
}) => axios.get('/stocks', { params }) as Promise<PaginatedResponse<StockItem>>;

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

export interface LocalStockBalance {
  id: string;
  skuId: string;
  qty: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockLedgerEntry {
  id: string;
  skuId: string;
  type: 'inbound' | 'outbound';
  qty: number;
  referenceType: string;
  referenceId: string;
  beforeQty: number;
  afterQty: number;
  remark?: string;
  createdAt: string;
}

export const fetchLocalBalances = (params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}) =>
  axios.get('/stocks/local-balances', { params }) as Promise<
    PaginatedResponse<LocalStockBalance>
  >;

export const fetchLedgerBySku = (
  skuId: string,
  params?: { page?: number; pageSize?: number },
) =>
  axios.get(`/stocks/ledger/${skuId}`, { params }) as Promise<
    PaginatedResponse<StockLedgerEntry>
  >;
