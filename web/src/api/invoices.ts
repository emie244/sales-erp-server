import axios from './axios';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InvoiceRecord {
  id: string;
  invoiceNo: string;
  salesOrderId: string | null;
  amount: number;
  invoiceDate: string;
  status: string;
  issuer?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export const fetchInvoices = (params?: {
  page?: number;
  pageSize?: number;
  salesOrderId?: string;
  keyword?: string;
  status?: string;
  sortBy?: string;
}) =>
  axios.get('/invoices', { params }) as Promise<PaginatedResponse<InvoiceRecord>>;

export const fetchInvoiceById = (id: string) =>
  axios.get(`/invoices/${id}`) as Promise<InvoiceRecord>;

export const createInvoice = (data: Partial<InvoiceRecord>) =>
  axios.post('/invoices', data) as Promise<InvoiceRecord>;

export const updateInvoice = (id: string, data: Partial<InvoiceRecord>) =>
  axios.put(`/invoices/${id}`, data) as Promise<InvoiceRecord>;

export const deleteInvoice = (id: string) =>
  axios.delete(`/invoices/${id}`) as Promise<{ id: string }>;
