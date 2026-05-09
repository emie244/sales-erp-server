import axios from './axios';
import type { Customer } from '@/types';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const fetchCustomers = (params?: { page?: number; pageSize?: number }) =>
  axios.get('/customers', { params });

export const fetchCustomerById = (id: string) => axios.get(`/customers/${id}`);

export const createCustomer = (data: Partial<Customer>) =>
  axios.post('/customers', data);

export const updateCustomer = (id: string, data: Partial<Customer>) =>
  axios.put(`/customers/${id}`, data);

export const deleteCustomer = (id: string) => axios.delete(`/customers/${id}`);

export const batchCreateCustomers = (customers: Partial<Customer>[]) =>
  axios.post('/customers/batch', { customers });

// 客户地址簿
export const fetchCustomerAddresses = (customerId: string) =>
  axios.get(`/customer-addresses/customer/${customerId}`);

export const createCustomerAddress = (data: any) =>
  axios.post('/customer-addresses', data);

export const updateCustomerAddress = (id: string, data: any) =>
  axios.put(`/customer-addresses/${id}`, data);

export const deleteCustomerAddress = (id: string) =>
  axios.delete(`/customer-addresses/${id}`);

export const setDefaultCustomerAddress = (id: string) =>
  axios.put(`/customer-addresses/${id}/default`);

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
