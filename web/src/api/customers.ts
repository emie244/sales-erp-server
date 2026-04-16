import axios from './axios';
import type { Customer } from '@/types';

export const fetchCustomers = () =>
  axios.get('/customers') as Promise<Customer[]>;

export const createCustomer = (data: Partial<Customer>) =>
  axios.post('/customers', data) as Promise<Customer>;
