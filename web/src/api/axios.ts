import axios from 'axios';
import { message } from 'antd';

const instance = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
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
    message.error(err.message || '网络错误');
    return Promise.reject(err);
  },
);

export default instance;
