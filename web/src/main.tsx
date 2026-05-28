import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import App from './App';
import './index.css';

dayjs.locale('zh-cn');

const erpTheme = {
  token: {
    colorPrimary: '#2563EB',
    colorSuccess: '#10B981',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorInfo: '#2563EB',
    colorText: '#111111',
    colorTextSecondary: '#6E6E6E',
    colorTextTertiary: '#A0A0A0',
    colorBgLayout: '#F7F7F8',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorBorder: '#EBEBEC',
    colorBorderSecondary: '#F0F0F1',
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    borderRadiusXS: 2,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    fontSizeLG: 16,
    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 28,
  },
  algorithm: theme.defaultAlgorithm,
};

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={erpTheme}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
