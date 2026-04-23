import axios from 'axios';
import { message } from 'antd';

const instance = axios.create({
  baseURL: '/api/v1',
  timeout: 60000,
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('erp_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

instance.interceptors.response.use(
  (res) => {
    const { code, data, message: msg } = res.data;
    if (code !== 0) {
      message.error(msg || '请求失败');
      return Promise.reject(new Error(msg || '请求失败'));
    }
    return data;
  },
  (err) => {
    if (err.response?.status === 401) {
      message.error('登录已过期，请重新登录');
      localStorage.removeItem('erp_token');
      localStorage.removeItem('erp_username');
      localStorage.removeItem('erp_role');
      localStorage.removeItem('erp_feishu_user_id');
      window.location.href = '/login';
    } else {
      message.error(err.message || '网络错误');
    }
    return Promise.reject(err);
  },
);

export default instance;
