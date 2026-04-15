# Plan 05：收款、业绩、报表 + 部署收尾

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现收款记录、发货单查询、业务员业绩归属、基础销售报表，完成 Dockerfile / docker-compose / 部署脚本，确保整个项目可本地构建并运行。

**架构：** Payments / Deliveries / Achievements / Reports 模块补充业务 API。Reports 使用 TypeORM QueryBuilder 做聚合查询。Docker 构建验证通过。

**技术栈：** NestJS, TypeORM, Docker, Docker Compose

**前置依赖：** Plan 01 ~ Plan 04 均已完成。Plan 02 提供了 SalesOrder 创建能力，Plan 04 提供了 DeliveryOrder 写入能力。

**后置依赖：** 无（这是最后一个计划）。

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/payments/payments.service.ts` | 收款记录 CRUD |
| `src/payments/payments.controller.ts` | 收款 API |
| `src/payments/payments.module.ts` | 收款模块组装 |
| `src/payments/dto/create-payment.dto.ts` | 创建收款 DTO |
| `src/deliveries/deliveries.service.ts` | 发货单查询 Service |
| `src/deliveries/deliveries.controller.ts` | 发货单 API |
| `src/deliveries/deliveries.module.ts` | 发货模块组装 |
| `src/achievements/achievements.service.ts` | 业绩归属计算与查询 |
| `src/achievements/achievements.controller.ts` | 业绩 API |
| `src/achievements/achievements.module.ts` | 业绩模块组装 |
| `src/reports/reports.service.ts` | 报表聚合查询 |
| `src/reports/reports.controller.ts` | 报表 API |
| `src/reports/reports.module.ts` | 报表模块组装 |
| `scripts/deploy.sh` | 部署脚本 |
| `docker-compose.yml` | 已在 Plan 01 创建，确认无误 |
| `Dockerfile` | 已在 Plan 01 创建，确认无误 |

---

## 任务 1：Payment 模块

**文件：**
- 创建：`src/payments/payments.service.ts`
- 创建：`src/payments/payments.controller.ts`
- 创建：`src/payments/dto/create-payment.dto.ts`
- 修改：`src/payments/payments.module.ts`

- [ ] **步骤 1：编写 CreatePaymentDto**

```typescript
import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  salesOrderId: string;

  @IsNumber()
  amount: number;

  @IsString()
  method: string;

  @IsDateString()
  receivedAt: string;

  @IsString()
  receivedBy: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
```

- [ ] **步骤 2：编写 PaymentsService**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentRecord } from './entities/payment-record.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentRecord)
    private readonly repo: Repository<PaymentRecord>,
  ) {}

  create(dto: CreatePaymentDto) {
    return this.repo.save(
      this.repo.create({
        ...dto,
        receivedAt: new Date(dto.receivedAt),
      }),
    );
  }

  findByOrder(salesOrderId: string) {
    return this.repo.find({ where: { salesOrderId }, order: { receivedAt: 'DESC' } });
  }
}
```

- [ ] **步骤 3：编写 PaymentsController**

```typescript
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.service.create(dto);
  }

  @Get('order/:salesOrderId')
  findByOrder(@Param('salesOrderId') salesOrderId: string) {
    return this.service.findByOrder(salesOrderId);
  }
}
```

- [ ] **步骤 4：修改 PaymentsModule**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentRecord } from './entities/payment-record.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentRecord])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
```

- [ ] **步骤 5：Commit**

```bash
git add src/payments
git commit -m "feat: add payment records module"
```

---

## 任务 2：Deliveries 模块（发货单查询）

**文件：**
- 创建：`src/deliveries/deliveries.service.ts`
- 创建：`src/deliveries/deliveries.controller.ts`
- 修改：`src/deliveries/deliveries.module.ts`

- [ ] **步骤 1：编写 DeliveriesService**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryOrder } from './entities/delivery-order.entity';

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(DeliveryOrder)
    private readonly repo: Repository<DeliveryOrder>,
  ) {}

  findBySalesOrder(salesOrderId: string) {
    return this.repo.find({
      where: { salesOrderId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }
}
```

- [ ] **步骤 2：编写 DeliveriesController**

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';

@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly service: DeliveriesService) {}

  @Get('order/:salesOrderId')
  findByOrder(@Param('salesOrderId') salesOrderId: string) {
    return this.service.findBySalesOrder(salesOrderId);
  }
}
```

- [ ] **步骤 3：修改 DeliveriesModule**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryOrder } from './entities/delivery-order.entity';
import { DeliveryOrderItem } from './entities/delivery-order-item.entity';
import { DeliveriesService } from './deliveries.service';
import { DeliveriesController } from './deliveries.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryOrder, DeliveryOrderItem])],
  controllers: [DeliveriesController],
  providers: [DeliveriesService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
```

- [ ] **步骤 4：Commit**

```bash
git add src/deliveries
git commit -m "feat: add delivery query module"
```

---

## 任务 3：Achievements 模块（业绩归属）

**文件：**
- 创建：`src/achievements/achievements.service.ts`
- 创建：`src/achievements/achievements.controller.ts`
- 创建：`src/achievements/dto/create-achievement.dto.ts`
- 修改：`src/achievements/achievements.module.ts`

- [ ] **步骤 1：编写 CreateAchievementDto**

```typescript
import { IsString, IsNumber, IsEnum } from 'class-validator';

export class CreateAchievementDto {
  @IsString()
  salesOrderId: string;

  @IsString()
  userId: string;

  @IsEnum(['primary', 'assistant'])
  role: 'primary' | 'assistant';

  @IsNumber()
  shareRatio: number;

  @IsNumber()
  achievementAmount: number;
}
```

- [ ] **步骤 2：编写 AchievementsService**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesRepAchievement } from './entities/sales-rep-achievement.entity';
import { CreateAchievementDto } from './dto/create-achievement.dto';

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(SalesRepAchievement)
    private readonly repo: Repository<SalesRepAchievement>,
  ) {}

  create(dto: CreateAchievementDto) {
    return this.repo.save(this.repo.create(dto));
  }

  findByUser(userId: string) {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async summaryByUser() {
    return this.repo
      .createQueryBuilder('a')
      .select('a.userId', 'userId')
      .addSelect('SUM(a.achievementAmount)', 'total')
      .groupBy('a.userId')
      .getRawMany();
  }
}
```

- [ ] **步骤 3：编写 AchievementsController**

```typescript
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly service: AchievementsService) {}

  @Post()
  create(@Body() dto: CreateAchievementDto) {
    return this.service.create(dto);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.service.findByUser(userId);
  }

  @Get('summary')
  summary() {
    return this.service.summaryByUser();
  }
}
```

- [ ] **步骤 4：修改 AchievementsModule**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesRepAchievement } from './entities/sales-rep-achievement.entity';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SalesRepAchievement])],
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
```

- [ ] **步骤 5：Commit**

```bash
git add src/achievements
git commit -m "feat: add sales rep achievement module"
```

---

## 任务 4：Reports 模块（基础报表）

**文件：**
- 创建：`src/reports/reports.service.ts`
- 创建：`src/reports/reports.controller.ts`
- 修改：`src/reports/reports.module.ts`

- [ ] **步骤 1：编写 ReportsService**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { SalesRepAchievement } from '../achievements/entities/sales-rep-achievement.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRepo: Repository<PaymentRecord>,
    @InjectRepository(SalesRepAchievement)
    private readonly achievementRepo: Repository<SalesRepAchievement>,
  ) {}

  async salesSummary() {
    return this.orderRepo
      .createQueryBuilder('o')
      .select("DATE_TRUNC('day', o.createdAt)", 'date')
      .addSelect('COUNT(*)', 'orderCount')
      .addSelect('SUM(o.payAmount)', 'totalPayAmount')
      .where("o.status IN ('approved', 'synced_jst', 'shipped', 'completed')")
      .groupBy("DATE_TRUNC('day', o.createdAt)")
      .orderBy('date', 'DESC')
      .getRawMany();
  }

  async paymentCollect() {
    return this.paymentRepo
      .createQueryBuilder('p')
      .select('p.method', 'method')
      .addSelect('SUM(p.amount)', 'total')
      .groupBy('p.method')
      .getRawMany();
  }

  async repAchievement() {
    return this.achievementRepo
      .createQueryBuilder('a')
      .select('a.userId', 'userId')
      .addSelect('SUM(a.achievementAmount)', 'total')
      .groupBy('a.userId')
      .orderBy('total', 'DESC')
      .getRawMany();
  }
}
```

- [ ] **步骤 2：编写 ReportsController**

```typescript
import { Controller, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('sales-summary')
  salesSummary() {
    return this.service.salesSummary();
  }

  @Get('payment-collect')
  paymentCollect() {
    return this.service.paymentCollect();
  }

  @Get('rep-achievement')
  repAchievement() {
    return this.service.repAchievement();
  }
}
```

- [ ] **步骤 3：修改 ReportsModule**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { SalesRepAchievement } from '../achievements/entities/sales-rep-achievement.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SalesOrder, PaymentRecord, SalesRepAchievement])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
```

- [ ] **步骤 4：Commit**

```bash
git add src/reports
git commit -m "feat: add basic reports module"
```

---

## 任务 5：部署脚本与 Docker 验证

**文件：**
- 创建：`scripts/deploy.sh`
- 确认：`Dockerfile`
- 确认：`docker-compose.yml`

- [ ] **步骤 1：创建 scripts/deploy.sh**

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")/.."
docker compose down
docker compose up -d --build
echo "Deployment complete. App should be available at http://192.168.200.60:3000"
```

- [ ] **步骤 2：确认 Dockerfile 内容**

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

- [ ] **步骤 3：验证本地 Docker 构建**

```bash
docker compose build
```

预期：无报错，镜像构建成功。

- [ ] **步骤 4：Commit**

```bash
chmod +x scripts/deploy.sh
git add scripts/deploy.sh Dockerfile docker-compose.yml
git commit -m "chore: add deployment scripts and verify docker build"
```

---

## 自检

- 收款记录 API ✓
- 发货单查询 API ✓
- 业绩归属 API + 汇总 ✓
- 销售汇总 / 收款统计 / 业绩报表 ✓
- Docker 构建验证 ✓
- deploy.sh 可用于内网服务器一键部署 ✓
- 无占位符代码 ✓
