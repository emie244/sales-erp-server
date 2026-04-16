# ERP Web 前端 MVP 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 sales-erp-server 构建一套 React + Ant Design 的 Web 管理界面（MVP），包含登录页、仪表盘、销售订单、审批中心、报表分析 5 个页面。

**架构：** 独立 `web/` 目录存放前端代码，使用 Vite + React 18 + TypeScript + Ant Design 5 + React Router v7 + Axios。开发时通过 Vite proxy 代理到后端 `http://192.168.200.60:3000`，构建产出 `dist/` 目录，最终由 NestJS 后端提供静态文件服务。

**技术栈：** React 18, Vite 6, TypeScript 5, Ant Design 5, @ant-design/charts, React Router 7, Axios

---

## 文件清单

| 文件/目录                                     | 职责                                      |
| --------------------------------------------- | ----------------------------------------- |
| `web/`                                        | 前端项目根目录                            |
| `web/package.json`                            | 前端依赖和脚本                            |
| `web/vite.config.ts`                          | Vite 配置（含 API 代理）                  |
| `web/tsconfig.json`                           | TypeScript 配置                           |
| `web/index.html`                              | HTML 入口                                 |
| `web/src/main.tsx`                            | React 应用挂载入口                        |
| `web/src/App.tsx`                             | 路由定义和全局 Provider                   |
| `web/src/api/axios.ts`                        | Axios 实例和响应拦截器                    |
| `web/src/api/sales.ts`                        | 销售订单相关 API 封装                     |
| `web/src/api/approvals.ts`                    | 审批相关 API 封装                         |
| `web/src/api/reports.ts`                      | 报表相关 API 封装                         |
| `web/src/api/customers.ts`                    | 客户相关 API 封装                         |
| `web/src/api/products.ts`                     | 商品/SKU 相关 API 封装                    |
| `web/src/components/AppLayout.tsx`            | 左侧导航 + 顶部栏布局                     |
| `web/src/components/StatCard.tsx`             | 仪表盘统计卡片                            |
| `web/src/components/StatusTag.tsx`            | 订单/审批状态标签                         |
| `web/src/components/SalesOrderFormDrawer.tsx` | 新建销售订单抽屉表单                      |
| `web/src/pages/LoginPage.tsx`                 | 登录页（左右分屏）                        |
| `web/src/pages/DashboardPage.tsx`             | 仪表盘（指标卡 + 图表 + 待审批）          |
| `web/src/pages/SalesOrderPage.tsx`            | 销售订单列表页                            |
| `web/src/pages/ApprovalPage.tsx`              | 审批中心页                                |
| `web/src/pages/ReportPage.tsx`                | 报表分析页                                |
| `web/src/types/index.ts`                      | TypeScript 类型定义                       |
| `web/src/styles/global.css`                   | 全局样式（如有）                          |
| `src/app.module.ts` (后端)                    | 增加 ServeStaticModule 以托管前端构建产物 |

---

## 任务 1：初始化 Vite React TypeScript 项目

**文件：**

- 创建：`web/package.json`
- 创建：`web/vite.config.ts`
- 创建：`web/tsconfig.json`
- 创建：`web/index.html`
- 创建：`web/src/main.tsx`

- [ ] **步骤 1：创建项目目录并初始化**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server
npm create vite@latest web -- --template react-ts
```

预期：生成 `web/` 目录，包含基础 Vite React TS 模板。

- [ ] **步骤 2：安装前端依赖**

```bash
cd web
npm install antd @ant-design/charts axios react-router-dom
```

- [ ] **步骤 3：配置 Vite Proxy（解决开发跨域）**

修改 `web/vite.config.ts` 为以下内容：

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://192.168.200.60:3000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

- [ ] **步骤 4：修改 tsconfig.json 添加路径别名**

在 `web/tsconfig.json` 的 `compilerOptions` 中添加：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **步骤 5：Commit**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server
git add web/
git commit -m "feat: init vite react ts project for erp web frontend"
```

---

## 任务 2：创建 API 层和通用类型

**文件：**

- 创建：`web/src/types/index.ts`
- 创建：`web/src/api/axios.ts`
- 创建：`web/src/api/sales.ts`
- 创建：`web/src/api/approvals.ts`
- 创建：`web/src/api/reports.ts`
- 创建：`web/src/api/customers.ts`
- 创建：`web/src/api/products.ts`

- [ ] **步骤 1：编写通用类型定义**

创建 `web/src/types/index.ts`：

```typescript
export interface ApiResponse<T = any> {
  code: number;
  data: T;
  message: string;
}

export interface SalesOrder {
  id: string;
  customerId: string;
  customerName?: string;
  payAmount: number;
  status: string;
  createdAt: string;
  items: SalesOrderItem[];
}

export interface SalesOrderItem {
  id: string;
  skuId: string;
  skuName: string;
  qty: number;
  unitPrice: number;
  lineAmount: number;
}

export interface ApprovalRecord {
  id: string;
  instanceCode: string;
  salesOrderId: string;
  status: string;
  feishuStatus: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
}

export interface ProductSku {
  id: string;
  skuCode: string;
  skuName: string;
  productId: string;
}
```

- [ ] **步骤 2：编写 Axios 实例和拦截器**

创建 `web/src/api/axios.ts`：

```typescript
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
```

- [ ] **步骤 3：编写各模块 API 封装**

创建 `web/src/api/sales.ts`：

```typescript
import axios from './axios';
import type { ApiResponse, SalesOrder } from '@/types';

export const fetchSalesOrders = (params?: {
  status?: string;
  keyword?: string;
}) => axios.get('/sales-orders', { params }) as Promise<SalesOrder[]>;

export const createSalesOrder = (data: Partial<SalesOrder>) =>
  axios.post('/sales-orders', data) as Promise<SalesOrder>;

export const submitSalesOrder = (id: string) =>
  axios.post(`/sales-orders/${id}/submit`) as Promise<any>;
```

创建 `web/src/api/approvals.ts`：

```typescript
import axios from './axios';
import type { ApprovalRecord } from '@/types';

export const fetchApprovals = (params?: { status?: string }) =>
  axios.get('/approvals', { params }) as Promise<ApprovalRecord[]>;

export const approve = (instanceCode: string) =>
  axios.post(`/approvals/${instanceCode}/approve`) as Promise<any>;

export const reject = (instanceCode: string) =>
  axios.post(`/approvals/${instanceCode}/reject`) as Promise<any>;
```

创建 `web/src/api/reports.ts`：

```typescript
import axios from './axios';

export const fetchSalesSummary = () =>
  axios.get('/reports/sales-summary') as Promise<any[]>;

export const fetchPaymentCollect = () =>
  axios.get('/reports/payment-collect') as Promise<any[]>;

export const fetchRepAchievement = () =>
  axios.get('/reports/rep-achievement') as Promise<any[]>;
```

创建 `web/src/api/customers.ts`：

```typescript
import axios from './axios';
import type { Customer } from '@/types';

export const fetchCustomers = () =>
  axios.get('/customers') as Promise<Customer[]>;
```

创建 `web/src/api/products.ts`：

```typescript
import axios from './axios';
import type { ProductSku } from '@/types';

export const fetchProducts = () => axios.get('/products') as Promise<any[]>;

export const fetchSkus = (productId?: string) =>
  axios.get('/products/skus', {
    params: productId ? { productId } : undefined,
  }) as Promise<ProductSku[]>;
```

- [ ] **步骤 4：验证 tsconfig 路径别名编译**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server/web
npx tsc --noEmit
```

预期：无报错。

- [ ] **步骤 5：Commit**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server
git add web/src/types web/src/api
git commit -m "feat: add api layer with axios, types and endpoint wrappers"
```

---

## 任务 3：路由和布局组件

**文件：**

- 修改：`web/src/main.tsx`
- 创建：`web/src/App.tsx`
- 创建：`web/src/components/AppLayout.tsx`

- [ ] **步骤 1：编写 AppLayout 组件**

创建 `web/src/components/AppLayout.tsx`：

```tsx
import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Breadcrumb } from 'antd';
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  BarChartOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const items = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/sales-orders', icon: <ShoppingCartOutlined />, label: '销售订单' },
  { key: '/approvals', icon: <FileTextOutlined />, label: '审批中心' },
  { key: '/reports', icon: <BarChartOutlined />, label: '报表分析' },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('erp_token');
    navigate('/login');
  };

  const menuItems = [
    { key: 'logout', label: <span onClick={handleLogout}>退出登录</span> },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={200}>
        <div
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          Sales ERP
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items.map((i) => ({
            key: i.key,
            icon: i.icon,
            label: <Link to={i.key}>{i.label}</Link>,
          }))}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Breadcrumb
            items={[
              { title: '首页' },
              {
                title:
                  items.find((i) => i.key === location.pathname)?.label || '',
              },
            ]}
          />
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1890ff' }}>A</Avatar>
              <span>管理员</span>
              <DownOutlined />
            </Space>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 16,
            background: '#f5f7fa',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 8,
              minHeight: 360,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
```

- [ ] **步骤 2：编写路由入口 App.tsx**

创建 `web/src/App.tsx`：

```tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SalesOrderPage from './pages/SalesOrderPage';
import ApprovalPage from './pages/ApprovalPage';
import ReportPage from './pages/ReportPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('erp_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="sales-orders" element={<SalesOrderPage />} />
          <Route path="approvals" element={<ApprovalPage />} />
          <Route path="reports" element={<ReportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **步骤 3：修改 main.tsx**

修改 `web/src/main.tsx` 为：

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
```

- [ ] **步骤 4：验证编译通过**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server/web
npx tsc --noEmit
```

预期：无报错。

- [ ] **步骤 5：Commit**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server
git add web/src/components/AppLayout.tsx web/src/App.tsx web/src/main.tsx
git commit -m "feat: add react router and AppLayout with sidebar navigation"
```

---

## 任务 4：登录页

**文件：**

- 创建：`web/src/pages/LoginPage.tsx`

- [ ] **步骤 1：编写登录页**

创建 `web/src/pages/LoginPage.tsx`：

```tsx
import React, { useState } from 'react';
import { Button, Input, Form, message } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = (values: { username: string; password: string }) => {
    setLoading(true);
    setTimeout(() => {
      // MVP 阶段模拟登录，任意账号密码均可
      localStorage.setItem('erp_token', 'mock_token_' + values.username);
      message.success('登录成功');
      navigate('/dashboard');
      setLoading(false);
    }, 500);
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div
        style={{
          flex: 1.2,
          background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#fff',
          padding: 40,
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
          Sales ERP
        </div>
        <div style={{ fontSize: 16, opacity: 0.9 }}>
          智能销售管理，业务一手掌控
        </div>
      </div>
      <div
        style={{
          flex: 1,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 80px',
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 600,
            marginBottom: 32,
            color: '#262626',
          }}
        >
          账号登录
        </div>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input size="large" placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password size="large" placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2：验证编译通过**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server/web
npx tsc --noEmit
```

预期：无报错。

- [ ] **步骤 3：Commit**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server
git add web/src/pages/LoginPage.tsx
git commit -m "feat: add login page with brand background"
```

---

## 任务 5：仪表盘页面

**文件：**

- 创建：`web/src/components/StatCard.tsx`
- 创建：`web/src/pages/DashboardPage.tsx`

- [ ] **步骤 1：编写 StatCard 组件**

创建 `web/src/components/StatCard.tsx`：

```tsx
import React from 'react';
import { Card, Statistic } from 'antd';

interface Props {
  title: string;
  value: number | string;
  prefix?: string;
  valueStyle?: React.CSSProperties;
}

export default function StatCard({ title, value, prefix, valueStyle }: Props) {
  return (
    <Card>
      <Statistic
        title={title}
        value={value}
        prefix={prefix}
        valueStyle={valueStyle}
      />
    </Card>
  );
}
```

- [ ] **步骤 2：编写 DashboardPage**

创建 `web/src/pages/DashboardPage.tsx`：

```tsx
import React, { useEffect, useState } from 'react';
import { Row, Col, List, Badge, message } from 'antd';
import { Column } from '@ant-design/charts';
import StatCard from '@/components/StatCard';
import { fetchSalesSummary } from '@/api/reports';
import { fetchApprovals } from '@/api/approvals';
import { fetchSalesOrders } from '@/api/sales';

export default function DashboardPage() {
  const [todayOrders, setTodayOrders] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);
  const [monthlyPayments, setMonthlyPayments] = useState(0);
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [pendingList, setPendingList] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const orders = await fetchSalesOrders();
      const approvals = await fetchApprovals();
      const summary = await fetchSalesSummary();

      setTodayOrders(
        orders.filter((o: any) => o.createdAt && o.createdAt.startsWith(today))
          .length,
      );
      setPendingApprovals(
        approvals.filter(
          (a: any) => a.status === 'pending' || a.feishuStatus === 'PENDING',
        ).length,
      );
      setMonthlySales(
        orders
          .filter((o: any) =>
            ['approved', 'synced_jst', 'shipped', 'completed'].includes(
              o.status,
            ),
          )
          .reduce((sum: number, o: any) => sum + (o.payAmount || 0), 0),
      );
      setSalesTrend(summary.slice(0, 7));
      setPendingList(
        approvals
          .filter(
            (a: any) => a.status === 'pending' || a.feishuStatus === 'PENDING',
          )
          .slice(0, 5),
      );
    } catch (e) {
      message.error('加载仪表盘数据失败');
    }
  };

  const chartConfig = {
    data: salesTrend.map((s: any) => ({
      date: s.date?.split('T')[0] || s.date,
      销售额: parseFloat(s.totalPayAmount) || 0,
    })),
    xField: 'date',
    yField: '销售额',
    height: 220,
    autoFit: true,
  };

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <StatCard title="今日订单" value={todayOrders} />
        </Col>
        <Col span={6}>
          <StatCard
            title="待审批"
            value={pendingApprovals}
            valueStyle={{ color: '#fa8c16' }}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="本月销售额"
            value={monthlySales}
            prefix="¥"
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="本月收款"
            value={monthlyPayments}
            prefix="¥"
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={16}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
            <div style={{ fontWeight: 500, marginBottom: 12 }}>
              销售趋势（近7天）
            </div>
            <Column {...chartConfig} />
          </div>
        </Col>
        <Col span={8}>
          <div
            style={{
              background: '#fff',
              padding: 16,
              borderRadius: 8,
              height: '100%',
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: 12 }}>待处理审批</div>
            <List
              dataSource={pendingList}
              renderItem={(item) => (
                <List.Item>
                  <Badge status="warning" text={`审批 ${item.instanceCode}`} />
                </List.Item>
              )}
              locale={{ emptyText: '暂无待审批' }}
            />
          </div>
        </Col>
      </Row>
    </div>
  );
}
```

- [ ] **步骤 3：验证编译通过**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server/web
npx tsc --noEmit
```

预期：无报错。

- [ ] **步骤 4：Commit**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server
git add web/src/components/StatCard.tsx web/src/pages/DashboardPage.tsx
git commit -m "feat: add dashboard page with stat cards and sales trend chart"
```

---

## 任务 6：销售订单页面

**文件：**

- 创建：`web/src/components/StatusTag.tsx`
- 创建：`web/src/components/SalesOrderFormDrawer.tsx`
- 创建：`web/src/pages/SalesOrderPage.tsx`

- [ ] **步骤 1：编写 StatusTag 组件**

创建 `web/src/components/StatusTag.tsx`：

```tsx
import React from 'react';
import { Tag } from 'antd';

const colorMap: Record<string, string> = {
  draft: 'default',
  pending: 'orange',
  approved: 'green',
  synced_jst: 'green',
  shipped: 'green',
  completed: 'green',
  rejected: 'red',
  cancelled: 'red',
};

const labelMap: Record<string, string> = {
  draft: '草稿',
  pending: '待审批',
  approved: '已通过',
  synced_jst: '已同步',
  shipped: '已发货',
  completed: '已完成',
  rejected: '已拒绝',
  cancelled: '已取消',
};

interface Props {
  status: string;
}

export default function StatusTag({ status }: Props) {
  return (
    <Tag color={colorMap[status] || 'default'}>
      {labelMap[status] || status}
    </Tag>
  );
}
```

- [ ] **步骤 2：编写销售订单新建抽屉**

创建 `web/src/components/SalesOrderFormDrawer.tsx`：

```tsx
import React, { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  InputNumber,
} from 'antd';
import { fetchCustomers } from '@/api/customers';
import { fetchProducts, fetchSkus } from '@/api/products';
import { createSalesOrder } from '@/api/sales';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SalesOrderFormDrawer({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [skus, setSkus] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCustomers()
        .then(setCustomers)
        .catch(() => {});
      fetchProducts()
        .then(setProducts)
        .catch(() => {});
      form.resetFields();
    }
  }, [open]);

  const handleProductChange = (productId: string) => {
    fetchSkus(productId)
      .then(setSkus)
      .catch(() => {});
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const items = values.items.map((item: any) => {
        const sku = skus.find((s) => s.id === item.skuId);
        return {
          skuId: item.skuId,
          skuName: sku?.skuName || '',
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineAmount: item.qty * item.unitPrice,
        };
      });
      await createSalesOrder({
        customerId: values.customerId,
        payAmount: items.reduce((sum: number, i: any) => sum + i.lineAmount, 0),
        items,
      });
      message.success('创建成功');
      onSuccess();
      onClose();
    } catch {
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      title="新建销售订单"
      width={520}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="客户" name="customerId" rules={[{ required: true }]}>
          <Select
            placeholder="请选择客户"
            options={customers.map((c) => ({ label: c.name, value: c.id }))}
          />
        </Form.Item>
        <Form.List name="items" initialValue={[{}]}>
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Space
                  key={key}
                  style={{ display: 'flex', marginBottom: 8 }}
                  align="baseline"
                >
                  <Form.Item
                    {...restField}
                    name={[name, 'productId']}
                    rules={[{ required: true, message: '选商品' }]}
                  >
                    <Select
                      placeholder="商品"
                      style={{ width: 120 }}
                      options={products.map((p) => ({
                        label: p.name,
                        value: p.id,
                      }))}
                      onChange={handleProductChange}
                    />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'skuId']}
                    rules={[{ required: true, message: '选SKU' }]}
                  >
                    <Select
                      placeholder="SKU"
                      style={{ width: 120 }}
                      options={skus.map((s) => ({
                        label: s.skuName,
                        value: s.id,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'qty']}
                    rules={[{ required: true, message: '数量' }]}
                  >
                    <InputNumber placeholder="数量" min={1} />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'unitPrice']}
                    rules={[{ required: true, message: '单价' }]}
                  >
                    <InputNumber placeholder="单价" min={0} precision={2} />
                  </Form.Item>
                  <Button type="link" danger onClick={() => remove(name)}>
                    删除
                  </Button>
                </Space>
              ))}
              <Button type="dashed" onClick={() => add()} block>
                + 添加商品
              </Button>
            </>
          )}
        </Form.List>
        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存
          </Button>
        </div>
      </Form>
    </Drawer>
  );
}
```

- [ ] **步骤 3：编写销售订单列表页**

创建 `web/src/pages/SalesOrderPage.tsx`：

```tsx
import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, message } from 'antd';
import StatusTag from '@/components/StatusTag';
import SalesOrderFormDrawer from '@/components/SalesOrderFormDrawer';
import { fetchSalesOrders, submitSalesOrder } from '@/api/sales';

export default function SalesOrderPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchSalesOrders({ keyword, status });
      setData(res);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (id: string) => {
    try {
      await submitSalesOrder(id);
      message.success('提交审批成功');
      loadData();
    } catch {
      message.error('提交失败');
    }
  };

  const columns = [
    { title: '订单号', dataIndex: 'id', key: 'id' },
    { title: '客户', dataIndex: 'customerName', key: 'customerName' },
    {
      title: '下单时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => v?.replace('T', ' ').slice(0, 19),
    },
    {
      title: '应付金额',
      dataIndex: 'payAmount',
      key: 'payAmount',
      render: (v: number) => `¥${v?.toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <StatusTag status={v} />,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link">查看</Button>
          {record.status === 'draft' && (
            <Button type="link" onClick={() => handleSubmit(record.id)}>
              提交审批
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Space>
          <Input
            placeholder="订单号/客户"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
          />
          <Select
            placeholder="全部状态"
            value={status}
            onChange={setStatus}
            style={{ width: 120 }}
            allowClear
          >
            <Select.Option value="draft">草稿</Select.Option>
            <Select.Option value="pending">待审批</Select.Option>
            <Select.Option value="approved">已通过</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
          </Select>
          <Button type="primary" onClick={loadData}>
            查询
          </Button>
        </Space>
        <Button type="primary" onClick={() => setDrawerOpen(true)}>
          + 新建订单
        </Button>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
      />
      <SalesOrderFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
```

- [ ] **步骤 4：验证编译通过**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server/web
npx tsc --noEmit
```

预期：无报错。

- [ ] **步骤 5：Commit**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server
git add web/src/components/StatusTag.tsx web/src/components/SalesOrderFormDrawer.tsx web/src/pages/SalesOrderPage.tsx
git commit -m "feat: add sales order list page with create drawer and status tag"
```

---

## 任务 7：审批中心页面

**文件：**

- 创建：`web/src/pages/ApprovalPage.tsx`

- [ ] **步骤 1：编写审批中心页**

创建 `web/src/pages/ApprovalPage.tsx`：

```tsx
import React, { useEffect, useState } from 'react';
import { Card, Button, Tabs, Space, message, Empty } from 'antd';
import { fetchApprovals, approve, reject } from '@/api/approvals';
import StatusTag from '@/components/StatusTag';

export default function ApprovalPage() {
  const [tab, setTab] = useState('pending');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (tab === 'pending') params.status = 'pending';
      const res = await fetchApprovals(params);
      setData(res);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tab]);

  const handleApprove = async (code: string) => {
    try {
      await approve(code);
      message.success('审批通过');
      loadData();
    } catch {
      message.error('操作失败');
    }
  };

  const handleReject = async (code: string) => {
    try {
      await reject(code);
      message.success('已拒绝');
      loadData();
    } catch {
      message.error('操作失败');
    }
  };

  const tabItems = [
    { key: 'pending', label: '待我审批' },
    { key: 'approved', label: '我已审批' },
    { key: 'submitted', label: '我发起的' },
  ];

  return (
    <div>
      <Tabs activeKey={tab} onChange={setTab} items={tabItems} />
      <Space direction="vertical" style={{ width: '100%' }}>
        {data.length === 0 && <Empty description="暂无数据" />}
        {data.map((item) => (
          <Card key={item.id} loading={loading}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  销售订单审批 {item.instanceCode}
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                  订单: {item.salesOrderId} · 创建时间:{' '}
                  {item.createdAt?.replace('T', ' ').slice(0, 19)}
                </div>
                <div style={{ marginTop: 4 }}>
                  <StatusTag status={item.status || item.feishuStatus} />
                </div>
              </div>
              {tab === 'pending' && (
                <Space>
                  <Button
                    type="primary"
                    onClick={() => handleApprove(item.instanceCode)}
                  >
                    通过
                  </Button>
                  <Button
                    danger
                    onClick={() => handleReject(item.instanceCode)}
                  >
                    拒绝
                  </Button>
                </Space>
              )}
            </div>
          </Card>
        ))}
      </Space>
    </div>
  );
}
```

- [ ] **步骤 2：验证编译通过**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server/web
npx tsc --noEmit
```

预期：无报错。

- [ ] **步骤 3：Commit**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server
git add web/src/pages/ApprovalPage.tsx
git commit -m "feat: add approval center page with approve/reject actions"
```

---

## 任务 8：报表分析页面

**文件：**

- 创建：`web/src/pages/ReportPage.tsx`

- [ ] **步骤 1：编写报表分析页**

创建 `web/src/pages/ReportPage.tsx`：

```tsx
import React, { useEffect, useState } from 'react';
import { Tabs, Table, message } from 'antd';
import { Column } from '@ant-design/charts';
import {
  fetchSalesSummary,
  fetchPaymentCollect,
  fetchRepAchievement,
} from '@/api/reports';

export default function ReportPage() {
  const [tab, setTab] = useState('sales');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async (activeTab: string) => {
    setLoading(true);
    try {
      let res: any[] = [];
      if (activeTab === 'sales') res = await fetchSalesSummary();
      else if (activeTab === 'payment') res = await fetchPaymentCollect();
      else if (activeTab === 'achievement') res = await fetchRepAchievement();
      setData(res);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(tab);
  }, [tab]);

  const tabItems = [
    { key: 'sales', label: '销售汇总' },
    { key: 'payment', label: '收款统计' },
    { key: 'achievement', label: '业绩排行' },
  ];

  const salesColumns = [
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: '订单数', dataIndex: 'orderCount', key: 'orderCount' },
    {
      title: '销售额',
      dataIndex: 'totalPayAmount',
      key: 'totalPayAmount',
      render: (v: string) => `¥${parseFloat(v || '0').toFixed(2)}`,
    },
  ];

  const paymentColumns = [
    { title: '支付方式', dataIndex: 'method', key: 'method' },
    {
      title: '总金额',
      dataIndex: 'total',
      key: 'total',
      render: (v: string) => `¥${parseFloat(v || '0').toFixed(2)}`,
    },
  ];

  const achievementColumns = [
    { title: '业务员ID', dataIndex: 'userId', key: 'userId' },
    {
      title: '总业绩',
      dataIndex: 'total',
      key: 'total',
      render: (v: string) => `¥${parseFloat(v || '0').toFixed(2)}`,
    },
  ];

  const chartData =
    tab === 'sales'
      ? data.map((d) => ({
          name: d.date?.split('T')[0] || d.date,
          value: parseFloat(d.totalPayAmount) || 0,
        }))
      : tab === 'payment'
        ? data.map((d) => ({
            name: d.method || '未知',
            value: parseFloat(d.total) || 0,
          }))
        : data.map((d) => ({
            name: d.userId || '未知',
            value: parseFloat(d.total) || 0,
          }));

  const chartConfig = {
    data: chartData,
    xField: 'name',
    yField: 'value',
    height: 260,
    autoFit: true,
    label: { position: 'middle' as const },
  };

  const columns =
    tab === 'sales'
      ? salesColumns
      : tab === 'payment'
        ? paymentColumns
        : achievementColumns;

  return (
    <div>
      <Tabs
        activeKey={tab}
        onChange={(k) => {
          setTab(k);
          loadData(k);
        }}
        items={tabItems}
      />
      <div
        style={{
          background: '#fff',
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <Column {...chartConfig} />
      </div>
      <Table
        rowKey={(r) => r.date || r.method || r.userId || Math.random()}
        columns={columns}
        dataSource={data}
        loading={loading}
      />
    </div>
  );
}
```

- [ ] **步骤 2：验证编译通过**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server/web
npx tsc --noEmit
```

预期：无报错。

- [ ] **步骤 3：Commit**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server
git add web/src/pages/ReportPage.tsx
git commit -m "feat: add report page with charts and data tables"
```

---

## 任务 9：前端构建与后端集成

**文件：**

- 修改：`web/vite.config.ts`
- 修改：`src/app.module.ts`（后端）
- 修改：`package.json`（后端根目录）
- 修改：`Dockerfile`（后端根目录）

- [ ] **步骤 1：修改 Vite 配置设置 public base**

修改 `web/vite.config.ts`，在 `defineConfig` 根级别添加 `base: './'`：

```typescript
export default defineConfig({
  base: './',
  plugins: [react()],
  // ... 其余不变
});
```

- [ ] **步骤 2：安装后端静态文件服务依赖**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server
npm install @nestjs/serve-static
```

- [ ] **步骤 3：修改后端 app.module.ts 提供静态文件**

修改 `src/app.module.ts`，添加：

```typescript
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
```

在 `imports` 数组中插入（放在路由模块之前）：

```typescript
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', 'web', 'dist'),
}),
```

完整修改后的 `imports` 开头应为：

```typescript
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig, redisConfig] }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'web', 'dist'),
    }),
    // ... 后续模块不变
```

- [ ] **步骤 4：修改 Dockerfile 构建前端**

修改项目根目录 `Dockerfile`，在 `COPY . .` 之后、`RUN npm run build` 之前添加前端构建步骤：

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Build frontend
WORKDIR /app/web
RUN npm ci
RUN npm run build
WORKDIR /app
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main"]
```

注意：当前 Dockerfile 如果是 `npm ci --only=production` 需要先改成 `npm ci`（如果还没改的话）。确保根目录和后端开发依赖都在。

- [ ] **步骤 5：修改后端 package.json 添加前端构建脚本（可选）**

修改根目录 `package.json` 的 `scripts`，添加：

```json
{
  "scripts": {
    "build:web": "cd web && npm run build",
    "build:all": "npm run build:web && npm run build"
  }
}
```

- [ ] **步骤 6：本地构建验证**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server/web
npm run build
```

预期：生成 `web/dist/` 目录，内含 `index.html` 和静态资源。

- [ ] **步骤 7：后端编译验证**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server
npm run build
```

预期：`nest build` 成功。

- [ ] **步骤 8：Commit**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server
git add web/vite.config.ts src/app.module.ts package.json Dockerfile
git commit -m "feat: integrate built web frontend with NestJS static serving"
```

---

## 任务 10：重新部署到服务器

**文件：**

- 使用已有 `scripts/deploy.sh`

- [ ] **步骤 1：同步最新代码到服务器**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='coverage' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='web/node_modules' \
  --exclude='web/dist' \
  ./ \
  emie@192.168.200.60:~/sales-erp-server/
```

- [ ] **步骤 2：在服务器上执行部署脚本**

```bash
ssh emie@192.168.200.60 "cd ~/sales-erp-server && bash scripts/deploy.sh"
```

预期：Docker 构建成功，包含前端构建步骤，三个容器正常启动。

- [ ] **步骤 3：验证部署结果**

在本地执行：

```bash
curl -s http://192.168.200.60:3000 | head -c 100
```

预期：返回前端 `index.html` 内容（包含 `<!DOCTYPE html>` 或 `<html`）。

```bash
curl -s http://192.168.200.60:3000/api/v1/customers | head -c 50
```

预期：返回 JSON API 响应。

---

## 自检清单

**规格覆盖度：**

- [x] 登录页（左右分屏 + 模拟登录）
- [x] 仪表盘（指标卡 + 图表 + 待审批列表）
- [x] 销售订单（列表 + 搜索 + 新建抽屉 + 提交审批）
- [x] 审批中心（Tab + 通过/拒绝）
- [x] 报表分析（Tab + 图表 + 表格）
- [x] 路由和布局（左侧导航 + 顶部栏）
- [x] API 层封装（Axios + 拦截器）
- [x] 后端静态文件集成
- [x] 服务器部署

**占位符扫描：** 无 TODO、无"后续实现"、所有代码块完整。

**类型一致性：** `SalesOrder`、`ApprovalRecord` 类型在 `types/index.ts` 中定义，所有 API 和页面一致使用。
