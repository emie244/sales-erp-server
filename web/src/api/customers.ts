import axios from './axios';
import type { Customer } from '@/types';

export const fetchCustomers = () =>
  axios.get('/customers') as Promise<Customer[]>;
