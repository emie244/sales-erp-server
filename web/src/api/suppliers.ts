import axios from './axios';

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  remark?: string;
  isActive: boolean;
  createdAt: string;
}

export const fetchSuppliers = (params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}) => axios.get('/suppliers', { params }) as Promise<{ data: Supplier[]; total: number; page: number; pageSize: number }>;

export const createSupplier = (data: Partial<Supplier>) =>
  axios.post('/suppliers', data) as Promise<Supplier>;

export const updateSupplier = (id: string, data: Partial<Supplier>) =>
  axios.put(`/suppliers/${id}`, data) as Promise<Supplier>;

export const deleteSupplier = (id: string) =>
  axios.delete(`/suppliers/${id}`) as Promise<void>;
