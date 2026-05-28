import axios from './axios';

export const login = (username: string, password: string) =>
  axios.post('/auth/login', { username, password }) as Promise<{
    token: string;
    isFirstLogin?: boolean;
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

export const getFeishuLoginUrl = (redirect?: string) =>
  axios.get('/auth/feishu/login', { params: redirect ? { redirect } : undefined }) as Promise<{ url: string }>;
