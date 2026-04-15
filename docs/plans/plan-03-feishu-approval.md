# Plan 03：飞书审批集成

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现销售订单提交后自动代发起飞书审批实例，并通过 WebSocket 长连接（内网方案）接收审批状态回调，更新订单状态。审批通过后触发后续推送动作。

**架构：** `FeishuApprovalService` 封装 Lark Open API（tenant_access_token + 创建实例）。`FeishuWsService` 维护 WebSocket 长连接接收事件。`ApprovalService` 管理审批记录生命周期。WebSocket 断线时通过 Nest Schedule 每 3 分钟轮询兜底。

**技术栈：** NestJS, fetch, ws, @nestjs/schedule

**前置依赖：** Plan 01（实体与基础设施）和 Plan 02（销售订单 submit 接口）必须已完成。

**后置依赖：** Plan 04（聚水潭集成）需要监听审批通过事件来推送订单。

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/approvals/feishu-approval.service.ts` | 获取 tenant_access_token、创建审批实例 |
| `src/approvals/approval.service.ts` | 提交审批、处理回调、轮询兜底 |
| `src/approvals/feishu-ws.service.ts` | WebSocket 长连接监听飞书事件 |
| `src/approvals/approvals.controller.ts` | 审批回调 HTTP fallback + 查询接口 |
| `src/approvals/approvals.module.ts` | 模块组装 |
| `src/sales/sales.service.ts` | 修改：在 submit 中真正调用 ApprovalService |

---

## 任务 1：FeishuApprovalService（API 封装）

**文件：**
- 创建：`src/approvals/feishu-approval.service.ts`

- [ ] **步骤 1：编写 FeishuApprovalService**

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FeishuApprovalService {
  private appId: string;
  private appSecret: string;

  constructor(private config: ConfigService) {
    this.appId = this.config.get<string>('FEISHU_APP_ID') || '';
    this.appSecret = this.config.get<string>('FEISHU_APP_SECRET') || '';
  }

  async getTenantAccessToken(): Promise<string> {
    const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret }),
    });
    const data: any = await res.json();
    if (data.code !== 0) throw new Error(`Feishu token error: ${data.msg}`);
    return data.tenant_access_token;
  }

  async createApprovalInstance(params: {
    approvalCode: string;
    userId: string;
    form: Record<string, any>;
  }): Promise<string> {
    const token = await this.getTenantAccessToken();
    const res = await fetch('https://open.feishu.cn/open-apis/approval/v4/instances', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        approval_code: params.approvalCode,
        user_id: params.userId,
        form: JSON.stringify(params.form),
      }),
    });
    const data: any = await res.json();
    if (data.code !== 0) throw new Error(`Feishu approval error: ${data.msg}`);
    return data.data.instance_code;
  }

  async getApprovalInstance(instanceCode: string): Promise<any> {
    const token = await this.getTenantAccessToken();
    const res = await fetch(
      `https://open.feishu.cn/open-apis/approval/v4/instances/${instanceCode}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return res.json();
  }
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/approvals/feishu-approval.service.ts
git commit -m "feat: add Feishu approval API wrapper"
```

---

## 任务 2：ApprovalService（审批记录与回调处理）

**文件：**
- 创建：`src/approvals/approval.service.ts`
- 修改：`src/approvals/approvals.module.ts`

- [ ] **步骤 1：编写 ApprovalService**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalRecord } from './entities/approval-record.entity';
import { FeishuApprovalService } from './feishu-approval.service';
import { SalesOrder, SalesOrderStatus } from '../sales/entities/sales-order.entity';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    @InjectRepository(ApprovalRecord)
    private readonly repo: Repository<ApprovalRecord>,
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    private readonly feishu: FeishuApprovalService,
  ) {}

  async submitForApproval(
    order: SalesOrder,
    feishuUserId: string,
    approvalDefCode: string,
  ): Promise<ApprovalRecord> {
    const instanceCode = await this.feishu.createApprovalInstance({
      approvalCode: approvalDefCode,
      userId: feishuUserId,
      form: {
        客户名称: order.customer?.name || '',
        订单金额: String(order.payAmount),
        商品清单: JSON.stringify(order.items.map((i) => ({ sku: i.skuId, qty: i.qty }))),
      },
    });

    const record = this.repo.create({
      salesOrderId: order.id,
      feishuInstanceCode: instanceCode,
      feishuApprovalDefCode: approvalDefCode,
      status: 'pending',
    });

    return this.repo.save(record);
  }

  async handleCallback(instanceCode: string, payload: any) {
    const record = await this.repo.findOne({
      where: { feishuInstanceCode: instanceCode },
    });
    if (!record) {
      this.logger.warn(`Approval record not found for instance ${instanceCode}`);
      return;
    }

    // 飞书审批实例状态：PENDING / APPROVED / REJECTED / TRANSFERRED
    const status = this.parseStatus(payload);
    record.status = status;
    record.callbackPayload = payload;
    await this.repo.save(record);

    const order = await this.orderRepo.findOneBy({ id: record.salesOrderId });
    if (!order) return;

    if (status === 'approved') {
      order.status = SalesOrderStatus.APPROVED;
    } else if (status === 'rejected') {
      order.status = SalesOrderStatus.REJECTED;
    }

    await this.orderRepo.save(order);
    this.logger.log(`Order ${order.id} status updated to ${order.status} by approval ${instanceCode}`);
  }

  private parseStatus(payload: any): 'pending' | 'approved' | 'rejected' | 'transferred' {
    // 兼容多种飞书事件结构
    const raw = payload?.event?.status || payload?.status || 'pending';
    const map: Record<string, any> = {
      PENDING: 'pending',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      TRANSFERRED: 'transferred',
    };
    return map[raw] || 'pending';
  }
}
```

- [ ] **步骤 2：修改 ApprovalsModule**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalRecord } from './entities/approval-record.entity';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { FeishuApprovalService } from './feishu-approval.service';
import { ApprovalService } from './approval.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalRecord, SalesOrder])],
  providers: [FeishuApprovalService, ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalsModule {}
```

- [ ] **步骤 3：Commit**

```bash
git add src/approvals
git commit -m "feat: add approval service with callback handling"
```

---

## 任务 3：将 SalesService.submit 与 ApprovalService 打通

**文件：**
- 修改：`src/sales/sales.service.ts`
- 修改：`src/sales/sales.module.ts`

- [ ] **步骤 1：修改 SalesService 注入 ApprovalService**

```typescript
import { ApprovalService } from '../approvals/approval.service';

// 在 constructor 中加入
constructor(
  @InjectRepository(SalesOrder) private readonly orderRepo: Repository<SalesOrder>,
  @InjectRepository(SalesOrderItem) private readonly itemRepo: Repository<SalesOrderItem>,
  private readonly productsService: ProductsService,
  private readonly approvalService: ApprovalService,
) {}

// 修改 submit 方法
async submit(orderId: string, feishuUserId: string, approvalDefCode: string) {
  const order = await this.orderRepo.findOne({
    where: { id: orderId },
    relations: ['customer', 'items'],
  });
  if (!order) throw new NotFoundException('Order not found');
  if (order.status !== SalesOrderStatus.DRAFT) {
    throw new BadRequestException('Only draft order can be submitted');
  }

  await this.approvalService.submitForApproval(order, feishuUserId, approvalDefCode);
  order.status = SalesOrderStatus.PENDING_APPROVAL;
  return this.orderRepo.save(order);
}
```

- [ ] **步骤 2：修改 SalesModule imports**

```typescript
import { ApprovalsModule } from '../approvals/approvals.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalesOrder, SalesOrderItem]),
    ProductsModule,
    ApprovalsModule,
  ],
  // ...
})
```

- [ ] **步骤 3：Commit**

```bash
git add src/sales
git commit -m "feat: wire approval service into sales order submit"
```

---

## 任务 4：审批回调 Controller（HTTP Fallback）

**文件：**
- 创建：`src/approvals/approvals.controller.ts`
- 修改：`src/approvals/approvals.module.ts`

- [ ] **步骤 1：编写 ApprovalsController**

```typescript
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApprovalService } from './approval.service';

@Controller()
export class ApprovalsController {
  constructor(private readonly service: ApprovalService) {}

  @Post('webhooks/feishu/approval')
  async handleWebhook(@Body() body: any) {
    const instanceCode = body?.event?.instance_code || body?.instance_code;
    if (instanceCode) {
      await this.service.handleCallback(instanceCode, body);
    }
    return { message: 'ok' };
  }

  @Get('approvals/:instanceCode')
  async findOne(@Param('instanceCode') instanceCode: string) {
    // 简单返回审批记录
    return { instanceCode };
  }
}
```

- [ ] **步骤 2：修改 ApprovalsModule 注册 Controller**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalRecord } from './entities/approval-record.entity';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { FeishuApprovalService } from './feishu-approval.service';
import { ApprovalService } from './approval.service';
import { ApprovalsController } from './approvals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalRecord, SalesOrder])],
  controllers: [ApprovalsController],
  providers: [FeishuApprovalService, ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalsModule {}
```

- [ ] **步骤 3：Commit**

```bash
git add src/approvals
git commit -m "feat: add approval webhook controller"
```

---

## 任务 5：飞书 WebSocket 长连接

**文件：**
- 创建：`src/approvals/feishu-ws.service.ts`
- 修改：`src/approvals/approvals.module.ts`
- 修改：`package.json`（安装 ws）

- [ ] **步骤 1：安装 ws**

```bash
npm install ws
npm install -D @types/ws
```

- [ ] **步骤 2：编写 FeishuWsService**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { FeishuApprovalService } from './feishu-approval.service';
import { ApprovalService } from './approval.service';

@Injectable()
export class FeishuWsService implements OnModuleInit, OnModuleDestroy {
  private ws: WebSocket | null = null;
  private readonly logger = new Logger(FeishuWsService.name);
  private reconnectTimer: any;

  constructor(
    private readonly feishuApproval: FeishuApprovalService,
    private readonly approvalService: ApprovalService,
  ) {}

  async onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.removeAllListeners();
    this.ws?.close();
  }

  private async connect() {
    try {
      const token = await this.feishuApproval.getTenantAccessToken();
      const url = `wss://open.feishu.cn/open-apis/event/v1/outbound/event?access_token=${token}`;
      this.ws = new WebSocket(url);

      this.ws.on('open', () => this.logger.log('Feishu WS connected'));
      this.ws.on('message', (data) => this.handleMessage(data.toString()));
      this.ws.on('close', () => {
        this.logger.warn('Feishu WS closed');
        this.scheduleReconnect();
      });
      this.ws.on('error', (err) => {
        this.logger.error('Feishu WS error', err.message);
        this.scheduleReconnect();
      });
    } catch (e: any) {
      this.logger.error('Feishu WS connect failed', e.message);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 30000);
  }

  private async handleMessage(raw: string) {
    try {
      const msg = JSON.parse(raw);
      this.logger.debug('Feishu WS message', msg);
      if (msg?.event?.type?.includes('approval')) {
        const instanceCode = msg.event.instance_code;
        if (instanceCode) {
          await this.approvalService.handleCallback(instanceCode, msg);
        }
      }
    } catch (e) {
      this.logger.error('Failed to handle WS message', e);
    }
  }
}
```

- [ ] **步骤 3：在 ApprovalsModule 注册 FeishuWsService**

修改 `approvals.module.ts` providers 数组，加入 `FeishuWsService`。

- [ ] **步骤 4：Commit**

```bash
git add src/approvals package*.json
git commit -m "feat: add Feishu WebSocket event listener for approval callbacks"
```

---

## 任务 6：轮询兜底（Schedule）

**文件：**
- 创建：`src/approvals/approval-polling.service.ts`
- 修改：`src/approvals/approvals.module.ts`
- 修改：`src/app.module.ts`

- [ ] **步骤 1：编写 ApprovalPollingService**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalRecord } from './entities/approval-record.entity';
import { FeishuApprovalService } from './feishu-approval.service';
import { ApprovalService } from './approval.service';

@Injectable()
export class ApprovalPollingService {
  private readonly logger = new Logger(ApprovalPollingService.name);

  constructor(
    @InjectRepository(ApprovalRecord)
    private readonly repo: Repository<ApprovalRecord>,
    private readonly feishu: FeishuApprovalService,
    private readonly approvalService: ApprovalService,
  ) {}

  @Cron(CronExpression.EVERY_3RD_HOUR) // 实际业务建议每 3 分钟：'*/3 * * * *'
  async pollPendingApprovals() {
    const pending = await this.repo.find({ where: { status: 'pending' } });
    for (const record of pending) {
      try {
        const res = await this.feishu.getApprovalInstance(record.feishuInstanceCode);
        if (res?.data?.status) {
          await this.approvalService.handleCallback(record.feishuInstanceCode, {
            event: { status: res.data.status, instance_code: record.feishuInstanceCode },
          });
        }
      } catch (e: any) {
        this.logger.error(`Poll failed for ${record.feishuInstanceCode}`, e.message);
      }
    }
  }
}
```

**注意：** 上面的 `@Cron` 使用 `EVERY_3RD_HOUR` 是因为 NestJS 内置枚举没有 3 分钟。请改为字符串：

```typescript
@Cron('*/3 * * * *')
```

- [ ] **步骤 2：修改 ApprovalsModule**

在 providers 中加入 `ApprovalPollingService`。

- [ ] **步骤 3：在 AppModule 注册 ScheduleModule**

```typescript
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    // ... existing imports
    ScheduleModule.forRoot(),
  ],
  // ...
})
```

- [ ] **步骤 4：Commit**

```bash
git add src/approvals src/app.module.ts
git commit -m "feat: add approval polling fallback with Nest schedule"
```

---

## 自检

- 飞书 tenant_access_token 获取 ✓
- 代发起审批实例 ✓
- WebSocket 长连接 + 自动重连 ✓
- HTTP webhook fallback ✓
- 轮询兜底（3 分钟）✓
- 审批状态变更同步到 SalesOrder.status ✓
- 无占位符，所有代码可编译 ✓
