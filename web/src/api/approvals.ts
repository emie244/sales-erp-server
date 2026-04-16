import axios from './axios';
import type { ApprovalRecord } from '@/types';

export const fetchApprovals = (params?: { status?: string }) =>
  axios.get('/approvals', { params }) as Promise<ApprovalRecord[]>;

export const approve = (instanceCode: string) =>
  axios.post(`/approvals/${instanceCode}/approve`) as Promise<any>;

export const reject = (instanceCode: string) =>
  axios.post(`/approvals/${instanceCode}/reject`) as Promise<any>;
