import axios from './axios';

export interface BomItem {
  id?: string;
  materialSkuId: string;
  qty: number;
  lossRate: number;
  sortOrder: number;
  materialCategoryId?: string;
  materialCategoryName?: string;
  remark?: string;
}

export interface BomHeader {
  id: string;
  productId: string;
  skuId: string;
  skuName?: string;
  skuCode?: string;
  productName?: string;
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
  sortBy?: string;
}) => axios.get('/boms', { params }) as Promise<PaginatedResponse<BomHeader>>;

export const fetchBomById = (id: string) =>
  axios.get(`/boms/${id}`) as Promise<BomHeader>;

export const fetchBomsBySku = (skuId: string) =>
  axios.get(`/boms/sku/${encodeURIComponent(skuId)}`) as Promise<BomHeader[]>;

export const fetchBomsWithStockStatus = (skuId: string) =>
  axios.get(`/boms/sku/${encodeURIComponent(skuId)}/with-stock`) as Promise<
    (BomHeader & {
      maxProduceQty: number;
      hasStock: boolean;
      items: (BomItem & { stockQty: number; maxQty: number })[];
    })[]
  >;

export const createBom = (data: {
  productId: string;
  skuId: string;
  version?: string;
  remark?: string;
  items: BomItem[];
}) => axios.post('/boms', data) as Promise<BomHeader>;

export const updateBom = (
  id: string,
  data: {
    version?: string;
    remark?: string;
    items: BomItem[];
  },
) => axios.patch(`/boms/${id}`, data) as Promise<BomHeader>;

export const deleteBom = (id: string) =>
  axios.delete(`/boms/${id}`) as Promise<any>;

export const cloneBom = (id: string, version?: string) =>
  axios.post(`/boms/${id}/clone`, { version }) as Promise<BomHeader>;

export const toggleBomActive = (id: string) =>
  axios.patch(`/boms/${id}/toggle-active`) as Promise<BomHeader>;

export const calculateRequirements = (
  items: { skuId: string; qty: number }[],
) => axios.post('/boms/calculate-requirements', { items }) as Promise<any>;

export const fetchProducibleProducts = () =>
  axios.get('/boms/producible/products') as Promise<
    { id: string; name: string; jstGoodsId: string }[]
  >;

export const fetchMaxProducibleQty = (bomId: string) =>
  axios.get(`/boms/${bomId}/max-producible-qty`) as Promise<{
    maxQty: number;
    materials: {
      materialSkuId: string;
      qty: number;
      lossRate: number;
      totalReceived: number;
      perUnitNeed: number;
      maxQty: number;
    }[];
  }>;
