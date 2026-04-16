import axios from './axios';

export const fetchSalesSummary = () =>
  axios.get('/reports/sales-summary') as Promise<any[]>;

export const fetchPaymentCollect = () =>
  axios.get('/reports/payment-collect') as Promise<any[]>;

export const fetchRepAchievement = () =>
  axios.get('/reports/rep-achievement') as Promise<any[]>;
