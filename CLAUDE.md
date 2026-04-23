# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Sales ERP system with a **NestJS** backend and **React + Vite** frontend. It manages sales orders, customers, products, and integrates with **Feishu (Lark)** for approval workflows and **Jushuitan** for ERP data sync.

## Development Commands

### Backend (root)

```bash
npm install          # install deps
npm run start:dev    # watch mode
npm run build        # NestJS build (outputs to dist/)
npm run test         # Jest unit tests
npm run test:e2e     # e2e tests (test/jest-e2e.json)
npm run lint         # ESLint with auto-fix
```

### Frontend (`web/`)

```bash
cd web && npm install
cd web && npm run dev      # Vite dev server on :5173
cd web && npm run build    # production build (outputs to web/dist/)
cd web && npm run lint     # ESLint
```

### Full Build & Deploy

```bash
npm run build:all          # build web then backend
./scripts/deploy.sh        # docker compose down && up -d --build
```

### Docker Compose

```bash
docker compose up -d       # app (:3000), postgres (:5432), redis (:6379)
```

Data volumes: `./data/postgres`, `./data/redis`, `./uploads`.

## Backend Architecture

### API & Global Middleware

- **Base path**: `/api/v1` (`src/main.ts:13`)
- **Response format**: all responses wrapped as `{ code: 0, data, message }` by `TransformInterceptor` (`src/common/interceptors/transform.interceptor.ts`)
- **Auth**: JWT global guard (`JwtAuthGuard`) + `@Public()` decorator to skip. Permissions guard (`PermissionsGuard`) reads `@Permissions('order:view')` metadata. Admin role bypasses all permission checks.
- **Validation**: global `ValidationPipe` with `whitelist: true, transform: true`

### Module Structure

| Module | Purpose |
|--------|---------|
| `auth` | JWT login + Feishu OAuth QR login. `auth.controller.ts` handles `/auth/login` and `/auth/feishu/callback`. |
| `users` | User CRUD. Key fields: `role` (`admin`/`user`), `permissions` (jsonb array), `feishuOpenId`, `feishuUserId`, `jushuitanShopId`. |
| `customers` | Customer master data. Includes `prepaymentBalance` and `creditLimit`. |
| `products` | Product + SKU management. `jstGoodsId` links to Jushuitan. |
| `sales` | Core sales order lifecycle. See state machine below. |
| `approvals` | Feishu approval integration. Creates approval instances, receives webhooks, drives downstream state changes. |
| `integrations` | Jushuitan ERP sync. Bull queue (`jushuitan-sync`) for async jobs + cron scheduler. |
| `payments` | Payment/collection records. |
| `prepayments` | Customer prepayment records. |
| `deliveries` | Delivery/shipment orders synced from Jushuitan. |
| `stocks` | Stock snapshots synced from Jushuitan. |
| `reports` | Business reports. |

### Sales Order State Machine

```
draft → pending_approval → approved → synced_jst → shipped → completed
         ↓ (rejected)        ↓ (bull queue)
        draft              push-order to Jushuitan
```

- Only `draft` or `rejected` orders can be edited.
- Submitting an order creates a Feishu approval instance; approval triggers async push to Jushuitan.
- Collection (回款) also requires approval. Approved collections update `collectedAmount` / `prepaymentDeducted`.

### Feishu Approval Integration

- `FeishuApprovalService` talks to Feishu Open API v4 (`tenant_access_token`, create/get instances).
- `ApprovalFormBuilder` maps domain data to Feishu form fields.
- `ApprovalsController` exposes `POST /webhooks/feishu/approval` (public) for Feishu callbacks. Challenge verification is handled inline.
- `ApprovalPollingService` and `FeishuWsService` provide fallback polling/WebSocket mechanisms.
- **Critical**: Feishu approval creation requires `user_id` (employee ID). If a user's `feishuUserId` is missing, submitting approvals fails. The admin page binds these IDs.

### Jushuitan Integration

- `JushuitanService` signs and calls Jushuitan Open API v2 (`/open/jushuitan/orders/upload`, `/open/deliveries/query`, `/open/inventory/query`, `/open/sku/query`).
- `JushuitanSyncProcessor` (Bull queue `jushuitan-sync`) handles async jobs:
  - `push-order`: push approved sales order to Jushuitan
  - `sync-stock`: upsert stock snapshots
  - `sync-deliveries`: pull shipment data, update order status to `shipped`
  - `sync-skus`: pull SKU data (filtered by brand `EMIE`), upsert into products
- `JushuitanScheduler` schedules: deliveries every 10 min, stock hourly, SKUs daily at 02:00.
- **Critical**: the order **signer** (`signerId`) must have `jushuitanShopId` configured. The push uses the signer's shop ID, not a global one.

### Database

- PostgreSQL via TypeORM. Entities auto-discovered from `**/*.entity{.ts,.js}`.
- `synchronize: true` in non-production; `migrationsRun: true` always.
- `BaseEntity` provides `id` (uuid), `createdAt`, `updatedAt`.

## Frontend Architecture

### Stack

- React 19, Vite, Ant Design 6, React Router DOM 7
- `axios` instance at `web/src/api/axios.ts` — baseURL `/api/v1`, auto-attaches `Bearer` token from `localStorage`, intercepts 401 to redirect to `/login`, unwraps `res.data.data`.

### Routing & Auth

Defined in `web/src/App.tsx`:
- `/login` — public
- `/dashboard`, `/customers`, `/products`, `/sales-orders`, `/prepayments`, `/approvals`, `/reports` — requires `erp_token`
- `/admin` — requires `erp_role === 'admin'`

Menu items in `AppLayout.tsx` are filtered by `hasPermission()` from `web/src/utils/permissions.ts`. Permissions are stored in `localStorage` as `erp_permissions`; admin gets wildcard `*`.

### API Layer

One module per domain under `web/src/api/`: `auth.ts`, `sales.ts`, `customers.ts`, `products.ts`, `users.ts`, `prepayments.ts`, `approvals.ts`, `reports.ts`.

## Environment Variables

Required at runtime (see `docker-compose.yml`):

```
DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME
REDIS_HOST, REDIS_PORT
FEISHU_APP_ID, FEISHU_APP_SECRET
JUSHUITAN_APP_KEY, JUSHUITAN_APP_SECRET, JUSHUITAN_ACCESS_TOKEN, JUSHUITAN_SHOP_ID
JWT_SECRET
NGROK_URL            # for Feishu OAuth callback redirect
NODE_ENV, PORT
```

Optional: `DB_SYNC=true` to enable TypeORM `synchronize`.

## Important Notes

- **Frontend dev proxy**: `web/vite.config.ts` proxies `/api` to `http://192.168.200.60:3000`. Change this if your backend runs elsewhere.
- **Static serving**: backend `ServeStaticModule` serves `web/dist` at root `/`. The frontend uses `base: './'` so it works behind the NestJS static handler.
- **Feishu approval def code**: hardcoded in `web/src/config.ts` as `FEISHU_APPROVAL_DEF_CODE`. Backend does not validate or store this per-tenant.
- **File uploads**: `/uploads` is served statically by Express in `main.ts`; the Docker volume mounts `./uploads`.
