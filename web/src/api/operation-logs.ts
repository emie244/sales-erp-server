import axios from './axios';

export interface OperationLog {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: {
    body?: unknown;
    durationMs?: number;
  };
  ip: string | null;
  status: 'success' | 'error';
  errorMessage?: string;
  createdAt: string;
}

export interface OperationLogListRes {
  data: OperationLog[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getOperationLogs(
  page = 1,
  pageSize = 50,
): Promise<OperationLogListRes> {
  const res = await axios.get<OperationLogListRes>('/operation-logs', {
    params: { page, pageSize },
  });
  return res.data;
}
