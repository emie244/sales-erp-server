import axios from './axios';
import type { ProductSku } from '@/types';

export const fetchProducts = () => axios.get('/products') as Promise<any[]>;

export const createProduct = (data: any) =>
  axios.post('/products', data) as Promise<any>;

export const fetchSkus = (productId?: string) =>
  axios.get('/products/skus', {
    params: productId ? { productId } : undefined,
  }) as Promise<ProductSku[]>;
