import axios from './axios';

export interface SyncLogError {
  skuCode?: string;
  message: string;
  stack?: string;
}

export interface SyncLog {
  id: string;
  jobName: string;
  status: 'running' | 'succeeded' | 'failed' | 'partial';
  startedAt: string;
  finishedAt: string | null;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  itemTypeNullCount: number;
  codeNonCompliantCount: number;
  errors: SyncLogError[];
  triggeredBy: string;
  triggeredByUserId: string | null;
  bullJobId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyAggregate {
  month: string;
  itemTypeNullSum: number;
  codeNonCompliantSum: number;
  jobCount: number;
}

export const fetchSyncLogs = (params?: {
  jobName?: string;
  limit?: number;
}) => axios.get('/admin/sync-logs', { params }) as Promise<SyncLog[]>;

export const fetchSyncLogById = (id: string) =>
  axios.get(`/admin/sync-logs/${id}`) as Promise<SyncLog>;

export const fetchMonthlyAggregate = (params: {
  jobName: string;
  months?: number;
}) =>
  axios.get('/admin/sync-logs/aggregate/monthly', { params }) as Promise<
    MonthlyAggregate[]
  >;
