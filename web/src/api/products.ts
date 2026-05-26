import axios from './axios';
import type { Product, ProductSku } from '@/types';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const fetchProducts = (params?: { page?: number; pageSize?: number }) =>
  axios.get('/products', { params }) as Promise<PaginatedResponse<Product>>;

export const fetchAllSkus = (params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  governance?: 'uncategorized' | 'item_type_null' | 'non_compliant';
}) =>
  axios.get('/products/all-skus', { params }) as Promise<
    PaginatedResponse<ProductSku>
  >;

export const batchUpdateSkuCategory = (data: {
  skuIds: string[];
  materialCategoryId: string;
}) => axios.post('/products/skus/batch-category', data) as Promise<void>;

export const createProduct = (data: any) =>
  axios.post('/products', data) as Promise<Product>;

export const fetchSkus = (productId?: string) =>
  axios.get('/products/skus', {
    params: productId ? { productId } : undefined,
  }) as Promise<ProductSku[]>;

export const fetchSkuById = (skuId: string) =>
  axios.get(`/products/skus/${skuId}`) as Promise<ProductSku>;

export const updateProduct = (id: string, data: any) =>
  axios.patch(`/products/${id}`, data) as Promise<Product>;

export const updateSku = (skuId: string, data: { floorPrice?: number }) =>
  axios.patch(`/products/skus/${skuId}`, data) as Promise<ProductSku>;

export const syncJushuitan = () =>
  axios.post('/products/sync-jushuitan') as Promise<any>;

export const exportProducts = async () => {
  const res = await axios.get('/products/export', { responseType: 'blob' });
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute(
    'download',
    `products-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
