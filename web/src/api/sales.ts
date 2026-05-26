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
  salespersonId?: string;
  dateFrom?: string;
  dateTo?: string;
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
    records: {
      amount: number;
      method: string;
      remark?: string;
      attachments?: string[];
    }[];
    feishuUserId: string;
    feishuUserIdType?: string;
    approvalDefCode: string;
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

export interface AgingReportItem {
  customerId: string;
  customerName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
}

export const fetchAgingReport = () =>
  axios.get('/sales-orders/reports/aging') as Promise<AgingReportItem[]>;

export const fetchOverdueOrders = (params?: {
  page?: number;
  pageSize?: number;
}) =>
  axios.get('/sales-orders/reports/overdue', { params }) as Promise<
    PaginatedResponse<SalesOrder>
  >;

export interface ProductionSuggestion {
  skuId: string;
  skuName: string;
  skuCode?: string;
  orderQty: number;
  localStock: number;
  inTransit: number;
  inProduction: number;
  available: number;
  gap: number;
  hasBom: boolean;
  bomId: string | null;
  materialNeeds: { materialSkuId: string; totalQty: number }[];
}

export const fetchProductionSuggestion = (orderId: string) =>
  axios.get(`/sales-orders/${orderId}/production-suggestion`) as Promise<{
    orderId: string;
    suggestions: ProductionSuggestion[];
  }>;

export interface CustomerStatementItem {
  customerId: string;
  customerName: string;
  totalPayAmount: number;
  totalCollected: number;
  totalPrepayment: number;
  totalInvoiced: number;
  outstanding: number;
}

export interface CustomerStatement {
  summary: CustomerStatementItem[];
  orders: any[];
}

export const fetchCustomerStatement = (customerId?: string) =>
  axios.get('/sales-orders/reports/customer-statement', {
    params: customerId ? { customerId } : undefined,
  }) as Promise<CustomerStatement>;
