import axios from './axios';

export interface BomItem {
  id?: string;
  materialSkuId: string;
  qty: number;
  lossRate: number;
  sortOrder: number;
  remark?: string;
}

export interface BomHeader {
  id: string;
  productId: string;
  skuId: string;
  version: string;
  isActive: boolean;
  remark?: string;
  createdAt: string;
  updatedAt?: string;
  items: BomItem[];
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const fetchBoms = (params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  productId?: string;
  skuId?: string;
}) =>
  axios.get('/boms', { params }) as Promise<PaginatedResponse<BomHeader>>;

export const fetchBomById = (id: string) =>
  axios.get(`/boms/${id}`) as Promise<BomHeader>;

export const createBom = (data: {
  productId: string;
  skuId: string;
  version?: string;
  remark?: string;
  items: BomItem[];
}) => axios.post('/boms', data) as Promise<BomHeader>;

export const updateBom = (id: string, data: {
  version?: string;
  remark?: string;
  items: BomItem[];
}) => axios.patch(`/boms/${id}`, data) as Promise<BomHeader>;

export const deleteBom = (id: string) =>
  axios.delete(`/boms/${id}`) as Promise<any>;

export const calculateRequirements = (items: { skuId: string; qty: number }[]) =>
  axios.post('/boms/calculate-requirements', { items }) as Promise<any>;
