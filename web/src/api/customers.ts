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
