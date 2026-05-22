import axios from './axios';
import type { Customer } from '@/types';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const fetchCustomers = (params?: { page?: number; pageSize?: number }) =>
  axios.get('/customers', { params }) as Promise<PaginatedResponse<Customer>>;

export const fetchCustomerById = (id: string) =>
  axios.get(`/customers/${id}`) as Promise<Customer>;

export const createCustomer = (data: Partial<Customer>) =>
  axios.post('/customers', data) as Promise<Customer>;

export const updateCustomer = (id: string, data: Partial<Customer>) =>
  axios.put(`/customers/${id}`, data) as Promise<Customer>;

export const deleteCustomer = (id: string) =>
  axios.delete(`/customers/${id}`) as Promise<void>;

export const batchCreateCustomers = (customers: Partial<Customer>[]) =>
  axios.post('/customers/batch', { customers }) as Promise<any>;

// 客户地址簿
export const fetchCustomerAddresses = (customerId: string) =>
  axios.get(`/customer-addresses/customer/${customerId}`) as Promise<any[]>;

export const createCustomerAddress = (data: any) =>
  axios.post('/customer-addresses', data) as Promise<any>;

export const updateCustomerAddress = (id: string, data: any) =>
  axios.put(`/customer-addresses/${id}`, data) as Promise<any>;

export const deleteCustomerAddress = (id: string) =>
  axios.delete(`/customer-addresses/${id}`) as Promise<void>;

export const setDefaultCustomerAddress = (id: string) =>
  axios.put(`/customer-addresses/${id}/default`) as Promise<any>;

export interface CustomerDuplicateCandidate {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  taxId?: string;
  customerStatus?: string;
  createdAt?: string;
}

export const checkCustomerDuplicates = (params: {
  name?: string;
  taxId?: string;
  phone?: string;
  excludeId?: string;
}) =>
  axios.post('/customers/check-duplicates', params) as Promise<
    CustomerDuplicateCandidate[]
  >;

export const exportCustomers = async () => {
  const res = await axios.get('/customers/export', { responseType: 'blob' });
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute(
    'download',
    `customers-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
