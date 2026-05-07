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
  axios.delete(`/customers/${id}`) as Promise<any>;

export const batchCreateCustomers = (customers: Partial<Customer>[]) =>
  axios.post('/customers/batch', { customers }) as Promise<{ imported: number }>;

// 客户地址簿
export const fetchCustomerAddresses = (customerId: string) =>
  axios.get(`/customer-addresses/customer/${customerId}`) as Promise<any[]>;

export const createCustomerAddress = (data: any) =>
  axios.post('/customer-addresses', data) as Promise<any>;

export const updateCustomerAddress = (id: string, data: any) =>
  axios.put(`/customer-addresses/${id}`, data) as Promise<any>;

export const deleteCustomerAddress = (id: string) =>
  axios.delete(`/customer-addresses/${id}`) as Promise<any>;

export const setDefaultCustomerAddress = (id: string) =>
  axios.put(`/customer-addresses/${id}/default`) as Promise<any>;
