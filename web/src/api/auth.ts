import axios from './axios';

export const login = (username: string, password: string) =>
  axios.post('/auth/login', { username, password }) as Promise<{
    token: string;
    user: {
      id: string;
      name: string;
      email: string;
      feishuOpenId?: string | null;
      feishuUserId?: string | null;
      feishuUnionId?: string | null;
      avatar?: string | null;
      role: string;
      permissions?: string[];
    };
  }>;

export const getFeishuLoginUrl = () =>
  axios.get('/auth/feishu/login') as Promise<{ url: string }>;
