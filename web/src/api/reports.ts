import axios from './axios';

export const fetchSalesSummary = (params?: { dateFrom?: string; dateTo?: string; signerId?: string; status?: string }) =>
  axios.get('/reports/sales-summary', { params }) as Promise<any[]>;

export const fetchTotalOrderAmount = (params?: { dateFrom?: string; dateTo?: string; signerId?: string; status?: string }) =>
  axios.get('/reports/total-order-amount', { params }) as Promise<any>;

export const fetchPaymentCollect = (params?: { dateFrom?: string; dateTo?: string }) =>
  axios.get('/reports/payment-collect', { params }) as Promise<any[]>;

export const fetchPaymentRecords = (params?: { dateFrom?: string; dateTo?: string }) =>
  axios.get('/reports/payment-records', { params }) as Promise<any[]>;

export const fetchTotalCollectedAmount = (params?: { dateFrom?: string; dateTo?: string }) =>
  axios.get('/reports/total-collected-amount', { params }) as Promise<any>;

export const fetchRepAchievement = () =>
  axios.get('/reports/rep-achievement') as Promise<any[]>;

export const fetchSignerRanking = (params?: { dateFrom?: string; dateTo?: string; limit?: number }) =>
  axios.get('/reports/signer-ranking', { params }) as Promise<any[]>;

export const fetchProductRanking = (params?: { dateFrom?: string; dateTo?: string; limit?: number }) =>
  axios.get('/reports/product-ranking', { params }) as Promise<any[]>;

export const fetchTargetProgress = (period?: string) =>
  axios.get('/reports/target-progress', { params: period ? { period } : undefined }) as Promise<any[]>;

// Target management APIs (admin only)
export const fetchTargets = (period?: string) =>
  axios.get('/targets', { params: period ? { period } : undefined }) as Promise<any[]>;

export const createTarget = (data: { userId: string; userName?: string; targetAmount: number; period?: string }) =>
  axios.post('/targets', data) as Promise<any>;

export const updateTarget = (id: string, data: { targetAmount: number }) =>
  axios.put(`/targets/${id}`, data) as Promise<any>;

export const deleteTarget = (id: string) =>
  axios.delete(`/targets/${id}`) as Promise<any>;
