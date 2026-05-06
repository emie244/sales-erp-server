import axios from './axios';
import type { ProductSku } from '@/types';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const fetchProducts = (params?: { page?: number; pageSize?: number }) =>
  axios.get('/products', { params }) as Promise<PaginatedResponse<any>>;

export const fetchAllSkus = (params?: { page?: number; pageSize?: number; keyword?: string; status?: string }) =>
  axios.get('/products/all-skus', { params }) as Promise<
    PaginatedResponse<any>
  >;

export const createProduct = (data: any) =>
  axios.post('/products', data) as Promise<any>;

export const fetchSkus = (productId?: string) =>
  axios.get('/products/skus', {
    params: productId ? { productId } : undefined,
  }) as Promise<ProductSku[]>;

export const fetchSkuById = (skuId: string) =>
  axios.get(`/products/skus/${skuId}`) as Promise<ProductSku>;

export const syncJushuitan = () =>
  axios.post('/products/sync-jushuitan') as Promise<{ message: string }>;
