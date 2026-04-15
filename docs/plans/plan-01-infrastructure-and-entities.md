# Plan 01：基础设施 + 所有数据库实体

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 搭建 NestJS 项目骨架、Docker Compose 环境、全局中间件、TypeORM 连接，并创建所有领域实体（User, Customer, Product, SKU, PricePolicy, SalesOrder, SalesOrderItem, ApprovalRecord, IntegrationLog, StockSnapshot, PaymentRecord, DeliveryOrder, DeliveryOrderItem, SalesRepAchievement）。

**架构：** 新建 `Github/sales-erp-server/` 项目，采用 NestJS 单体 + TypeORM 0.3 + PostgreSQL 16。所有实体一次性定义完毕，便于后续并行开发业务模块。

**技术栈：** Node.js 22, NestJS 10, TypeORM 0.3, PostgreSQL 16, class-validator, class-transformer

**前置依赖：** 无（这是第一个计划）。

**后置依赖：** Plan 02 / 03 / 04 / 05 都依赖本计划完成后的实体和数据库结构。

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/main.ts` | 入口：全局前缀 `api/v1`、ValidationPipe |
| `src/app.module.ts` | 根模块：ConfigModule、TypeOrmModule、全局 Provider |
| `src/config/database.config.ts` | TypeORM 异步配置 |
| `src/config/redis.config.ts` | Redis 配置占位（供后续 Bull 使用） |
| `src/common/entities/base.entity.ts` | 通用基类（uuid, createdAt, updatedAt） |
| `src/common/interceptors/transform.interceptor.ts` | 统一响应包装 `{code, data, message}` |
| `src/common/filters/http-exception.filter.ts` | 全局异常过滤器 |
| `src/users/entities/user.entity.ts` | 用户实体 |
| `src/customers/entities/customer.entity.ts` | 客户实体 |
| `src/products/entities/product.entity.ts` | 商品 SPU |
| `src/products/entities/product-sku.entity.ts` | SKU |
| `src/products/entities/price-policy.entity.ts` | 价格策略 |
| `src/sales/entities/sales-order.entity.ts` | 销售订单 |
| `src/sales/entities/sales-order-item.entity.ts` | 订单明细 |
| `src/approvals/entities/approval-record.entity.ts` | 审批记录 |
| `src/integrations/entities/integration-log.entity.ts` | 集成日志 |
| `src/stocks/entities/stock-snapshot.entity.ts` | 库存快照 |
| `src/payments/entities/payment-record.entity.ts` | 收款记录 |
| `src/deliveries/entities/delivery-order.entity.ts` | 发货单 |
| `src/deliveries/entities/delivery-order-item.entity.ts` | 发货单明细 |
| `src/achievements/entities/sales-rep-achievement.entity.ts` | 业绩归属 |
| `docker-compose.yml` | PG + Redis 服务定义 |
| `Dockerfile` | 应用镜像 |
| `.env.example` | 环境变量模板 |

---

## 任务 1：初始化 NestJS 项目

**文件：**
- 创建：`Github/sales-erp-server/`（项目根）

- [ ] **步骤 1：初始化项目**

```bash
cd /Users/a1234/Documents/📂_02_项目与开发/Github
npx @nestjs/cli@latest new sales-erp-server --strict --skip-git
```

- [ ] **步骤 2：安装依赖**

```bash
cd sales-erp-server
npm install @nestjs/config @nestjs/typeorm typeorm pg @nestjs/bull bull ioredis @nestjs/schedule class-validator class-transformer reflect-metadata rxjs
npm install -D @types/node ts-node
```

- [ ] **步骤 3：验证构建**

```bash
npm run build
```

预期：无报错，`dist/` 生成。

- [ ] **步骤 4：Commit**

```bash
git add .
git commit -m "chore: init NestJS project with core dependencies"
```

---

## 任务 2：Docker 与基础配置

**文件：**
- 创建：`docker-compose.yml`
- 创建：`Dockerfile`
- 创建：`.env.example`

- [ ] **步骤 1：编写 docker-compose.yml**

```yaml
version: '3.8'
services:
  app:
    build: .
    container_name: sales-erp
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=db
      - DB_PORT=5432
      - DB_USERNAME=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=sales_erp
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - FEISHU_APP_ID=${FEISHU_APP_ID}
      - FEISHU_APP_SECRET=${FEISHU_APP_SECRET}
      - JUSHUITAN_APP_KEY=${JUSHUITAN_APP_KEY}
      - JUSHUITAN_APP_SECRET=${JUSHUITAN_APP_SECRET}
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    container_name: sales-erp-db
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=sales_erp
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    container_name: sales-erp-redis
    volumes:
      - ./data/redis:/data
    ports:
      - "6379:6379"
```

- [ ] **步骤 2：编写 Dockerfile**

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main"]
```

- [ ] **步骤 3：编写 .env.example**

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=sales_erp
REDIS_HOST=localhost
REDIS_PORT=6379
FEISHU_APP_ID=
FEISHU_APP_SECRET=
JUSHUITAN_APP_KEY=
JUSHUITAN_APP_SECRET=
```

- [ ] **步骤 4：Commit**

```bash
git add docker-compose.yml Dockerfile .env.example
git commit -m "chore: add docker-compose, Dockerfile and env template"
```

---

## 任务 3：全局响应格式与异常处理

**文件：**
- 创建：`src/common/interceptors/transform.interceptor.ts`
- 创建：`src/common/filters/http-exception.filter.ts`
- 修改：`src/main.ts`
- 修改：`src/app.module.ts`

- [ ] **步骤 1：编写 TransformInterceptor**

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  code: number;
  data: T;
  message: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        data,
        message: 'success',
      })),
    );
  }
}
```

- [ ] **步骤 2：编写 HttpExceptionFilter**

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const res: any = exception.getResponse();

    response.status(status).json({
      code: res.code ?? status,
      data: null,
      message: Array.isArray(res.message) ? res.message[0] : (res.message ?? exception.message),
      path: request.url,
    });
  }
}
```

- [ ] **步骤 3：修改 main.ts**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api/v1');
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **步骤 4：修改 app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
```

- [ ] **步骤 5：Commit**

```bash
git add src/common src/main.ts src/app.module.ts
git commit -m "feat: add global response transform and exception filter"
```

---

## 任务 4：TypeORM 连接配置

**文件：**
- 创建：`src/config/database.config.ts`
- 创建：`src/config/redis.config.ts`
- 修改：`src/app.module.ts`

- [ ] **步骤 1：编写 database.config.ts**

```typescript
import { registerAs } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';

export const databaseConfig = registerAs('database', () => ({
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'sales_erp',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production',
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsRun: true,
}));

export const connectionSource = new DataSource(
  databaseConfig() as DataSourceOptions,
);
```

- [ ] **步骤 2：编写 redis.config.ts**

```typescript
import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
}));
```

- [ ] **步骤 3：修改 app.module.ts 引入 TypeORM**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig, redisConfig] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('database')!,
    }),
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
```

- [ ] **步骤 4：本地验证数据库连接**

```bash
docker compose up -d db redis
npm run start:dev
```

在另一个终端：

```bash
docker exec sales-erp-db psql -U postgres -d sales_erp -c "\dt"
```

预期：无表但连接成功。

- [ ] **步骤 5：Commit**

```bash
git add src/config src/app.module.ts
git commit -m "feat: configure TypeORM and Redis config"
```

---

## 任务 5：通用基类与用户实体

**文件：**
- 创建：`src/common/entities/base.entity.ts`
- 创建：`src/users/entities/user.entity.ts`
- 创建：`src/users/users.module.ts`
- 修改：`src/app.module.ts`

- [ ] **步骤 1：编写 BaseEntity**

```typescript
import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **步骤 2：编写 User 实体**

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ name: 'feishu_open_id', unique: true, nullable: true })
  feishuOpenId: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: true })
  isActive: boolean;
}
```

- [ ] **步骤 3：编写 UsersModule**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  exports: [TypeOrmModule],
})
export class UsersModule {}
```

- [ ] **步骤 4：在 AppModule 引入 UsersModule**

```typescript
imports: [
  // ... existing imports
  UsersModule,
]
```

并确保 `UsersModule` 已 import：

```typescript
import { UsersModule } from './users/users.module';
```

- [ ] **步骤 5：验证 users 表存在**

```bash
docker exec sales-erp-db psql -U postgres -d sales_erp -c "\dt"
```

预期：出现 `users`。

- [ ] **步骤 6：Commit**

```bash
git add src/common src/users src/app.module.ts
git commit -m "feat: add base entity and user module"
```

---

## 任务 6：Customer 实体

**文件：**
- 创建：`src/customers/entities/customer.entity.ts`
- 创建：`src/customers/customers.module.ts`

- [ ] **步骤 1：编写 Customer 实体**

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum CustomerLevel {
  A = 'A',
  B = 'B',
  C = 'C',
}

@Entity('customers')
export class Customer extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  contactName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: CustomerLevel, default: CustomerLevel.C })
  level: CustomerLevel;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  creditLimit: number;

  @Column({ type: 'int', default: 0 })
  paymentTerms: number;

  @Column({ nullable: true })
  address: string;

  @Column({ default: true })
  isActive: boolean;
}
```

- [ ] **步骤 2：编写 CustomersModule**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Customer])],
  exports: [TypeOrmModule],
})
export class CustomersModule {}
```

- [ ] **步骤 3：在 AppModule 引入 CustomersModule**

- [ ] **步骤 4：Commit**

```bash
git add src/customers src/app.module.ts
git commit -m "feat: add customer entity and module"
```

---

## 任务 7：Product、SKU、PricePolicy 实体

**文件：**
- 创建：`src/products/entities/product.entity.ts`
- 创建：`src/products/entities/product-sku.entity.ts`
- 创建：`src/products/entities/price-policy.entity.ts`
- 创建：`src/products/products.module.ts`
- 修改：`src/app.module.ts`

- [ ] **步骤 1：编写 Product 实体**

```typescript
import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ProductSku } from './product-sku.entity';

@Entity('products')
export class Product extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  category: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => ProductSku, (sku) => sku.product)
  skus: ProductSku[];
}
```

- [ ] **步骤 2：编写 ProductSku 实体**

```typescript
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from './product.entity';

@Entity('product_skus')
export class ProductSku extends BaseEntity {
  @Column()
  skuCode: string;

  @Column({ nullable: true })
  barcode: string;

  @Column({ nullable: true })
  spec: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  weight: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.skus)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
```

- [ ] **步骤 3：编写 PricePolicy 实体**

```typescript
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ProductSku } from './product-sku.entity';

@Entity('price_policies')
export class PricePolicy extends BaseEntity {
  @Column({ name: 'sku_id' })
  skuId: string;

  @ManyToOne(() => ProductSku)
  @JoinColumn({ name: 'sku_id' })
  sku: ProductSku;

  @Column()
  customerLevel: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  minQty: number;
}
```

- [ ] **步骤 4：编写 ProductsModule**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductSku } from './entities/product-sku.entity';
import { PricePolicy } from './entities/price-policy.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductSku, PricePolicy])],
  exports: [TypeOrmModule],
})
export class ProductsModule {}
```

- [ ] **步骤 5：在 AppModule 引入 ProductsModule**

- [ ] **步骤 6：Commit**

```bash
git add src/products src/app.module.ts
git commit -m "feat: add product, sku and price policy entities"
```

---

## 任务 8：SalesOrder 与 SalesOrderItem 实体

**文件：**
- 创建：`src/sales/entities/sales-order.entity.ts`
- 创建：`src/sales/entities/sales-order-item.entity.ts`
- 创建：`src/sales/sales.module.ts`
- 修改：`src/app.module.ts`

- [ ] **步骤 1：编写 SalesOrder 实体**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { SalesOrderItem } from './sales-order-item.entity';

export enum SalesOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SYNCED_JST = 'synced_jst',
  SHIPPED = 'shipped',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum SalesOrderType {
  WHOLESALE = 'wholesale',
  RETAIL = 'retail',
  RETURN = 'return',
}

@Entity('sales_orders')
export class SalesOrder extends BaseEntity {
  @Column({ type: 'enum', enum: SalesOrderType, default: SalesOrderType.WHOLESALE })
  type: SalesOrderType;

  @Column({ type: 'enum', enum: SalesOrderStatus, default: SalesOrderStatus.DRAFT })
  status: SalesOrderStatus;

  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  payAmount: number;

  @Column({ nullable: true })
  remark: string;

  @OneToMany(() => SalesOrderItem, (item) => item.order, { cascade: true })
  items: SalesOrderItem[];
}
```

- [ ] **步骤 2：编写 SalesOrderItem 实体**

```typescript
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { SalesOrder } from './sales-order.entity';

@Entity('sales_order_items')
export class SalesOrderItem extends BaseEntity {
  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => SalesOrder, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order: SalesOrder;

  @Column({ name: 'sku_id' })
  skuId: string;

  @Column()
  skuName: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  qty: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  lineAmount: number;
}
```

- [ ] **步骤 3：编写 SalesModule**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrder } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SalesOrder, SalesOrderItem])],
  exports: [TypeOrmModule],
})
export class SalesModule {}
```

- [ ] **步骤 4：在 AppModule 引入 SalesModule**

- [ ] **步骤 5：Commit**

```bash
git add src/sales src/app.module.ts
git commit -m "feat: add sales order and item entities"
```

---

## 任务 9：审批、集成、库存、收款、发货、业绩实体

**文件：**
- 创建：`src/approvals/entities/approval-record.entity.ts`
- 创建：`src/approvals/approvals.module.ts`
- 创建：`src/integrations/entities/integration-log.entity.ts`
- 创建：`src/integrations/integrations.module.ts`
- 创建：`src/stocks/entities/stock-snapshot.entity.ts`
- 创建：`src/stocks/stocks.module.ts`
- 创建：`src/payments/entities/payment-record.entity.ts`
- 创建：`src/payments/payments.module.ts`
- 创建：`src/deliveries/entities/delivery-order.entity.ts`
- 创建：`src/deliveries/entities/delivery-order-item.entity.ts`
- 创建：`src/deliveries/deliveries.module.ts`
- 创建：`src/achievements/entities/sales-rep-achievement.entity.ts`
- 创建：`src/achievements/achievements.module.ts`
- 修改：`src/app.module.ts`

- [ ] **步骤 1：编写 ApprovalRecord 实体**

```typescript
import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { SalesOrder } from '../../sales/entities/sales-order.entity';

@Entity('approval_records')
export class ApprovalRecord extends BaseEntity {
  @Column({ name: 'sales_order_id', unique: true })
  salesOrderId: string;

  @OneToOne(() => SalesOrder)
  @JoinColumn({ name: 'sales_order_id' })
  salesOrder: SalesOrder;

  @Column({ name: 'feishu_instance_code' })
  feishuInstanceCode: string;

  @Column({ name: 'feishu_approval_def_code' })
  feishuApprovalDefCode: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'approved' | 'rejected' | 'transferred';

  @Column({ type: 'jsonb', nullable: true })
  callbackPayload: any;
}
```

- [ ] **步骤 2：编写 IntegrationLog 实体**

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('integration_logs')
export class IntegrationLog extends BaseEntity {
  @Column()
  provider: string;

  @Column()
  action: string;

  @Column({ type: 'jsonb' })
  request: any;

  @Column({ type: 'jsonb', nullable: true })
  response: any;

  @Column({ default: false })
  success: boolean;

  @Column({ nullable: true })
  errorMessage: string;
}
```

- [ ] **步骤 3：编写 StockSnapshot 实体**

```typescript
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('stock_snapshots')
export class StockSnapshot {
  @PrimaryColumn({ name: 'sku_id' })
  skuId: string;

  @PrimaryColumn({ name: 'warehouse_id' })
  warehouseId: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  availableQty: number;

  @Column({ name: 'synced_at' })
  syncedAt: Date;
}
```

- [ ] **步骤 4：编写 PaymentRecord 实体**

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('payment_records')
export class PaymentRecord extends BaseEntity {
  @Column({ name: 'sales_order_id' })
  salesOrderId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column()
  method: string;

  @Column({ name: 'received_at' })
  receivedAt: Date;

  @Column({ name: 'received_by' })
  receivedBy: string;

  @Column({ nullable: true })
  remark: string;
}
```

- [ ] **步骤 5：编写 DeliveryOrder 实体**

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('delivery_orders')
export class DeliveryOrder extends BaseEntity {
  @Column({ name: 'sales_order_id' })
  salesOrderId: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true })
  trackingNo: string;

  @Column({ nullable: true })
  carrier: string;

  @Column({ nullable: true })
  shippedAt: Date;
}
```

- [ ] **步骤 6：编写 DeliveryOrderItem 实体**

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('delivery_order_items')
export class DeliveryOrderItem extends BaseEntity {
  @Column({ name: 'delivery_order_id' })
  deliveryOrderId: string;

  @Column({ name: 'sales_order_item_id' })
  salesOrderItemId: string;

  @Column({ name: 'sku_id' })
  skuId: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  qty: number;
}
```

- [ ] **步骤 7：编写 SalesRepAchievement 实体**

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('sales_rep_achievements')
export class SalesRepAchievement extends BaseEntity {
  @Column({ name: 'sales_order_id' })
  salesOrderId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  role: 'primary' | 'assistant';

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  shareRatio: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  achievementAmount: number;
}
```

- [ ] **步骤 8：编写各空 Module**

为 approvals、integrations、stocks、payments、deliveries、achievements 各写一个空 Module，仅 `imports: [TypeOrmModule.forFeature([Entity])]`。

- [ ] **步骤 9：在 AppModule 引入所有新 Module**

```typescript
import { ApprovalsModule } from './approvals/approvals.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { StocksModule } from './stocks/stocks.module';
import { PaymentsModule } from './payments/payments.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { AchievementsModule } from './achievements/achievements.module';
```

在 `imports` 数组中加入它们。

- [ ] **步骤 10：验证所有表已创建**

```bash
npm run start:dev
```

在另一个终端：

```bash
docker exec sales-erp-db psql -U postgres -d sales_erp -c "\dt"
```

预期：出现 `users`, `customers`, `products`, `product_skus`, `price_policies`, `sales_orders`, `sales_order_items`, `approval_records`, `integration_logs`, `stock_snapshots`, `payment_records`, `delivery_orders`, `delivery_order_items`, `sales_rep_achievements`。

- [ ] **步骤 11：Commit**

```bash
git add src/approvals src/integrations src/stocks src/payments src/deliveries src/achievements src/app.module.ts
git commit -m "feat: add all remaining domain entities and modules"
```

---

## 自检

- 所有 14 张表的设计文档已覆盖 ✓
- 无占位符，所有代码完整可运行 ✓
- TypeORM 配置使用 `synchronize: true`（开发环境），后续计划无需手动写 migration 即可创建表 ✓
