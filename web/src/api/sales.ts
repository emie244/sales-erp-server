import axios from './axios';
import type { SalesOrder } from '@/types';

export const fetchSalesOrders = (params?: {
  status?: string;
  keyword?: string;
}) => axios.get('/sales-orders', { params }) as Promise<SalesOrder[]>;

export const createSalesOrder = (data: Partial<SalesOrder>) =>
  axios.post('/sales-orders', data) as Promise<SalesOrder>;

export const submitSalesOrder = (id: string) =>
  axios.post(`/sales-orders/${id}/submit`) as Promise<any>;
