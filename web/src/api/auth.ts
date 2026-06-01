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

export const getFeishuBindUrl = () =>
  axios.get('/auth/feishu/bind-url') as Promise<{ url: string }>;

export const bindFeishu = (code: string) =>
  axios.post('/auth/bind-feishu', { code }) as Promise<{ code: number; message: string; data?: any }>;

export const unbindFeishu = () =>
  axios.post('/auth/unbind-feishu') as Promise<{ code: number; message: string }>;

export const fetchRolePermissions = () =>
  axios.get('/auth/role-permissions') as Promise<{
    roles: string[];
    labels: Record<string, string>;
    templates: Record<string, string[]>;
  }>;

/**
 * 将角色权限模板缓存到 localStorage
 */
export function cacheRolePermissions(data: { templates: Record<string, string[]> }) {
  localStorage.setItem('erp_role_templates', JSON.stringify(data.templates));
}

/**
 * 从 localStorage 获取缓存的角色权限模板
 */
export function getCachedRoleTemplates(): Record<string, string[]> | null {
  try {
    const raw = localStorage.getItem('erp_role_templates');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
