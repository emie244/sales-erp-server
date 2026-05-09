import axios from './axios';
import type { ProductSku } from '@/types';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const fetchProducts = (params?: { page?: number; pageSize?: number }) =>
  axios.get('/products', { params });

export const fetchAllSkus = (params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
}) => axios.get('/products/all-skus', { params });

export const createProduct = (data: any) => axios.post('/products', data);

export const fetchSkus = (productId?: string) =>
  axios.get('/products/skus', {
    params: productId ? { productId } : undefined,
  });

export const fetchSkuById = (skuId: string) =>
  axios.get(`/products/skus/${skuId}`);

export const updateProduct = (id: string, data: any) =>
  axios.patch(`/products/${id}`, data);

export const syncJushuitan = () => axios.post('/products/sync-jushuitan');

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
