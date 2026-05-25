- 扫描时间：2026-05-22 17:35 (服务器 docker-compose `sales-erp-db`)
- 扫描人：admin（数据治理 grilling 后例行盘点）
- 关联决策：CONTEXT.md 第 8/9/10/11 条数据治理 decisions

## 数据画像（总览）

| 表              | 总量         | 健康                                    | 待治理                                       |
| --------------- | ------------ | --------------------------------------- | -------------------------------------------- |
| product_skus    | 330          | 281（聚水潭 EAN-13 同步）               | 49 杂格式（其中 29 无任何引用 → 可清理）     |
| bom_headers     | 80           | 80（sku_id 全部命中）                   | 21+ 个含悬空物料明细                         |
| bom_items       | 286          | 69（material_sku_id 命中 product_skus） | 217（悬空，老编码 3.XX.YYY）                 |
| stock_snapshots | 464 distinct | 130（与 product_skus 一致）             | 334（孤儿 sku_id）                           |
| customers       | 131          | 0（全部缺 tax_id）                      | 131 缺税号 / 41 缺 phone / 33 缺 contactName |

## 报告文件清单

### 01-orphan-sku-2026-05-22.csv（29 行）

完全孤立的 SKU——不在任何 BOM / 库存快照里被引用。

- 14 个聚水潭老条码（694xxxx, 697xxxx, 693xxxxx 开头，不是 6955631 系列）
- 8 个 `EMIE*` 老防伪标
- 6 个 `EMxxx` / `EMEI` 拼写错的
- 1 个 `EMIE211012btf` 异常编码

**处置建议**：销售/物控员 review，确认是「废弃 SKU」后整批 DELETE。盲删风险低（无任何下游引用）。

### 02-dangling-bom-items-2026-05-22.csv（217 行）

BOM 明细中 material_sku_id 在 product_skus 不存在。

- 编码格式如 `3.QT.140`、`3.JD.200`、`2.LJ.604`，是**老系统编码**
- 涉及 21+ 个 BOM headers（多为 KT / Kitty / 草莓熊系列）
- BOM 锚定的成品 SKU **存在** 80/80，但物料引用 286 条中 217 条悬空

**处置选项**（讨论项）：

- (a) 把 217 条老编码物料**反向建入 product_skus**（赋予新 skuCode = 老 ID，category 标"原材料"）——保留 BOM 完整性
- (b) 接受这批 BOM 实际**不可执行**，整批 DELETE（影响 21+ 个 BOM）
- (c) 标记这 21+ 个 BOM `isActive=false`，BOM v2 重建——保留历史快照不影响新流程

### 03-customer-missing-fields-2026-05-22.csv（131 行）

客户缺关键字段的全清单，按 `missing_tax_id` / `missing_phone` / `missing_contact` 标记。

- 131/131 缺税号——开票流程会卡
- 41 缺电话——审批联系不上
- 33 缺联系人——客户跟进失主

**处置建议**：不删，**发给销售员补录**（按 `primary_assignee_id` 分发）。

## 已执行操作

- ✅ **DELETE 334 行 stock_snapshots 孤儿**（2026-05-22 17:38）— 删前 464 / 删后 130，与 product_skus 命中数一致。下次 cron 同步会自动补齐。

## 未执行操作（待老板/物控员决策）

1. 29 个孤立 SKU 删除 → 等 review 后批量 DELETE
2. 217 条悬空 BOM 明细处置（a/b/c 三选一）→ 等讨论
3. 131 个客户补录 tax_id → 分发给销售员
