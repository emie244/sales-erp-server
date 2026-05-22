# Plan 08（Phase 8.0）：销售订单管理 + 历史数据迁移

> **面向 AI 代理的工作者：** 必需子技能：superpowers:subagent-driven-development 或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）跟踪进度。

**目标：** ① 把飞书 Base 的 客户 / 销售订单 / 订单产品明细 / 订单收款明细 四张表全量迁入本地 PostgreSQL，让飞书表停写、本系统成为唯一主数据源；② 完善销售订单模块的查询/过滤/编辑/权限/导出，让销售员和老板能在本系统看到所有历史订单。

**不在范围内（Phase 8.5 暂缓）：** 开票申请、双轨应收、账期提醒、信用拦截、底价校验、MRP 建议、全链路追踪、销售业绩 KPI。

**架构：** Customers / Sales / SalesOrderItems / Payments 模块扩字段；MigrationModule 提供 CLI 入口；前端订单列表/详情页增强。

**技术栈：** NestJS、TypeORM、PostgreSQL、openpyxl/Node xlsx 解析、AntD Table。

**前置依赖：** Plan 01~05 已完成（基础设施 + 客户/产品/订单 + 飞书审批 + 聚水潭 + 收款）。CONTEXT.md 的 grilling 决策已记录。

**后置依赖：** Phase 8.5（开票 / 应收 / 信用 / MRP / 全链路）依赖本计划沉淀的订单数据基线。

---

## 决策出处

所有设计取舍来自 `CONTEXT.md` 的 Decisions 章节，本计划只是把决策翻译成可执行任务。执行前**必读** CONTEXT.md 中和"客户主数据迁移"、"飞书销售订单类 3 张表"、"订单编号沿用飞书规则"、"历史订单业务员映射"、"签单人字段重命名"、"历史订单明细 SKU 关联三档匹配"、"历史回款迁移保留税额字段"、"客户归属销售员独立于订单签单人"、"Phase 8 拆为两段发布"相关条目。

---

## 文件结构

| 文件                                                | 状态 | 职责                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/customers/entities/customer.entity.ts`         | 改   | 扩字段：`taxId`/`invoiceTitle`/`invoiceAddress`/`invoicePhone`/`invoiceBank`/`invoiceBankAccount`/`jstCustomerId`/`customerType`/`autoTier`/`isStrategic`/`tags`/`primaryAssigneeId`/`feishuRecordId`/`migrationSource`/`latestRemark`/`wechat`/`contactTitle`/`onlineShopUrls`；删 `level`；改 `isActive` → `customerStatus` 三态 |
| `src/sales/entities/sales-order.entity.ts`          | 改   | `signerId`→`salespersonId`；新增 `jstShopOwnerId`/`orderNo`/`feishuRecordId`/`migrationSource`                                                                                                                                                                                                                                     |
| `src/sales/entities/sales-order-item.entity.ts`     | 改   | 新增 `matchMethod`/`matchConfidence`/`miscDescription`/`barcodeText`/`productNameText`/`specText`/`feishuRecordId`/`orphanOrderNo`；`skuId` 改 nullable                                                                                                                                                                            |
| `src/payments/entities/payment-record.entity.ts`    | 改   | 新增 `taxRate`/`taxAmount`/`feishuRecordId`/`migrationSource`/`orphanOrderNo`/`methodNormalized`/`taxRateNormalized`                                                                                                                                                                                                               |
| `src/products/entities/product-sku.entity.ts`       | 改   | 新增 `codeCompliant`                                                                                                                                                                                                                                                                                                               |
| `src/customers/customers.service.ts`                | 改   | 适配新字段；新增 `autoTier` 计算                                                                                                                                                                                                                                                                                                   |
| `src/customers/customers.controller.ts`             | 改   | 列表筛选支持 `customerStatus`/`autoTier`/`primaryAssigneeId`/`tags`                                                                                                                                                                                                                                                                |
| `src/sales/sales.service.ts`                        | 改   | 列表筛选支持 `salespersonId`/`customerId`/`status`/`dateRange`/`migrationSource`；导出 CSV                                                                                                                                                                                                                                         |
| `src/sales/sales.controller.ts`                     | 改   | `/sales-orders/export` 端点；金额修正接口；非金额字段编辑接口；权限注解调整                                                                                                                                                                                                                                                        |
| `src/sales/services/order-amount-adjust.service.ts` | 新   | 金额修正接口（二级确认 + operation_logs 详细记录）                                                                                                                                                                                                                                                                                 |
| `src/migration/dictionaries/payment-method-map.ts`  | 新   | 收款方式 / 税率的硬编码标准化映射表                                                                                                                                                                                                                                                                                                |
| `src/dashboard/dashboard.service.ts`                | 改   | 仪表盘加"复核进度"KPI 聚合（待复核总量 / 7 天内已处理 / 超 30 天未处理）                                                                                                                                                                                                                                                           |
| `src/migration/migration.module.ts`                 | 新   | 一次性迁移 CLI 模块                                                                                                                                                                                                                                                                                                                |
| `src/migration/feishu-migration.service.ts`         | 新   | 迁移调度入口                                                                                                                                                                                                                                                                                                                       |
| `src/migration/parsers/customer-parser.ts`          | 新   | 客户解析与字段适配                                                                                                                                                                                                                                                                                                                 |
| `src/migration/parsers/order-parser.ts`             | 新   | 订单解析（沿用 YYYY-MM-NNNNNNNN 编号）                                                                                                                                                                                                                                                                                             |
| `src/migration/parsers/order-item-parser.ts`        | 新   | 三档 SKU 匹配                                                                                                                                                                                                                                                                                                                      |
| `src/migration/parsers/payment-parser.ts`           | 新   | 收款明细解析                                                                                                                                                                                                                                                                                                                       |
| `src/migration/parsers/user-resolver.ts`            | 新   | openId + name 双轨用户解析                                                                                                                                                                                                                                                                                                         |
| `src/migration/seeds/system-user.seed.ts`           | 新   | 系统用户预置（亿觅CRM）                                                                                                                                                                                                                                                                                                            |
| `src/migration/cli/run-migration.ts`                | 新   | nest cli 入口                                                                                                                                                                                                                                                                                                                      |
| `migrations/170XXXXXXX-Phase8SchemaAlter.ts`        | 新   | TypeORM 数据库迁移文件                                                                                                                                                                                                                                                                                                             |
| `web/src/api/sales.ts`                              | 改   | 增加导出/筛选参数；字段重命名                                                                                                                                                                                                                                                                                                      |
| `web/src/api/customers.ts`                          | 改   | 新字段支持                                                                                                                                                                                                                                                                                                                         |
| `web/src/pages/SalesOrderPage.tsx`                  | 改   | 列表筛选条；CSV 导出；migration tag 高亮；review-needed 高亮                                                                                                                                                                                                                                                                       |
| `web/src/pages/SalesOrderDetailPage.tsx`            | 改   | 展示 `salespersonId`/`jstShopOwnerId`/`migrationSource`/`feishuRecordId`；明细行 `matchMethod` 展示                                                                                                                                                                                                                                |
| `web/src/pages/CustomerPage.tsx`                    | 改   | 列表筛选 `customerStatus`/`autoTier`/`primaryAssigneeId`；展示 tags                                                                                                                                                                                                                                                                |

---

## 任务 1：实体改造（schema 变更）

**文件：**

- 改：`src/customers/entities/customer.entity.ts`
- 改：`src/sales/entities/sales-order.entity.ts`
- 改：`src/sales/entities/sales-order-item.entity.ts`
- 改：`src/payments/entities/payment-record.entity.ts`
- 改：`src/products/entities/product-sku.entity.ts`
- 改：所有 DTO 与 controller/service 中的 `signerId` 引用

- [ ] **步骤 1.1：Customer 实体扩字段**
  - 新增：`taxId`、`invoiceTitle`、`invoiceAddress`、`invoicePhone`、`invoiceBank`、`invoiceBankAccount`、`jstCustomerId`、`isCreditBlocked: boolean default false`、`customerType: 'standard'|'distributor'|'platform_shop'`、`tags: jsonb default '[]'`、`autoTier: 'strategic'|'active'|'dormant'|'new'`、`isStrategic: boolean default false`、`primaryAssigneeId: uuid nullable`、`feishuRecordId: varchar nullable`、`migrationSource: varchar nullable`、`latestRemark: text nullable`、`wechat: varchar nullable`、`contactTitle: varchar nullable`、`onlineShopUrls: jsonb nullable`。
  - **删除**：`level` 字段（autoTier 取代）。
  - 修改：`isActive` 替换为 `customerStatus: 'active'|'lead'|'dormant' default 'active'`。
  - 默认 `settlementType: 'one_off'`（一次性）。

- [ ] **步骤 1.2：SalesOrder 实体重命名与扩字段**
  - **重命名列**：`signer_id` → `salesperson_id`，TS 字段 `signerId` → `salespersonId`，关系 `signer` → `salesperson`。
  - 新增：`jstShopOwnerId: uuid nullable`、`orderNo: varchar UNIQUE not null`、`feishuRecordId: varchar nullable`、`migrationSource: varchar nullable`。
  - **全量搜索替换**`signerId` 引用：backend service、controller、DTO、前端 `web/src/api/sales.ts`、所有页面组件、聚水潭推送逻辑（推送时用 `jstShopOwnerId` 对应 user 的 `jushuitanShopId`）。

- [ ] **步骤 1.3：SalesOrderItem 扩字段**
  - 新增：`matchMethod: 'barcode'|'fuzzy'|'misc'|'unmatched' nullable`、`matchConfidence: numeric(3,2) nullable`、`miscDescription: text nullable`、`barcodeText: varchar nullable`、`productNameText: varchar nullable`、`specText: varchar nullable`、`feishuRecordId: varchar nullable`、`orphanOrderNo: varchar nullable`。
  - 现有 `skuId` 改为 `nullable: true`（misc/unmatched/orphan 行无 SKU）。

- [ ] **步骤 1.4：PaymentRecord 扩字段**
  - 新增：`taxRate: varchar nullable`、`taxAmount: decimal(14,2) default 0`、`feishuRecordId: varchar nullable`、`migrationSource: varchar nullable`、`orphanOrderNo: varchar nullable`、`methodNormalized: 'public_transfer'|'private_wechat'|'private_alipay'|'cash'|'other' nullable`、`taxRateNormalized: numeric(4,2) nullable`。
  - 现有 `salesOrderId` 改为 `nullable: true`（孤儿收款行 salesOrderId=NULL）。

- [ ] **步骤 1.5：ProductSku 加合规标记**
  - 新增：`codeCompliant: boolean default false`。
  - 同步时（`JushuitanSyncProcessor` 的 `sync-skus`）按正则校验 `sku_code` 是否符合 `^(CP|BC|YL)-[A-Z0-9]{2,}(-[A-Z0-9]{2,})?-\d{3}$`，回写 `codeCompliant`。

- [ ] **步骤 1.6：编写 TypeORM 数据库迁移文件**
  - 文件名：`migrations/170XXXXXXX-Phase8SchemaAlter.ts`
  - 内容：
    - `ALTER TABLE customers DROP COLUMN level;`（先备份为 `legacy_level` 保留 90 天）
    - `ALTER TABLE customers RENAME COLUMN is_active TO is_active_legacy;` 然后 `ADD COLUMN customer_status varchar default 'active';`
    - `ALTER TABLE sales_orders RENAME COLUMN signer_id TO salesperson_id;`
    - `ALTER TABLE sales_orders ADD COLUMN order_no VARCHAR UNIQUE, ADD COLUMN jst_shop_owner_id UUID, ADD COLUMN feishu_record_id VARCHAR, ADD COLUMN migration_source VARCHAR;`
    - `ALTER TABLE sales_order_items ADD COLUMN ...` 八个新字段（含 `orphan_order_no`），并 `ALTER COLUMN sku_id DROP NOT NULL`。
    - `ALTER TABLE payment_records ADD COLUMN tax_rate VARCHAR, ADD COLUMN tax_amount NUMERIC(14,2) DEFAULT 0, ADD COLUMN feishu_record_id VARCHAR, ADD COLUMN migration_source VARCHAR, ADD COLUMN orphan_order_no VARCHAR, ADD COLUMN method_normalized VARCHAR, ADD COLUMN tax_rate_normalized NUMERIC(4,2);` 并 `ALTER COLUMN sales_order_id DROP NOT NULL`。
    - `ALTER TABLE product_skus ADD COLUMN code_compliant BOOLEAN DEFAULT FALSE;`
  - 必须 idempotent（`IF NOT EXISTS` 防御）。

**验证：**

```bash
npm run build         # tsc + nest build
npm run start:dev     # 启动看 TypeORM synchronize 是否平稳
# 服务器：备份后 npm run typeorm:run-migrations
```

---

## 任务 2：用户/系统数据预置

**文件：**

- 新：`src/migration/seeds/system-user.seed.ts`
- 新：`src/migration/parsers/user-resolver.ts`

- [ ] **步骤 2.1：创建 system 用户**
  - email: `system@yimi.local`, role: `system`, name: `亿觅CRM`，permissions: `[]`。
  - 用于历史订单 `createdBy` 指向。
  - seed 函数：判断不存在则创建，已存在跳过。

- [ ] **步骤 2.2：UserResolver 实现 openId+name 双轨**

  ```typescript
  async resolve(input: { openId?: string; name?: string }): Promise<User> {
    if (input.openId) {
      const byOpenId = await this.userRepo.findOne({ where: { feishuOpenId: input.openId } });
      if (byOpenId) return byOpenId;
    }
    if (input.name) {
      const byName = await this.userRepo.findOne({ where: { name: input.name } });
      if (byName) return byName;
    }
    const placeholder = this.userRepo.create({
      email: `${input.name ?? input.openId ?? 'unknown'}@unknown.local`,
      name: input.name ?? '未知用户',
      role: 'migrated',
      permissions: [],
      metadata: { reviewNeeded: true },
    });
    return this.userRepo.save(placeholder);
  }
  ```

  - 占位用户产出后输出到 `migration-report.json` 的 `placeholderUsers` 列表，让运营核对。

---

## 任务 3：客户主数据迁移脚本

**文件：**

- 新：`src/migration/parsers/customer-parser.ts`
- 新：`src/migration/feishu-migration.service.ts`

- [ ] **步骤 3.1：读取飞书客户资源 xlsx**
  - 输入：`亿觅销售订单信息聚合_客户资源.xlsx`（131 行）。
  - 解析后字段映射 → `Customer` 实体（参考"客户主数据迁移字段裁剪"决策）。
  - 跳过 4 个填写率 0% 的字段（客户logo、SA直接跟进、首次合作日期、客户等级）。

- [ ] **步骤 3.2：写 customer 行**
  - 每行生成一个 `customers` 记录；`feishuRecordId` 来自飞书 `多维表格记录ID`。
  - `jstCustomerId` 来自飞书"客户ID"列（91 行有值，40 行留空）。
  - `tags` 取原始"客户标签"字符串整段塞入 jsonb 数组（不拆分）。
  - `customerStatus`：达成合作 → `active`，感兴趣/已联系 → `lead`，**额外**：从飞书订单表里"从未下过单"的 37 个客户 → `dormant`。
  - `migrationSource = 'feishu-base'`。
  - 客户开票字段（`taxId`/`invoiceTitle`/...）即使为空也建空字段，等 Phase 8.5 财务上线后回填。

- [ ] **步骤 3.3：autoTier 计算函数**
  - 写一个独立的 `CustomerAutoTierService.compute(customerId)`，规则：
    - `strategic`：过去 12 个月成交 > 100 万 / 合作时长 > 3 年 / `isStrategic=true`
    - `active`：1-100 万
    - `dormant`：< 1 万
    - `new`：合作 < 3 个月
  - 迁移结束后跑一遍全量；后续每日凌晨 cron 重算（cron 表达式 `0 2 * * *`，与聚水潭 SKU 同步错开）。

**验证：**

- 131 行客户表迁入；91 个有 `jstCustomerId`、40 个为空。
- 客户列表前端能筛 active/lead/dormant 三态。
- `autoTier` 字段每个客户都有值。

---

## 任务 4：销售订单 + 明细 迁移脚本

**文件：**

- 新：`src/migration/parsers/order-parser.ts`
- 新：`src/migration/parsers/order-item-parser.ts`

- [ ] **步骤 4.1：读取飞书销售订单 xlsx**
  - 输入：`亿觅销售订单信息聚合.xlsx` sheet `销售订单信息`（2541 行）。
  - 订单编号 100% 符合 `YYYY-MM-NNNNNNNN`，**原样保留**到 `sales_orders.orderNo`。
  - `feishuRecordId` 取自飞书"多维表格记录ID"。

- [ ] **步骤 4.2：客户匹配 + 自动补全**
  - 按"客户名称"匹配 `customers.name`，找不到的 8 个客户（57 张订单）自动创建（仅 `name` + `customerStatus='active'`），打 `tags=['migration-auto-created','review-needed']`。

- [ ] **步骤 4.3：业务员映射**
  - 用 UserResolver 解析"签单人"（飞书"签单人 (人员 )"列里有 openId+name 信息）→ 写入 `salespersonId`。
  - "创建人"如果是"亿觅CRM"→ `createdBy = system 用户 id`；否则用 UserResolver。
  - `jstShopOwnerId` 用 `salespersonId` 对应 user 的 `jushuitanShopId` 一次性回填（user 没绑 shop 则留空）。

- [ ] **步骤 4.4：写入订单**
  - 所有历史订单 `status = 'completed'`，`migrationSource = 'feishu-base'`。
  - **不**走审批/推送/履约流程（迁移脚本绕过状态机直接 insert）。
  - 订单金额字段：`subtotal`、`totalAmount`、`shippingFee`、`discountAmount` 等映射飞书原值。

- [ ] **步骤 4.5：客户 primaryAssigneeId 回填**
  - 订单全部入库后：对每个有订单的客户，取**最近一单**（按 `createdAt` 倒序）的 `salespersonId` 写入 `customers.primaryAssigneeId`。
  - 从未下过单的客户（37 个 dormant）留 `primaryAssigneeId = null`。

- [ ] **步骤 4.6：订单产品明细 SKU 三档匹配（含孤儿处理）**
  - 输入：sheet `订单产品明细`（10336 行）。
  - **第 0 步：订单号反查**：用"订单编号"反查本地 `sales_orders.orderNo`，反查失败的孤儿行 → `salesOrderId=NULL`、`orphanOrderNo=飞书订单编号`、`matchMethod='unmatched'`、行级 `metadata.reviewNeeded=true`；正常行进入匹配流程。
  - 匹配流程：
    1. **barcode**：13 位条码（飞书"商品编码"列）→ `product_skus.barcode`。命中 → `matchMethod='barcode'`, `matchConfidence=1.0`。
    2. **fuzzy**：(产品名称 + 规格型号) → `product_skus.skuName/spec` 的标准化模糊匹配（lowercase、去空白、去 `-null`）。命中 → `matchMethod='fuzzy'`, `matchConfidence=0.7~0.95`（按字符串相似度算）；`matchConfidence < 0.8` 强制打 `review-needed`。
    3. **misc**：产品名称含"邮费/售后补差/大管家导入/调整"等关键字 → `matchMethod='misc'`, `skuId=NULL`, `miscDescription=产品名称+规格型号`。
    4. **unmatched**：以上都失败 → `matchMethod='unmatched'`, `skuId=NULL`, 保留 `productNameText/specText/barcodeText` 原始字段，订单打 `review-needed` tag。
  - 输出报告：`migration-report.json` 列每档命中数、孤儿明细行清单（含 `orphanOrderNo`）。

- [ ] **步骤 4.7：订单金额自洽校验**
  - 对每张迁入订单计算 `expected = subtotal + shippingFee - discountAmount`。
  - 若 `|totalAmount - expected| > 0.5`：① 订单 `metadata.amountMismatch = { feishuTotal, computedTotal, diff }`；② 订单 `tags` 追加 `amountMismatch` 与 `review-needed`；③ 写入 `migration-report.json.amountMismatchOrders` 列表。
  - 0.5 元以内的尾差视为正常四舍五入，不打 tag。
  - **以飞书 totalAmount 为准入库**（不重算）。

**验证：**

- 2541 个 `sales_orders` 行入库；orderNo 全部符合 YYYY-MM-NNNNNNNN。
- `sales_order_items` 行数 ≈ 10336（misc 行也算）。
- `matchMethod` 分布：barcode ≈ 67%、fuzzy + misc ≈ 30%、unmatched < 5%。
- 8 个自动补全客户都有 `migration-auto-created` tag。
- 102 个有订单的客户都有 `primaryAssigneeId`。

---

## 任务 5：收款明细迁移脚本

**文件：**

- 新：`src/migration/parsers/payment-parser.ts`
- 新：`src/migration/dictionaries/payment-method-map.ts`

- [ ] **步骤 5.1：读 sheet `订单收款明细`**（3290 行）。

- [ ] **步骤 5.2：写 payment_records**
  - `salesOrderId` 按"订单编号"反查 `sales_orders.orderNo`；反查失败的孤儿收款 → `salesOrderId=NULL` + `orphanOrderNo=飞书订单编号` + `metadata.reviewNeeded=true`。
  - `amount = 收款金额`、`receivedAt = 收款日期`、`receivedBy = UserResolver.resolve("签单人")`。
  - **收款方式双字段**：`method = 飞书原文`（原样保留），`methodNormalized` 通过 `payment-method-map.ts` 硬编码字典映射（"对公"/"对公账户"/"银行转账"/"对公转账"/"汇款" → `'public_transfer'`；"微信"/"微信支付" → `'private_wechat'`；"支付宝" → `'private_alipay'`；"现金" → `'cash'`；未命中 → `'other'`，写入 `migration-report.json.unmappedMethods`）。
  - **税率双字段**：`taxRate = 飞书原文`（如 "0%"/"13%"/"未开票"，原样存），`taxRateNormalized` 解析为 numeric（"0%" → 0、"13%" → 0.13、"未开票"/空 → null）。
  - `taxAmount = 税额`（数字）、`type = 'collection'`、`migrationSource = 'feishu-base'`、`feishuRecordId = 飞书 record ID`。
  - **不**生成开票申请（即使税额 > 0）。

- [ ] **步骤 5.3：订单聚合字段回填**
  - 迁完后跑一次（只聚合非孤儿行）：
    ```sql
    UPDATE sales_orders SET collected_amount = (
      SELECT COALESCE(SUM(amount), 0) FROM payment_records
      WHERE sales_order_id = sales_orders.id AND type = 'collection'
    );
    ```

- [ ] **步骤 5.4：收款总额对账（硬阈值）**
  - 跑对账 SQL：`SELECT SUM(amount), SUM(tax_amount) FROM payment_records WHERE migration_source='feishu-base';`
  - 与飞书原表"收款金额"列汇总比对，**误差 > 100 元判定迁移失败**，输出到 `migration-report.json.collectedAmountDelta`。
  - 误差 ≤ 100 元判定通过，写入 `migration-report.json.checkpoints[].collectedAmount = pass`。

**验证：**

- 3290 条 payment_records 入库。
- 订单 collectedAmount 与原飞书表"收款金额"对账误差为 0。
- 抽查 5 张订单的回款明细数量与飞书一致。

---

## 任务 6：销售订单模块前端增强 + 复核中心

**文件：**

- 改：`web/src/api/sales.ts`
- 改：`web/src/pages/SalesOrderPage.tsx`
- 改：`web/src/pages/SalesOrderDetailPage.tsx`
- 改：`web/src/api/customers.ts`
- 改：`web/src/pages/CustomerPage.tsx`
- 改：`web/src/pages/PaymentRecordsPage.tsx`（如不存在则跳过）
- 改：`web/src/pages/DashboardPage.tsx`
- 新：`web/src/components/AmountAdjustModal.tsx`

- [ ] **步骤 6.1：订单列表筛选条 + 复核标记**
  - 顶部筛选条：业务员（select，admin 可选全部）、客户（autoComplete）、订单状态（multi-select）、日期范围（RangePicker，默认近 90 天）、订单来源（"全部 / 本系统 / 历史迁移"，对应 `migrationSource` is null / 'feishu-base'`)、**复核状态** Checkbox.Group（只看 `review-needed`/`amountMismatch`/`unmatched`，多选）。
  - 列表列：订单号、日期、客户、业务员、金额、收款金额、状态、来源 tag、复核 tag、操作。
  - "历史迁移"标识：`migrationSource='feishu-base'` 的订单显示淡黄色 tag。
  - `review-needed` / `amountMismatch` 订单显示红色 tag；`unmatched` 行所在订单显示橙色 tag。
  - 客户列表 / 收款列表同步加 `review-needed` 复选框筛选。

- [ ] **步骤 6.2：订单详情页 + 历史订单编辑**
  - 头部基本信息：订单号 / 客户 / 业务员 / 店铺主人 / 创建人 / 状态。
  - **历史订单警示条**：`migrationSource='feishu-base'` 时顶部显示 banner，含飞书 record ID（仅展示，不可点）+ "历史迁移订单，飞书原表 3 个月后归档"提示。
  - **非金额字段编辑（admin only）**：客户、业务员、备注、tags 允许直接编辑保存（走 `PATCH /sales-orders/:id`，标准 operation_logs 记录）。
  - **金额字段编辑（admin only，二级确认）**：`totalAmount`/`subtotal`/`discountAmount`/`shippingFee`/`paymentRecords.amount` 字段右侧加"修正"按钮 → 弹出 `AmountAdjustModal`：
    - 必填修正理由（textarea，≥ 10 字）。
    - 显示原值 → 新值 diff（红绿对比）。
    - 提交走 `POST /sales-orders/:id/adjust-amount` → 后端 `OrderAmountAdjustService` 落 `operation_logs.action='amount_adjust'`，`details` 含 `{ field, oldValue, newValue, reason }`。
  - **永久只读字段**：`feishuRecordId`、`migrationSource`、`orderNo`（无任何编辑入口）。
  - **非 admin 角色**：所有 feishu-base 订单字段灰显只读，无编辑按钮。
  - 明细行加列 `matchMethod`：
    - `barcode` → 绿色标签
    - `fuzzy` → 蓝色标签 + `matchConfidence` 数值
    - `misc` → 灰色标签 + `miscDescription` 提示
    - `unmatched` → 红色标签 + "需复核" 提示
  - 明细行 `skuId=null` 时不显示 SKU 链接，显示 `productNameText` + `specText` 原始字符串。
  - 收款记录区显示 `taxRate`/`taxAmount`/`method`（原文）/`methodNormalized`（小灰字 tag 在 `method` 右侧）/`taxRateNormalized`（百分数格式）。
  - 孤儿订单/孤儿收款（`salesOrderId=null` 且 `orphanOrderNo not null`）：详情入口在"复核中心"统一列表，单独 URL `/orphan-records?type=item|payment`，只 admin 可见。

- [ ] **步骤 6.3：订单 CSV 导出**
  - 后端：`GET /sales-orders/export?<同列表筛选参数>`，返回 CSV stream。
  - 列：订单号、日期、客户、业务员、金额、收款金额、状态、来源、复核标记、备注。
  - 前端：列表页右上"导出"按钮，用当前筛选条件触发；浏览器下载 `sales-orders-YYYY-MM-DD.csv`。
  - 权限：`order:export`（admin 默认有，普通销售员需配置）。

- [ ] **步骤 6.4：客户列表筛选与展示**
  - 顶部筛选条：客户状态（active/lead/dormant）、autoTier（strategic/active/dormant/new）、归属销售员（select）、`review-needed` 复选框。
  - 列加 `tags` 展示（用 AntD Tag 数组渲染，超过 3 个折叠"+N"）。
  - 详情页/弹窗加 `taxId`/`invoiceTitle`/`primaryAssignee` 字段（编辑权限：`customer:edit`）。

- [ ] **步骤 6.5：仪表盘"复核进度"KPI 卡片**
  - `DashboardPage.tsx` 顶部加一行 KPI 卡片：
    - **待复核总量**（数字）：`SELECT COUNT(*) FROM (订单/客户/收款) WHERE 'review-needed' = ANY(tags)`，三类相加。
    - **7 天内已复核**（数字 + 趋势）：`COUNT(*) WHERE updated_at >= now() - interval '7 days' AND 'review-needed' != ANY(tags) AND migration_source='feishu-base'`。
    - **超 30 天未处理**（数字 + 红色高亮）：`COUNT(*) WHERE created_at < now() - interval '30 days' AND 'review-needed' = ANY(tags)`。
  - 点击 KPI 卡片跳到对应列表（带筛选预设）。
  - 不设硬 SLA，纯做可视化指引。
  - 后端 `DashboardService.getReviewProgress()` 加聚合 SQL，路由 `GET /dashboard/review-progress`。

- [ ] **步骤 6.6：权限调整**
  - `permissions.ts` 新增：`order:export`、`order:adjust_amount`（金额修正）、`customer:bulk_review`（批量处理 review-needed）。
  - admin 角色 `*` 包含所有新增权限。
  - 普通销售员默认无 `order:export` 与 `order:adjust_amount`。

**验证：**

- 列表筛选每个条件单独可用，组合筛选符合预期；review-needed 复选框能筛出预期数量的记录。
- 详情页对历史订单展示完整原始信息；admin 能修正金额并在 operation_logs 看到记录。
- 非 admin 用户打开 feishu-base 历史订单看不到"修正"按钮。
- CSV 文件可用 Excel 打开，列顺序与列表一致。
- 客户列表能按 autoTier 筛"strategic"高价值客户。
- 仪表盘 KPI 数字与列表筛选结果一致。

---

## 任务 7：迁移 CLI + 周六批次切换发布

**文件：**

- 新：`src/migration/cli/run-migration.ts`
- 新：`scripts/run-feishu-migration.sh`
- 新：`scripts/feishu-archive-reminder.sh`（可选）

- [ ] **步骤 7.1：CLI 入口**
  - 命令：`npm run migrate:feishu -- --customers ./data/客户资源.xlsx --orders ./data/销售订单信息聚合.xlsx`。
  - 支持 `--dry-run` 不写入数据库。
  - 支持 `--phase=customers|orders|payments|aggregate` 单步跑（出错重跑用）。
  - 支持 `--reconcile` 只跑对账（不写库）：读 xlsx 汇总 → 查 DB 汇总 → 输出 `reconcile-report.json`（订单数差异 / 收款总额差异 / 各 tag 计数 / 孤儿计数 / amountMismatch 计数）。
  - 输出 `migration-report.json`：每步处理行数、跳过原因、`review-needed` 列表、`placeholderUsers` 列表、`unmatched` 明细行清单、`orphanItems`/`orphanPayments`、`amountMismatchOrders`、`unmappedMethods`、`checkpoints`（硬阈值通过/失败）。

- [ ] **步骤 7.2：迁移顺序**
  1. system 用户预置
  2. 客户（131 行 + 8 自动补全 = 139 条）
  3. 订单（2541 条）
  4. 订单明细（10336 条，三档匹配 + 孤儿处理）
  5. 收款（3290 条，孤儿处理 + 双字段标准化）
  6. 订单 collectedAmount 回填
  7. 订单金额自洽校验（amountMismatch 报表）
  8. 客户 primaryAssigneeId 回填
  9. 客户 autoTier 计算
  10. 硬阈值检查（订单数 ≥ 2530，收款总额差 < 100 元）

- [ ] **步骤 7.3：周六批次切换发布步骤**
  - **D-2（周四）**：本地 docker compose 跑全量迁移 → 检查 `migration-report.json` 各 checkpoint → 跑前端 smoke（订单列表 / 详情 / CSV 导出 / 复核 KPI）。
  - **D-1（周五）下班前**：飞书群广播切换通知（"周六 9:00 飞书订单表停写，统一切换到本系统"）；admin 在飞书设置定时只读权限。
  - **D-Day（周六）9:00**：飞书 Base 四张表（客户资源 / 销售订单 / 订单产品明细 / 订单收款明细）设为只读（飞书管理员二次确认所有锁定生效）；下载最新 xlsx 到本地。
  - **D-Day 9:10**：SSH 服务器，先 `pg_dump` 备份生产 DB 到 `/tmp/sales_erp_pre_phase8_$(date +%Y%m%d_%H%M).sql`。
  - **D-Day 9:20**：服务器拉代码 + `npm run build:all` + `docker compose exec app npm run typeorm:run-migrations`（schema 迁移）。
  - **D-Day 9:30**：服务器跑数据迁移 `docker compose exec app npm run migrate:feishu -- --customers /uploads/客户资源.xlsx --orders /uploads/销售订单信息聚合.xlsx`，预计 30~60 分钟。
  - **D-Day 10:30-11:00**：跑对账 `--reconcile` 模式 → 检查硬阈值（订单数 ≥ 2530 + 收款总额差 < 100 元）→ 输出 `reconcile-report.json`。
  - **D-Day 11:00 决策点**：
    - **通过**：飞书群广播"切换完成，新订单录入本系统，历史订单已就绪可查询"；admin 把当周复核 KPI 截图发群里。
    - **失败**（硬阈值未达标 / 致命 bug）：执行 `pg_restore /tmp/sales_erp_pre_phase8_*.sql` → 飞书广播"本次切换推迟，飞书恢复可写，下周六重试"→ admin 复盘 `migration-report.json` 失败项。

- [ ] **步骤 7.4：飞书归档 3 个月计划**
  - **D-Day 当天**：飞书 4 张表设为只读（保留可读）。
  - **D-Day + 90 天**：admin 把飞书 4 张表导出为 XLSX → 上传到公司云盘 `飞书停用归档/<YYYY-MM>/`（路径在 CLAUDE.md 记录）→ 飞书 Base 表删除。
  - **D-Day + 83 天**：cron 任务 `scripts/feishu-archive-reminder.sh` 通过飞书机器人提醒 admin "7 天后将归档 XX 表"（cron 在迁移完成后由 admin 单独配置，本计划不实现）。
  - 归档责任人：admin 角色用户（运营 / 老板）。

---

## 验收标准

**构建**

- [ ] `npm run build` 通过
- [ ] `cd web && npm run build` 通过

**数据完整性**

- [ ] 迁移脚本本地跑通：131 客户 + 2541 订单 + 10336 明细 + 3290 收款全部入库（含孤儿行）
- [ ] **硬阈值通过**：`sales_orders` 行数 ≥ 2530（与飞书 2541 差异 ≤ 11，< 0.5%）
- [ ] **硬阈值通过**：`SUM(payment_records.amount) WHERE migration_source='feishu-base'` 与飞书原表汇总差异 < 100 元
- [ ] `migration-report.json` 中 `checkpoints.orderCount = pass` 与 `checkpoints.collectedAmount = pass`
- [ ] `migration-report.json` 输出 `orphanItems` / `orphanPayments` / `amountMismatchOrders` / `unmappedMethods` 完整列表
- [ ] `unmatched` 比例 < 5%（参考指标，不阻塞）

**功能**

- [ ] 销售员能用业务员/客户/日期筛选查到历史订单
- [ ] 订单详情页对历史迁移订单清晰展示来源 + 飞书 record ID
- [ ] admin 用 `AmountAdjustModal` 修正历史订单金额，operation_logs 留下 `amount_adjust` 记录
- [ ] 非 admin 角色打开历史订单看不到"修正"按钮
- [ ] 仪表盘"复核进度"KPI 卡片显示待复核 / 7 天内已复核 / 超 30 天未处理三类数字
- [ ] 复核 KPI 卡片点击跳转到对应列表（带 `review-needed=true` 筛选）
- [ ] CSV 导出可用 Excel 打开，与筛选条件一致
- [ ] 客户列表能按 `autoTier` / `customerStatus` / `primaryAssignee` 筛选

**发布**

- [ ] 周六批次切换完成（pg_dump 备份 + 数据迁移 + reconcile 通过）
- [ ] 飞书 4 张表设为只读 + 群通知发送
- [ ] 通过后下一周内监测：本系统订单数稳定增长，飞书表无新增写入

---

## 风险与回滚

- **迁移失败回滚（已纳入周六切换流程）**：每次跑迁移前自动 `pg_dump` 到 `/tmp/sales_erp_pre_phase8_$(date +%Y%m%d_%H%M).sql`。硬阈值未达标 / 致命 bug → `pg_restore` + 飞书恢复可写 + 推迟到下周六。
- **业务员映射误判**：UserResolver 优先 openId，若飞书 openId 失效回退到 name；同名风险通过 `migration-report.json.placeholderUsers` 输出占位用户列表，admin 在复核中心逐个核对替换。
- **SKU 模糊匹配误关联**：`matchConfidence < 0.8` 的 fuzzy 行强制打 `review-needed` tag；`unmatched` 行 SKU 留空显示原文，避免错误关联。
- **孤儿行处理**：明细/收款反查不到订单号时入库但 `salesOrderId=NULL` + `orphanOrderNo=飞书订单编号` + `review-needed` tag；不影响硬阈值通过，但运营需在 30 天内人工归并或核销，超期由仪表盘 KPI 报警。
- **金额不自洽**：以飞书 `totalAmount` 为准入库，差额 > 0.5 元的订单打 `amountMismatch` + `review-needed` tag，输出 `migration-report.json.amountMismatchOrders`；admin 可走 `AmountAdjustModal` 修正并留 operation_logs。
- **收款方式未命中字典**：未在 `payment-method-map.ts` 命中的飞书原文 → `methodNormalized='other'` + 输出 `migration-report.json.unmappedMethods`；admin 评估后扩字典再回填一次（reconcile 模式可重跑映射）。
- **signerId → salespersonId 重命名遗漏**：用 `rg "signerId"` 全仓搜索，验证 0 残留；前端组件编译通过即视为完成。
- **历史订单与现有数据冲突**：迁移前确认本地 `sales_orders` 为空（开发库已清）；生产库若有先前测试数据，迁移前手动 `TRUNCATE` 相关表。
- **3 个月飞书归档遗忘**：90 天后由 admin 手动导出 XLSX 上传云盘 + 删除飞书表（cron 提醒 D+83 天）。计划本身不实现 cron，admin 自行配置或日历提醒。

---

## Phase 8.5 预告（不在本计划范围）

- 开票申请模块（InvoiceRequest / InvoiceItem 实体 + 待开票队列 + 回填发票号 + 作废）
- 双轨应收聚合（业务应收 + 税务应收 dashboard）
- 账期提醒（cron 扫超期）
- 信用拦截（下单守卫，基于业务应收）
- 底价校验（B 端订单最低价规则）
- MRP 建议（物控员日级批量决策）
- 全链路追踪 dashboard（订单 → 出库 → 开票 → 收款 → 应收）
- 销售业绩 KPI 看板（迁飞书"销售业绩目标"表 + 实时完成度）
