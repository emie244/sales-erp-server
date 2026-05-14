import axios from './axios';
import type { PrepaymentRecord } from '@/types';

export const fetchPrepayments = (params?: {
  customerId?: string;
  status?: string;
}) => axios.get('/prepayments', { params }) as Promise<PrepaymentRecord[]>;

export const createPrepayment = (data: Partial<PrepaymentRecord>) =>
  axios.post('/prepayments', data) as Promise<PrepaymentRecord>;

export const deletePrepayment = (id: string) =>
  axios.delete(`/prepayments/${id}`) as Promise<void>;

export const updatePrepayment = (id: string, data: Partial<PrepaymentRecord>) =>
  axios.put(`/prepayments/${id}`, data) as Promise<PrepaymentRecord>;

export const submitPrepaymentForApproval = (
  id: string,
  data: {
    feishuUserId: string;
    approvalDefCode: string;
    feishuUserIdType?: string;
  },
) => axios.post(`/prepayments/${id}/submit`, data) as Promise<any>;
