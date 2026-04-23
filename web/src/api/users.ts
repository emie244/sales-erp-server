import axios from './axios';

export const fetchUserProfile = (name: string) =>
  axios.get('/users/profile', { params: { name } }) as Promise<{
    id?: string;
    name?: string;
    email?: string;
    feishuOpenId?: string | null;
    feishuUserId?: string | null;
    feishuUnionId?: string | null;
    role?: string;
  }>;

export const fetchUsers = () =>
  axios.get('/users') as Promise<
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
