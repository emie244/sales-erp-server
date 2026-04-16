import axios from './axios';

export const fetchUserProfile = (name: string) =>
  axios.get('/users/profile', { params: { name } }) as Promise<{
    id?: string;
    name?: string;
    email?: string;
    feishuOpenId?: string | null;
  }>;
