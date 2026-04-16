import axios from './axios';

export const fetchUserProfile = (name: string) =>
  axios.get('/users/profile', { params: { name } }) as Promise<{
    id?: string;
    name?: string;
    email?: string;
    feishuOpenId?: string | null;
  }>;

export const fetchUsers = () =>
  axios.get('/users') as Promise<
    {
      id: string;
      name: string;
      email: string;
      feishuOpenId?: string | null;
      isActive: boolean;
    }[]
  >;

export const updateUser = (id: string, data: any) =>
  axios.put(`/users/${id}`, data) as Promise<any>;
