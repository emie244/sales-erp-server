import axios from './axios';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VoucherItem {
  id: string;
  voucherId: string;
  accountCode: string;
  accountName?: string | null;
  debitAmount: number;
  creditAmount: number;
  description?: string | null;
  createdAt: string;
}

export interface Voucher {
  id: string;
  voucherNo: string;
  voucherDate: string;
  type: string;
  description?: string | null;
  totalAmount: number;
  status: string;
  sourceType?: string | null;
  sourceId?: string | null;
  items?: VoucherItem[];
  createdAt: string;
  updatedAt: string;
}

export const fetchVouchers = (params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  type?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sourceType?: string;
  sourceId?: string;
}) =>
  axios.get('/vouchers', { params }) as Promise<PaginatedResponse<Voucher>>;

export const fetchVouchersBySource = (sourceType: string, sourceId: string) =>
  axios.get(`/vouchers/by-source/${sourceType}/${sourceId}`) as Promise<Voucher[]>;

export const fetchVoucherById = (id: string) =>
  axios.get(`/vouchers/${id}`) as Promise<Voucher>;

export const createVoucher = (data: Partial<Voucher>) =>
  axios.post('/vouchers', data) as Promise<Voucher>;

export const updateVoucher = (id: string, data: Partial<Voucher>) =>
  axios.put(`/vouchers/${id}`, data) as Promise<Voucher>;

export const deleteVoucher = (id: string) =>
  axios.delete(`/vouchers/${id}`) as Promise<{ id: string }>;

export const postVoucher = (id: string) =>
  axios.post(`/vouchers/${id}/post`) as Promise<Voucher>;

export const cancelVoucher = (id: string) =>
  axios.post(`/vouchers/${id}/cancel`) as Promise<Voucher>;
