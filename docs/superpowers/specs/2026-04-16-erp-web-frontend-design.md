# ERP Web 前端设计文档

**日期**: 2026-04-16  
**主题**: sales-erp-server Web 前端界面（MVP）  
**版本**: v1.0

---

## 1. 项目背景与目标

为已部署的 `sales-erp-server`（NestJS 后端）配套一套 Web 管理界面。后端已暴露完整的 REST API，前缀为 `/api/v1`。本前端采用 React 技术栈，第一阶段聚焦 MVP 功能：仪表盘、销售订单、审批中心、报表分析。

## 2. 技术栈

| 层级        | 选型                                   | 说明                                  |
| ----------- | -------------------------------------- | ------------------------------------- |
| 框架        | React 18                               | 函数组件 + Hooks                      |
| 构建工具    | Vite 6                                 | 快速热更新，现代 ES 构建              |
| UI 组件库   | Ant Design 5                           | 国内 ERP 主流，表格/表单/图表生态完善 |
| 路由        | React Router v7                        | 声明式路由，支持嵌套布局              |
| HTTP 客户端 | Axios                                  | 统一拦截器处理 Token 和错误           |
| 状态管理    | React Context + useState/useReducer    | MVP 阶段足够，避免过度工程            |
| 图表        | Ant Design Charts (@ant-design/charts) | 与 Ant Design 风格一致                |

## 3. 视觉与布局风格

### 3.1 整体风格

- **方向**: 现代轻亮专业版
- **主色调**: 科技蓝 `#1890ff`
- **背景**: 大白底 `#ffffff` + 浅灰内容区 `#f5f7fa`
- **字体**: 系统默认无衬线字体（PingFang SC、Microsoft YaHei）
- **圆角**: 按钮/卡片 `border-radius: 4px~8px`

### 3.2 布局结构

- **左侧固定导航栏**: 宽度 200px，包含 Logo 和菜单
- **顶部标题栏**: 高度 48~56px，左侧面包屑，右侧用户信息/退出
- **内容区**: 浅灰背景，20~24px 内边距，卡片式内容展示

## 4. 页面清单（MVP）

### 4.1 登录页（/login）

- **布局**: 左右分屏，左侧占 55%，右侧占 45%
- **左侧**: 蓝青渐变背景 (`#1890ff` → `#36cfc9`)，展示品牌名 "Sales ERP" 和 slogan
- **右侧**: 白底登录表单，字段：用户名、密码，登录按钮
- **交互**: 登录成功后写入 localStorage Token，跳转 `/dashboard`

### 4.2 仪表盘（/dashboard）

- **4 个指标卡**（顶部一行）:
  1. 今日订单数
  2. 待审批数量（橙色高亮）
  3. 本月销售额（蓝色高亮）
  4. 本月收款额（绿色高亮）
- **中部左区**: 销售趋势图（近 7 天），柱状图或折线图
- **中部右区**: 待处理审批快捷列表，点击可跳转到审批详情

### 4.3 销售订单（/sales-orders）

- **搜索栏**: 订单号/客户名称输入框、状态下拉筛选、查询按钮
- **操作区**: 右侧 "+ 新建订单" 按钮
- **数据表格**: 列包括——订单号、客户名称、下单时间、应付金额、状态、操作
- **状态标签颜色**:
  - 草稿: 灰色
  - 待审批: 橙色
  - 已通过/已同步聚水潭/已发货/已完成: 绿色
  - 已拒绝/已取消: 红色
- **操作列**: 查看详情、提交审批（仅限草稿状态）
- **新建弹窗/抽屉**: 选择客户、添加商品 SKU、填写数量、自动计算金额

### 4.4 审批中心（/approvals）

- **Tab 切换**:
  1. 待我审批
  2. 我已审批
  3. 我发起的
- **列表卡片**: 每个审批项展示——审批标题、申请人、申请时间、关联金额
- **操作按钮**:
  - 待我审批: 通过（绿）、拒绝（红）
  - 其他 Tab: 查看详情

### 4.5 报表分析（/reports）

- **Tab 切换**:
  1. 销售汇总（按日统计订单数和销售额）
  2. 收款统计（按支付方式汇总）
  3. 业绩排行（按业务员汇总业绩）
- **展示形式**: 上方图表 + 下方数据表格

## 5. 路由结构

```
/login           → 登录页（无侧边栏）
/dashboard       → 仪表盘
/sales-orders    → 销售订单列表
/approvals       → 审批中心
/reports         → 报表分析
```

所有非 `/login` 路由共用 **Layout 组件**（左侧导航 + 顶部栏）。

## 6. 组件规划

### 6.1 公共组件

- `AppLayout`: 左侧菜单 + 顶部栏 + 内容区
- `PageHeader`: 页面标题 + 面包屑
- `StatCard`: 仪表盘统计卡片
- `StatusTag`: 统一封装订单/审批状态的颜色标签

### 6.2 页面组件

- `LoginPage`
- `DashboardPage`
- `SalesOrderPage` + `SalesOrderFormDrawer`
- `ApprovalPage` + `ApprovalDetailModal`
- `ReportPage`

## 7. API 对接规范

### 7.1 基础配置

- BaseURL: `http://192.168.200.60:3000/api/v1`
- 响应格式统一: `{ code: number, data: any, message: string }`
- `code === 0` 为成功，其余为业务错误

### 7.2 关键接口映射

| 页面     | 功能         | 接口                                                                                  |
| -------- | ------------ | ------------------------------------------------------------------------------------- |
| 登录     | 账号密码登录 | 后端暂无独立登录接口，MVP 阶段先模拟登录（硬编码 admin / 123456）或跳过校验直接进系统 |
| 仪表盘   | 今日订单     | `GET /sales-orders`（按日期筛选统计）                                                 |
| 仪表盘   | 待审批数     | `GET /approvals`（统计 pending）                                                      |
| 仪表盘   | 销售趋势     | `GET /reports/sales-summary`                                                          |
| 销售订单 | 列表         | `GET /sales-orders`                                                                   |
| 销售订单 | 新建         | `POST /sales-orders`                                                                  |
| 销售订单 | 提交审批     | `POST /sales-orders/:id/submit`                                                       |
| 审批中心 | 列表         | `GET /approvals`                                                                      |
| 审批中心 | 审批操作     | `POST /approvals/:instanceCode/approve` / `reject`                                    |
| 报表     | 销售汇总     | `GET /reports/sales-summary`                                                          |
| 报表     | 收款统计     | `GET /reports/payment-collect`                                                        |
| 报表     | 业绩排行     | `GET /reports/rep-achievement`                                                        |

**注意**: 后端目前没有独立的 `/auth/login` 接口。MVP 前端先采用"模拟登录"方式：输入任意账号密码即可进入，Token 写死或仅做本地标记。待后端补充认证后再对接真实登录。

## 8. 目录结构

```
web/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── axios.ts
│   │   ├── customers.ts
│   │   ├── products.ts
│   │   ├── sales.ts
│   │   ├── approvals.ts
│   │   └── reports.ts
│   ├── components/
│   │   ├── AppLayout.tsx
│   │   ├── PageHeader.tsx
│   │   ├── StatCard.tsx
│   │   └── StatusTag.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── SalesOrderPage.tsx
│   │   ├── ApprovalPage.tsx
│   │   └── ReportPage.tsx
│   ├── hooks/
│   ├── stores/
│   └── styles/
│       └── global.css
└── public/
```

## 9. 部署方式

前端构建为纯静态资源，产出 `dist/` 目录。部署方式二选一：

1. **独立部署**: 用 Nginx/Caddy 托管 `dist/`，配置反向代理到 `http://192.168.200.60:3000`
2. **集成到后端**: 将 `dist/` 内容放入后端 `public/` 目录，由 NestJS 提供静态文件服务

MVP 阶段推荐方案 **2**，简单快速：把构建产物放到后端容器里一起部署。

## 10. 非功能需求

- **响应式**: 适配 1366×768 及以上分辨率（ERP 主要在桌面使用）
- **加载状态**: 表格和按钮操作时有 Loading 提示
- **错误提示**: API 失败时顶部 Message 提示错误信息
- **空状态**: 表格无数据时展示 Ant Design 默认 Empty 插图

---

_文档已获用户批准，进入实现计划阶段。_
