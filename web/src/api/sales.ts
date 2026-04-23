import axios from './axios';
import type { SalesOrder } from '@/types';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const fetchSalesOrders = (params?: {
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) =>
  axios.get('/sales-orders', { params }) as Promise<
    PaginatedResponse<SalesOrder>
  >;

export const createSalesOrder = (data: Partial<SalesOrder>) =>
  axios.post('/sales-orders', data) as Promise<SalesOrder>;

export const submitSalesOrder = (
  id: string,
  data: {
    feishuUserId: string;
    feishuUserIdType?: string;
    approvalDefCode: string;
  },
) => axios.post(`/sales-orders/${id}/submit`, data) as Promise<any>;

export const fetchSalesOrderById = (id: string) =>
  axios.get(`/sales-orders/${id}`) as Promise<SalesOrder>;

export const updateSalesOrder = (id: string, data: Partial<SalesOrder>) =>
  axios.put(`/sales-orders/${id}`, data) as Promise<SalesOrder>;

export const createCollection = (
  id: string,
  data: {
    amount: number;
    prepaymentDeducted?: number;
    method: string;
    receivedAt?: Date;
    remark?: string;
    prepaymentRecordId?: string;
  },
) => axios.post(`/sales-orders/${id}/collection`, data) as Promise<SalesOrder>;

export const pushJushuitan = (id: string) =>
  axios.post(`/sales-orders/${id}/push-jushuitan`) as Promise<{
    success: boolean;
    payload: any;
    response?: any;
    error?: string;
    jushuitanOrderId?: number;
  }>;
