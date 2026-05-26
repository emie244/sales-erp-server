# PRD: 销售订单风控检查与本地库存联动

## Problem Statement

当前销售订单在创建和提交流程中缺少前置风控检查，业务员可以轻易绕过关键业务规则：

- **信用检查缺失**：`Customer` 实体已维护 `creditLimit` 和 `isCreditBlocked` 字段，但订单提交时完全没有调用，超信用额度的订单可直接进入审批流。
- **底价校验缺失**：`ProductSku` 仅有 `salePrice` 和 `costPrice`，没有 `floorPrice` 字段，低于公司底价的报价系统不做任何拦截。
- **交期管理缺失**：`SalesOrder` 没有 `deliveryDate` 字段，订单创建时不记录客户要求的交货日期，后续无法用于生产排程和交期跟踪。
- **发货不扣减本地库存**：`OrderLifecycle.markShipped()` 仅修改订单状态为 `shipped`，既不扣减本地库存也不生成出库流水，导致系统库存与实物库存严重脱节。

这些缺口使得"第一张订单在 ERP 里的漂流"在**第一站（销售模块）**和**第五站（发货出库）**就已断裂。

## Solution

在销售订单创建/提交流程中引入**三道自动检查**（客户信息、信用额度、底价校验），补充`deliveryDate`字段用于交期管理，并在发货时同步**扣减本地库存**并记录流水。所有检查通过可配置的策略模式实现，便于按业务场景调整严格程度。

## User Stories

1. As a 销售主管, I want 系统在业务员提交订单时自动检查客户信用额度和是否被拉黑, so that 超信用订单无法进入审批流。
2. As a 财务经理, I want 低于公司底价的报价订单需要上级特批或直接被拦截, so that 公司利润不被侵蚀。
3. As a 业务员, I want 在创建订单时填写预计交货日期, so that 客户、生产和采购部门可以协调排期。
4. As a 库管员, I want 订单发货后系统自动扣减对应 SKU 的本地库存并生成出库流水, so that 账实相符。
5. As a 系统管理员, I want 信用检查和底价校验可以独立配置（strict / warning / off）, so that 不同业务线可以灵活适配。
6. As a 审批人, I want 在飞书审批表单中看到该订单是否触发信用预警或底价偏差, so that 我的审批决策有充分信息。
7. As a 销售总监, I want 在订单列表中看到每个订单的交货日期和距离交期的剩余天数, so that 我可以快速识别即将逾期的订单。
8. As a 仓库主管, I want 查看本地库存流水记录（入库/出库/结余）, so that 月底对账有迹可循。
9. As a 业务员, I want 系统在我保存订单时给出明确的错误提示（如"客户信用额度不足，剩余额度：¥5,000"）, so that 我知道如何调整订单。
10. As a 运营人员, I want 已发货订单的库存扣减与聚水潭的库存快照独立运作, so that 本地库存层可以作为聚水潭数据的校验和补充。
11. As a 销售经理, I want 订单详情页展示该客户的当前应收余额和可用信用额度, so that 业务员在下单前就能判断风险。
12. As a 开发人员, I want 风控策略是纯函数、不依赖数据库, so that 它们易于单元测试和快速迭代。

## Implementation Decisions

### 1. 风控策略模块（纯函数，高内聚）

提取两个独立的**策略模块（Policy）**，封装检查逻辑：

- **`CreditCheckPolicy`**：输入为客户对象（含 `creditLimit`, `isCreditBlocked`, `settlementType`）和当前订单金额，输出检查结果对象 `{ passed: boolean; reason?: string; remainingCredit?: number }`。该模块不查询数据库，仅做纯数值计算。
- **`FloorPricePolicy`**：输入为 SKU 对象（含 `floorPrice`）和报价单价，输出检查结果。若 SKU 无 `floorPrice` 配置，默认通过。

两个 Policy 均通过构造函数接收配置对象（如 `{ creditCheckMode: 'strict' | 'warning' | 'off'; floorPriceMode: 'strict' | 'warning' | 'off' }`），实现运行时可配置。

### 2. OrderLifecycle 中集成风控检查

在 `OrderLifecycle.create()` 和 `OrderLifecycle.submit()` 的关键节点插入检查：

- **创建阶段（create）**：执行底价校验（因为此时 SKU 和单价已确定）。若 `floorPriceMode === 'strict'`，校验失败直接抛 `BadRequestException`；若为 `'warning'`，允许保存但记录预警标记。
- **提交阶段（submit）**：执行信用检查（因为此时订单总金额已锁定）。若 `creditCheckMode === 'strict'`，拦截提交；若为 `'warning'`，允许提交但将预警信息写入审批表单。

检查在事务外执行，失败时不启动数据库事务，减少数据库开销。

### 3. SalesOrder 增加 deliveryDate 字段

`SalesOrder` 增加 `deliveryDate: Date | null` 字段，nullable。对应 DTO 增加可选字段。前端订单创建/编辑表单增加日期选择器。

该字段不参与任何阻塞性校验（即不填也能保存），但会在订单列表中展示，并在后续用于账期计算（发货日期 → deliveryDate 之间的天数差）。

### 4. ProductSku 增加 floorPrice 字段

`ProductSku` 增加 `floorPrice: number | null` 字段，nullable，decimal(14,2)。前端 SKU 管理页面增加底价输入框（仅管理员可编辑）。

底价为空表示该 SKU 不启用底价校验。

### 5. 本地库存扣减模块（StockLedgerService）

新建 `StockLedgerService`，管理本地库存的增减流水：

- **`deductOutbound(params)`**：发货时调用。参数包含 `salesOrderId`、`skuId`、`qty`。写入一条 `StockLedger` 记录（type='outbound_sale'），并更新 `LocalStockBalance` 表中该 SKU 的结余数量。
- **`addInbound(params)`**：采购入库或生产入库时调用（本次 PRD 仅预留接口，采购入库联动在后续迭代实现）。

`StockLedger` 表字段：id, skuId, type(inbound/outbound), qty, referenceType(sales_order/purchase_order/production_order), referenceId, beforeQty, afterQty, createdAt。

`LocalStockBalance` 表字段：id, skuId, qty, lastUpdatedAt。

### 6. markShipped 联动库存扣减

`OrderLifecycle.markShipped()` 的现有逻辑是：检查订单状态 → 改为 `shipped`。修改后增加：

- 遍历订单 items，对每个 item 的 `skuId` 和 `qty` 调用 `StockLedgerService.deductOutbound()`。
- 若任一 SKU 的本地库存不足（`LocalStockBalance.qty < item.qty`），抛 `BadRequestException` 并阻止发货。
- 库存扣减和订单状态修改应在同一数据库事务中完成，保证原子性。

### 7. 审批表单中展示风控信息

`ApprovalFormBuilder.build()` 在构建销售订单审批表单时，读取订单的预警标记（如 `creditWarning`、`floorPriceWarning`），将这些信息作为只读字段或备注文案嵌入飞书表单。这不需要修改飞书 API 调用，仅需在 form 数组中增加 widget。

### 8. 配置化风控级别

风控级别通过环境变量或 NestJS `ConfigService` 提供默认值：

```
ORDER_CREDIT_CHECK_MODE=strict   # strict | warning | off
ORDER_FLOOR_PRICE_MODE=strict    # strict | warning | off
```

`OrderLifecycle` 通过构造函数注入配置，传递给 Policy 模块。这样生产环境可以设为 `strict`，测试环境可以设为 `off`。

## Testing Decisions

### 什么是好的测试

- 只测**外部行为**（输入 → 输出/副作用），不测实现细节（如内部调用了哪个私有方法）。
- Policy 模块是纯函数，只测输入输出矩阵。
- `StockLedgerService` 和 `OrderLifecycle` 的集成测试需要验证数据库状态变更。

### 需要测试的模块

| 模块 | 测试类型 | 理由 |
|------|----------|------|
| `CreditCheckPolicy` | 单元测试 | 纯函数，边界条件丰富（额度刚好等于、小于一分、负数等） |
| `FloorPricePolicy` | 单元测试 | 纯函数，需覆盖底价为空、底价等于报价、底价高于报价等场景 |
| `StockLedgerService` | 集成测试 | 涉及数据库事务和并发扣减（两个订单同时扣同一 SKU 的库存） |
| `OrderLifecycle.create()` | 集成测试 | 验证底价校验链（strict 拦截、warning 通过、off 跳过） |
| `OrderLifecycle.submit()` | 集成测试 | 验证信用校验链和审批表单生成 |
| `OrderLifecycle.markShipped()` | 集成测试 | 验证库存不足时阻止发货、库存充足时正确扣减 |

### 测试先验（Prior Art）

- 项目已有 Jest 单元测试框架（`npm run test`）。
- TypeORM 集成测试可参考现有 `*.service.spec.ts` 文件中的模式（使用 `TypeOrmModule.forRoot` + SQLite 内存数据库或测试 PostgreSQL 实例）。
- 并发库存扣减测试需要验证数据库行锁或乐观锁行为。

## Out of Scope

以下功能不在本次 PRD 范围内，将在后续迭代中处理：

1. **MRP 运算引擎**：BOM 拆解、净需求计算、生产工单/采购申请的自动生成。
2. **采购入库联动**：采购订单收货后自动增加本地库存（`StockLedgerService.addInbound()` 已预留接口，但不在本次调用）。
3. **发票管理与会计凭证**：销售发票记录、应收凭证、收款凭证等业财一体化深水区。
4. **账期逾期报表**：基于 `paymentTerms` 和 `deliveryDate` 的应收账龄分析。
5. **扫码入库/批次管理**：仓库作业的扫码、批次、序列号追踪。
6. **交期联动预警**：采购交期变动自动回写销售订单预计完工日。
7. **生产工单关联销售订单**：`ProductionOrder.salesOrderId` 字段和自动匹配逻辑。

## Further Notes

- **并发安全**：`StockLedgerService.deductOutbound()` 必须使用数据库层面的行锁（`SELECT FOR UPDATE`）或乐观锁（版本号），防止两个并发发货请求超卖同一 SKU 的库存。
- **与聚水潭的关系**：本地库存层（`LocalStockBalance`）独立于聚水潭库存快照（`stocks` 模块）。聚水潭数据作为外部参考，本地库存层作为业务操作的权威记录。未来可通过对比发现差异。
- **信用额度计算**：信用检查中"已用额度"的计算口径应包括：该客户的所有**未完全回款**的销售订单的 `payAmount` 之和，减去 `collectedAmount` 和 `prepaymentDeducted`。本次实现中，为简化逻辑，先以订单总金额作为占用；后续迭代可细化为"已发货未回款"口径。
- **存量数据迁移**：`ProductSku.floorPrice` 和 `SalesOrder.deliveryDate` 为新增 nullable 字段，不需要数据回填。`StockLedger` 和 `LocalStockBalance` 为新表，不影响现有数据。
- **存量订单处理**：对于已存在的 `shipped` 状态订单，其库存扣减不在本次补录（历史数据不追溯），仅对新发货的订单生效。
