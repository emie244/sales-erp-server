import axios from './axios';

export const fetchUserProfile = (name: string) =>
  axios.get('/users/profile', { params: { name } }) as Promise<{
    id?: string;
    name?: string;
    email?: string;
    feishuOpenId?: string | null;
    feishuUserId?: string | null;
    feishuUnionId?: string | null;
    avatar?: string | null;
    role?: string;
  }>;

export const fetchUsers = (params?: {
  keyword?: string;
  role?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}) =>
  axios.get('/users', { params }) as Promise<
    {
      id: string;
      name: string;
      email: string;
      feishuOpenId?: string | null;
      isActive: boolean;
      role: string;
      jushuitanShopId?: string | null;
    }[]
  >;

export const updateUser = (id: string, data: any) =>
  axios.put(`/users/${id}`, data) as Promise<any>;

export const createUser = (data: any) =>
  axios.post('/users', data) as Promise<any>;

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string | null;
  role: string;
  permissions: string[];
  feishuUserId?: string | null;
  jushuitanShopId?: string | null;
}

export const fetchMe = () => axios.get('/users/me') as Promise<UserProfile>;

export const updateMe = (data: Partial<UserProfile> & { password?: string }) =>
  axios.put('/users/me', data) as Promise<UserProfile>;

export interface DashboardStats {
  myOrdersThisMonth: { count: number; amount: number };
  pendingApprovals: {
    salesOrders: number;
    purchaseOrders: number;
    purchaseRequests: number;
  };
  deliveryWarnings: number;
  lowStockSkus: number;
}

export const fetchDashboard = () =>
  axios.get('/users/me/dashboard') as Promise<DashboardStats>;
