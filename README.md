# Sales ERP

销售管理系统，支持销售订单全生命周期管理、客户管理、产品管理、收款管理、报表分析，并集成飞书审批和聚水潭 ERP 数据同步。

## 技术栈

- **后端**：NestJS + TypeORM + PostgreSQL + Redis
- **前端**：React 19 + Vite + Ant Design 6
- **队列**：Bull（Redis）
- **部署**：Docker Compose

## 功能特性

### 核心模块

| 模块 | 说明 |
|------|------|
| 销售订单 | 订单创建 → 提交审批 → 推送聚水潭 → 发货 → 完成 |
| 客户管理 | 客户档案、信用额度、地址簿、批量导入 |
| 产品管理 | 产品/SKU 管理，支持聚水潭商品同步 |
| 收款管理 | 回款登记、预收款充值、收款审批 |
| 报表分析 | 销售汇总、业绩排行、目标达成、产品排行 |
| 审批管理 | 飞书审批集成，支持订单和收款审批 |

### 外部集成

- **飞书（Lark）**：OAuth 扫码登录、审批流程推送、审批状态回调
- **聚水潭（Jushuitan）**：订单推送、库存同步、发货单同步、SKU 同步

## 快速开始

### 环境要求

- Node.js >= 20
- Docker & Docker Compose

### 安装依赖

```bash
npm install
cd web && npm install
```

### 开发运行

```bash
# 启动数据库和 Redis
docker compose up -d db redis

# 后端开发模式
npm run start:dev

# 前端开发模式（另开终端）
cd web && npm run dev
```

前端默认访问 http://localhost:5173，后端 API 为 http://localhost:3000。

### 构建

```bash
# 构建前端 + 后端
npm run build:all
```

### 测试

```bash
# 单元测试
npm run test

# E2E 测试
npm run test:e2e

# 覆盖率
npm run test:cov
```

## 部署

### Docker Compose 全量部署

```bash
docker compose up -d
```

服务清单：
- App: `http://localhost:3000`
- PostgreSQL: `:5432`
- Redis: `:6379`

### 环境变量

创建 `.env` 文件（参考 `.env.example`）：

```bash
# 数据库
DB_HOST=db
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=sales_erp

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret

# 飞书
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret

# 聚水潭
JUSHUITAN_APP_KEY=your_key
JUSHUITAN_APP_SECRET=your_secret
JUSHUITAN_ACCESS_TOKEN=your_token

# 其他
NGROK_URL=your_ngrok_url
```

## 销售订单状态流转

```
draft → pending_approval → approved → synced_jst → shipped → completed
         ↓ (rejected)
        draft
```

- 只有 `draft` 或 `rejected` 状态可编辑
- 提交后触发飞书审批实例
- 审批通过后自动推送至聚水潭
- 聚水潭发货后同步更新为 `shipped`

## 项目结构

```
.
├── src/                    # 后端源码
│   ├── auth/               # 认证
│   ├── customers/          # 客户
│   ├── products/           # 产品
│   ├── sales/              # 销售订单
│   ├── approvals/          # 审批
│   ├── payments/           # 收款
│   ├── prepayments/        # 预收款
│   ├── integrations/       # 聚水潭同步
│   ├── reports/            # 报表
│   └── ...
├── web/                    # 前端源码
│   └── src/
│       ├── pages/          # 页面
│       ├── api/            # API 请求
│       └── components/     # 组件
├── docker-compose.yml      # Docker 编排
└── scripts/
    └── deploy.sh           # 部署脚本
```

## License

MIT
