# Sales ERP — 商品与供应链上下文

管理产品定义、规格型号、物料清单、采购与加工入库的核心业务领域。

## Language

**产品 (Product)**:
一个可销售的商品概念，包含名称、分类、生命周期阶段。一个产品可以有一个或多个规格。
_Avoid_: 商品（在口语中常与 SKU 混用）

**规格 (SKU)**:
一个产品的具体可销售/可库存单位，具有唯一的编码、价格、图片、规格参数。SKU 是库存、采购、销售订单中的最小操作单元。
_Avoid_: 商品（口语混用）、variant

**物料 (Material)**:
用于生产加工 BOM 的原材料或半成品。**现状**：物料和成品 SKU 共用 `product_skus` 表，靠聚水潭 `item_type` 字段区分（成品 / 半成品 / 原材料 / 包材）。「物料编码」**就是**聚水潭 `sku_code`，没有独立编号体系——本地不能改 SKU 编码（聚水潭主权）。BOM 通过 `bom_items.material_sku_id` 引用 SKU，通过 `material_category_id` 把 SKU 挂到本地分类树。
_Avoid_: 原材料（范围过窄，物料包含半成品）

**物料分类 (Material Category)**:
三级树形结构，用于组织物料（成品 / 半成品 / 原材料 → 子分类）。与产品的商品分类相互独立。
_Avoid_: 商品分类（与产品的 marketing category 不同）

**B 端订单 (B2B Order)**:
面向线下大客户/经销商的销售订单，由本系统作为主权所有者：完整管理审批、信用、底价、MRP、生产、出库、开票、收款。**不**回写聚水潭。
_Avoid_: 线下订单（范围过窄，不包含可能的渠道商电子下单）

**C 端订单 (B2C / E-commerce Order)**:
面向电商平台/三方仓的销售订单，由聚水潭作为主权所有者：本系统仅负责销售合同审批，审批通过后推送给聚水潭，履约、库存、发货由聚水潭管控。
_Avoid_: 电商订单（在某些平台叫法不同）

**业务主权域 (Business Sovereignty Domain)**:
一条业务流的"事实最终来源"所在的系统。本系统的 B 端订单主权在本地；C 端订单主权在聚水潭。库存按主权域分池管理，不可混用。

**开票申请 (Invoice Request)**:
B 端订单出库后由本系统自动或手动生成的"待开票"凭证。携带客户抬头、税号、税率、金额行项，状态从 `requested → issued → revoked`。财务用税控盘开具真实税务发票后，回填发票号和 PDF 到本系统，状态变 `issued`。**本系统不直接开具税务发票**。
_Avoid_: 发票（裸用"发票"两字在中文里既可指税务发票，也可指开票申请，会混淆）

**业务应收 (Business Receivable)**:
从销售视角看的客户欠款，公式 `Σ 已发货订单金额 - Σ 已收款金额`，**不论是否开票**。用于销售/老板视角监控客户欠款，触发信用拦截和账期提醒。
_Avoid_: 应收账款（默认理解会偏向税务口径）

**税务应收 (Tax Receivable)**:
从财务/税务视角看的开票后欠款，公式 `Σ 已开票金额 - Σ 已核销发票金额`。用于跟税务申报、财务报表对账。
_Avoid_: 应收账款（同上）

**本地虚拟仓 (Local Virtual Warehouse)**:
本系统内部记账用的逻辑仓，**没有对应物理仓库**。专门用来跟踪原材料：采购单到货后"虚拟入库"到这里，委外加工时按 BOM 扣减。物理上原材料其实在委外厂或聚水潭仓里，但物权和数量在本地账上独立管理。区别于 `warehouseId = 'default'` 的聚水潭镜像仓（存成品）。
_Avoid_: 虚拟库存（容易和"占用库存/可用库存"概念混淆）

**委外加工 (Outsourced Processing)**:
本品牌方将 BOM 中定义的原材料发给委外加工厂（或聚水潭联营仓），由其按工艺完成生产，最终成品按 SKU 入聚水潭仓。本系统的 `ProductionOrder` 用来跟踪一次委外加工：消耗哪些原材料、生成多少成品。**本系统不上自营产线**。
_Avoid_: 生产（默认理解会偏向自营产线）

## Relationships

- 一个 **产品** 包含一个或多个 **规格**
- 一个 **规格** 属于恰好一个 **产品**
- 一个 **规格** 可以关联零个或一个 **BOM**
- 一个 **BOM** 包含多个 **物料**（通过 bom_items）
- 一个 **物料** 属于一个 **物料分类**

## Decisions

- **聚水潭为主数据源头**（[ADR-0001](./docs/adr/0001-jushuitan-master-data.md)）：产品/规格的新建和编辑在聚水潭完成，本系统只读同步。
- **业务流分域主权**（[ADR-0002](./docs/adr/0002-business-sovereignty-domain.md)）：C 端订单（电商/三方仓）主权在聚水潭，B 端订单（线下大客户）主权在本系统。两边库存分池，定期对账。
- **B 端订单履约现状**：本系统 100% 通过聚水潭仓发货（聚水潭做 3PL/WMS 角色），短期内不会引入自建出库流程。Phase 8 仅做财务层（开票/收款/账期）和决策层（信用/底价/MRP 建议/全链路追踪），不自建 `DeliveryOrder` / 拣货扫码 / 库存占用。
- **开票流程为人工驱动**：很多 B 端客户不走对公付款（私账、微信、支付宝），无法或不需要开税务发票。所以 `Invoice Request` 不由发货同步自动触发，而是由财务人员从「待开票队列」中手动勾选发货明细生成。
- **应收账款双轨制**（[ADR-0003](./docs/adr/0003-dual-track-receivable.md)）：业务应收（按发货算）和税务应收（按发票算）并存。所有信用拦截、账期提醒走业务应收口径；财务报表、税务申报走税务应收口径。
- **前端商品管理采用产品列表 → 详情页 → SKU 列表** 的层级结构（方案 A），去掉本地新建入口，保留同步按钮。
- **产品列表页视图**：支持卡片视图（默认）和表格视图切换，表格视图带大图预览弹窗。
- **物料分类入口**：不单独放在左侧菜单，而是作为商品管理页面的一个标签页（【产品列表】|【SKU 列表】|【物料分类】）。
- **BOM 版本管理**：聚水潭同步始终覆盖 `v1`（只读），本地可手动创建 `v2+` 版本。一个 SKU 同时只能有一个版本处于 `isActive` 状态。BOM 版本切换和编辑在独立的 BOM 详情页中操作。
- **本地虚拟仓入库时机**：采购单标记"已到货"时入虚拟仓（`warehouseId = 'local-virtual'`），不在 PO 创建/审批时入。表达"现在有这么多料能用"，避免 MRP 用画饼库存算净需求。
- **本地虚拟仓出库时机**：`ProductionOrder` 从 `PENDING → PROCESSING` 时按 BOM 硬扣虚拟仓，`CANCELLED` 走显式回滚。不引入"软占用/reserved"概念。MRP 高估容忍——它本就是"建议"级。
- **ProductionOrder 与聚水潭成品库存解耦**：本地 `ProductionOrder` 只用于材料消耗 + 委外加工成本记账，**不**和聚水潭成品入库联动。成品库存主权仍在聚水潭，定期对账时通过"BOM 推算"反向核对差异。
- **MRP 是物控员的日级批量决策工具**：每日凌晨重算（+「立即重算」兜底）写入 `mrp_suggestions`，物控员在独立的「MRP 建议」页面消化。**销售员/老板不直接看 MRP 建议明细**——销售员看的是订单交付状态（库存 + 工单 ETA），老板看的是 MRP 跑完之后的"短缺缺口"聚合报表。
- **MRP 建议采纳的颗粒度**：一行建议 = 一张草稿 PO/工单（V1）。物控员逐行处理，需要合并时在 PO 编辑页手动加 item。批量合并的「合并采纳」按钮留给后续迭代，不在 V1 范围内。
- **委外加工不单独记加工费**：成品总成本 = `Σ(原材料 PO 金额)`。委外加工费已经被供应商打包进原材料 PO 单价里（实际经营中"原材料供应商"和"委外加工厂"经常是同一家或一站式打包结算）。`ProductionOrder` 实体里不加 `processingFee` 字段。
- **物料编码规范新老分治**：聚水潭里现存的"乱码" SKU 不重命名（沿用原 `sku_code`，避免动电商平台映射）；**新建** SKU 强制走 `[L1]-[L2]-[L3]?-[3 位流水]` 规范（如 `YL-AJ-GJ-001` 原材料·按键·硅胶·001、`CP-YD-042` 成品·移动电源·042）。L1 固定 3 值：`CP` 成品 / `BC` 半成品 / `YL` 原料。L2/L3 取拼音首字母 2 位。本地分类树 `material_categories` 用 `code` 存本级短码，完整路径在 service 层拼接。
- **物料分类是本地附加的语义层**：本地 `material_categories` 树独立于聚水潭分类，给 SKU 打 tag 用，**不回写聚水潭**。BOM `material_category_id/Name` 把 SKU 挂到本地分类。聚水潭那边的 `category` 字段保持只读同步。
- **编码规范软执行**：本地提供「编码生成器」页面——物控员选物料分类叶子，系统返回下一个流水号建议（如 `YL-AJ-GJ-013`），复制走在聚水潭新建。同步入库时正则校验不符合规范的 SKU 打 `codeCompliant=false` 标记，月度报表呈现"违规建码 TOP N"。不做硬拦截（拒收会卡死销售订单流），靠"工具降低门槛 + 数据可见性"两手治理。
- **客户主数据迁移到本地（单向，迁完即停）**：飞书 Base「客户资源」表（`tbleiXdI7C29qWfO`）一次性迁移到本系统，迁完后**飞书表停写**（保留为历史档案只读）。本系统成为客户主数据唯一主权——所有 CRM 字段（负责人、状态、标签、首次合作日期等）和业务字段（信用额度、账期、订单关联）统一在本地。**理由**：飞书表缺信用/账期/订单关联等核心业务字段，撑不起 B 端订单流；双向同步复杂度过高，ROI 低。
- **客户标签原样迁移不做规范化**：飞书「客户标签」字段里大量"逗号串复合 tag"（如 `天猫、大耳狗、华东、四类客户、中客单50-300...`），迁移时**不拆分、不去重、不字典化**，整串塞到本地 `tags jsonb[]`。本地 UI 只展示不做精筛。**已知后果**：基于 tag 的客户画像、报表分组、精准营销不可用，是有意承担的技术债，等后续 BI 需求明确再清洗。
- **客户分级自动计算（autoTier）不再手填**：飞书「客户等级」字段填写率 0/131 已证明手工录入分级在组织里行不通。本地新增 `autoTier` 字段每日凌晨基于规则计算：`strategic`（过去 12 月成交 > 100 万 / 合作 > 3 年 / `isStrategic=true`）、`active`（1-100 万）、`dormant`（< 1 万）、`new`（合作 < 3 个月）。保留一个 `isStrategic` bool 给老板/销售总监手工置顶特殊客户。**不**保留旧的 `level (A/B/C)` enum 字段。
- **客户主数据迁移字段裁剪**：飞书表 24 字段中实际填写率 0% 的 4 个字段（客户logo、SA直接跟进、首次合作日期、客户等级）**不迁不建**。客户状态 7 态简化为 `active/lead/dormant` 3 态。结算类型默认值改为 `one_off`（一次性，账期是少数标杆客户特例）。**必须新增 `jstCustomerId` 字段**——飞书 131 客户中 91 个有聚水潭客户 ID，迁移时建立映射，未来 B 端订单推送依赖此字段。其余 40 个为纯本地客户（验证 ADR-0002 B 端主权在本地）。
- **飞书销售订单类 3 张表全量历史迁入本地**：`销售订单信息` / `订单产品明细` / `订单收款明细` 三张表所有历史数据一次性迁入本地 `sales_orders` / `sales_order_items` / `payment_records`，飞书表停写（保留只读归档）。**承担的代价**：需写字段适配器、处理脏数据、补建订单与聚水潭出库单的关联。**理由**：销售员/老板查历史订单不应跨系统跳，主权统一才能跑通业绩报表、客户对账、信用使用历史等下游分析。**迁移特殊处理**：历史订单 status 统一设为 `completed`（不再走本地审批/推送/履约流程），通过 `migrationSource='feishu-base'` 标记。
- **订单编号沿用飞书规则**：本地 `sales_orders` 新增 `orderNo varchar UNIQUE` 字段 + `feishuRecordId varchar` 字段（溯源用）。**历史订单原样保留**飞书编号 `YYYY-MM-NNNNNNNN`（2541 条 100% 符合此格式，零脏数据）；**新订单沿用同一规则**——取当月最大流水号 +1 生成（全局 8 位流水号，可支撑 1 亿订单）。**不引入** `legacyOrderNo` 字段（编号体系统一，避免双格式维护成本）。**理由**：飞书编号经实证检验是结构化、零脏数据的精心设计；销售员/客户口头沟通已经习惯 `2026-05-13595` 这种说法，重编号代价远超收益。
- **历史订单不匹配客户自动创建 + 标记复核**：飞书订单表里出现但客户资源表里没有的 8 个客户（共 57 张订单，占总订单 2.2%）**自动创建空白客户档案**（只有 name + `customerStatus='active'`），同时打 `tags=['migration-auto-created', 'review-needed']` 标记，迁完后运营在客户列表用 tag 筛出来一次性核对补全信息。**理由**：57 单业务历史不能丢，但自动洗白也不可接受——留下"需复核"痕迹强制运营回头处理。
- **客户迁移不做疑似重复判重**：迁移脚本**不**对相似客户名做模糊匹配预处理。例如"杭州凯蓝品牌管理有限公司"和"杭州嘉信商贸有限公司（凯蓝国际）"虽然都带"凯蓝"二字，按**两个独立客户**处理。**理由**：从公司主体看，不同法人主体（不同税号、不同开票抬头）就是不同客户，"凯蓝"只是品牌名共用；模糊判重容易误合并真实不同客户。后续若发现真正的重复，通过"合并客户"功能（Phase 9）人工处理。
- **未激活客户全部迁入打 dormant 标记**：飞书客户资源 131 条中 37 条从未下过单（28% 未激活），**全部迁入本地** `customers` 表并标 `customerStatus='dormant'`。**理由**：多 37 条记录成本几乎为 0，销售员需要这批"曾联系过但未成交"的客户信息做 reactivation 跟进；标 dormant 让客户列表默认筛选时不混入活跃客户。
- **历史订单业务员映射采用 openId+name 双轨**：迁入飞书订单时，订单的"业务员"（飞书人员字段）匹配本地 `users`——**先按 `feishuOpenId` 精确匹配，失败回退到 `name` 匹配**，两者都失败则创建占位用户（`email='{name}@unknown.local'`、`role='migrated'`）并打 `review-needed` 标。**理由**：openId 精确但易碎（员工离职后飞书清掉 openId），name 匹配兼容历史但同名风险存在；双轨叠加最稳。**亿觅CRM 创建者**统一指向新建的 system 用户（`email='system@yimi.local'`, `role='system'`），用于历史订单 `createdBy`。
- **签单人字段重命名为业务员 + 引入店铺主人字段**：当前 `sales_orders.signerId` 同时承担"业务员（佣金归属）"和"聚水潭店铺主人（C 端订单推送依据）"两重语义，是设计债。**重构**：把 `signerId` 列**重命名**为 `salespersonId`（语义=业务员）；**新增** `jstShopOwnerId` 字段（语义=聚水潭店铺主人，C 端推送时用该用户的 `jushuitanShopId`）。**理由**：飞书里"签单人"就是业务员，不是店铺主人；继续混用会导致历史迁移时不知道往哪个字段填，未来佣金/绩效报表也容易错位。**迁移影响**：现有数据 `signerId` 全量拷贝到 `salespersonId`，`jstShopOwnerId` 用 `salespersonId` 对应 user 的 `jushuitanShopId` 一次性回填；所有 backend/frontend 的 `signerId` 引用改名。
- **销售业绩目标（KPI 看板）延后到 Phase 9**：飞书「销售业绩目标」表（102 行 × 10 列：月/季 × 业务员定额）**Phase 8 不迁入**，飞书表停用归档。**理由**：Phase 8 已经覆盖财务（开票/收款/账期）+ 决策（信用/底价/MRP 建议/全链路追踪）+ 历史订单迁移，再叠 KPI 模块会拖长发布周期；KPI 是独立的"老板视角"模块，可在 Phase 8 上线、订单/回款数据完整后独立构建。**短期代价**：销售员/老板继续在飞书表里看目标完成度，与新系统的实时订单数据有割裂。
- **飞书 Base 剩余 6 张附属表的处置**：
  - **停用归档（3 张，主权在别处）**：「亿觅产品」（主权在聚水潭，本地 product_skus 已同步）、「基础资料」（产品/物料元信息，与本地 product_skus + boms 重复）、「聚水潭 ERP 销售出库单列表」（主权在聚水潭，本地 deliveries 已镜像）。飞书表设为只读归档，不写不读。
  - **延后到 Phase 9+（3 张，独立功能模块）**：「客户线索池」（lead 管理）、「授权商信息」（经销商授权管理）、「账户资金」（公司资金账户）。Phase 8 不接入，飞书表照常使用；待主流程稳定后再单独评估是否本地化。
  - **理由**：聚焦 Phase 8 范围（财务 + 决策 + 历史订单迁移），避免一次性吞下 11 张表造成的复杂度爆炸；非核心域延后处置降低风险。
- **历史订单明细 SKU 关联采用三档匹配**：飞书订单产品明细 9855 行中"商品编码"实际是 13 位条形码（填充率 67.4%），与聚水潭 `sku_code` 不是一回事；2149 行完全没填编码（含 548 行"邮费/售后补差"非 SKU 杂项）；存在 264 个唯一 (产品名称, 规格型号) 组合。**迁移策略**：① 优先用 13 位条形码匹配 `product_skus.barcode`；② 失败回退到 (产品名称 + 规格型号) 模糊匹配 `product_skus.skuName/spec`；③ "邮费/售后补差"/"大管家导入" 等非 SKU 杂项不关联 SKU，存到 `sales_order_items.miscDescription` 字段。每条明细加 `matchMethod` (`barcode`/`fuzzy`/`misc`/`unmatched`) 和 `matchConfidence` (0–1)；`unmatched` 行标 `review-needed` tag，迁移后运营拉报表逐条核对。**理由**：暴力丢码会让 33% 行索引不到 SKU 失去穿透分析能力；纯手工映射 264 组合代价过大；分档处理在自动化和质量间取平衡。
- **历史回款迁移保留税额字段，不自动拆开票记录**：飞书订单收款明细 3290 行每条带 `taxRate`/`taxAmount`（填充率 98.7%/100%），但表里没有发票号、抬头、税号等开票信息。**迁移方案**：① 每行迁为一条 `payment_records`，新增 `taxRate`、`taxAmount`、`feishuRecordId` 字段保留原始数据；② **不**自动生成 `invoice_records`——飞书数据缺开票主信息，硬生成是假数据。**对双轨应收的影响**：历史订单的"税务应收"统计需特殊处理（从 `payment_records.taxAmount` 聚合，标 `migrated` 调和状态）；Phase 8 上线后的新订单走完整 invoice_request 流程。**短期代价**：历史订单查不到具体发票抬头，但已开票金额可还原。
- **客户归属销售员独立于订单签单人**：飞书 102 个有订单的客户中 21 个（20.6%）有多个签单人（如"珍迪旗舰店"4 个销售员签过），跨人签单是常态。**设计**：① **客户表加 `primaryAssigneeId`**（业务归属，可手动调整）；② **订单表保留 `salespersonId`**（订单级签单人，与归属可不一致）。两者语义独立，不强一致。**迁移规则**：`primaryAssigneeId` 取该客户**最近一单**的签单人（若该客户从未下过单则留空）。**业务含义**：佣金/绩效仍按订单 `salespersonId` 归属（谁签谁拿），客户列表过滤"归我的客户"按 `primaryAssigneeId`；跨人签单不需要先做"客户调配"流程。
- **客户预存款余额不迁，财务上线后手工录入**：飞书订单表里"客户预存款"是订单时刻的余额快照（同客户连续多单是同一值，填充率 78.1%），表里**没有**预付款明细记录。**决定**：迁移脚本**不**写入 `customers.prepaymentBalance`，**也不**生成 `prepayment_records`；财务上线后逐个客户对账后手工录入起始余额。**理由**：飞书快照可能已过期（飞书表停写后的余额变动只在聚水潭/线下账本里），机械迁入会引入对账风险；逐户核对录入虽费时，但保证财务起点准确。
- **孤儿明细 / 孤儿收款入库但不关联订单**：飞书"订单产品明细"和"订单收款明细"通过"订单编号"反查 `sales_orders`，找不到的孤儿行（极少量，但 13626 行总量下不可避免）**入库**到 `sales_order_items` / `payment_records`，`salesOrderId=NULL` + `orphanOrderNo=飞书订单编号` + 行级 `metadata.reviewNeeded=true`；`migration-report.json` 列出所有孤儿行。运营在"复核中心"页（Phase 8 同期上）逐条处理：手动指派给正确订单 / 标"已忽略"（保留行但不参与聚合）。**理由**：① 极少量孤儿不应阻断整体迁移；② 入库保留历史信息（老板还能查得到）；③ NULL FK 隔离孤儿对正常订单聚合的污染；④ review-needed tag 强制人工兜底治理。
- **订单金额不自洽信任飞书原值 + 超阈报警**：飞书订单 `totalAmount` 可能与 `subtotal + shipping - discount` 不一致（人工抹零 / 老板特批 / 让利等场景），迁移时**以飞书 totalAmount 为准**（人工最终意图优先）；差额 > 0.5 元的订单打 `amountMismatch` tag 与 `review-needed`，并写入 `migration-report.json.amountMismatchOrders` 列表供财务复核。**理由**：① 飞书 totalAmount 是销售员/老板最终确认的成交金额，重算会抹除调整意图；② 0.5 元阈值过滤掉四舍五入误差，只暴露真正异常；③ 不阻断迁移但留下治理钩子。
- **迁移发布的硬阈值只看财务总额对账**：发布门槛**唯一硬阈值**：① 订单总数 ≥ 2530（飞书 2541 中允许最多 11 单偏差，对应 < 0.5% 容差）；② 收款总额（payment_records.amount 全量求和）与飞书订单收款明细汇总 误差 < 100 元（财务侧可接受的尾差）。其他指标（unmatched / orphan / amountMismatch / placeholderUsers / 自动补全客户）作为**希望量指标**写进 `migration-report.json`，**不阻断**发布，转入"复核中心"页由运营在发布后逐步治理。**理由**：① 硬阈值卡死财务侧"账要对得上"的底线（老板查总数/总金额对得上飞书即可信任）；② 不卡 review-needed 类指标避免拖延上线，否则会陷入"治理完才能发布、不发布运营就没动力治理"的死锁；③ 让财务在发布前用 1-2 小时跑对账脚本，比让运营一周内处理完几百条复核更可控。
- **复核中心在现有页面加 review-needed 筛选 + 仪表盘 KPI**：**不**单独建 `/review-center` 页，而是在客户列表 / 订单列表 / 收款列表 顶部筛选条加 `review-needed` 复选框（默认不勾选）；订单/客户详情页加"标已复核"按钮（清除 `review-needed` tag）；仪表盘 dashboard 加"复核进度"KPI 卡片（待复核总量 / 已复核 7 天内 / 超 30 天未处理）。不设硬 SLA，靠 KPI 暴露的"超 30 天未处理"指标管理层目视化拖延。**理由**：① 复用现有列表 UI 降低 Phase 8 前端工作量；② SLA 卡死 4 周可能业务真做不到，反而失信；③ KPI 卡片让管理层看到拖延能主动催促，比硬 SLA 更有效。
- **历史迁移订单 admin 能改非金额字段 + 全程 operation_logs**：`migrationSource='feishu-base'` 的订单 admin 可改 备注 / 客户重指派 / 业务员重指派 / 明细行 SKU 重匹配（清除 unmatched 状态）/ 孤儿明细指派；**金额类字段**（`totalAmount`/`subtotal`/`discount`/`shippingFee`/`paymentRecords.amount`）仅 admin 通过"金额修正" 二级确认接口修改（必填 reason 字段，旧值/新值在 service 层手动 capture 写入 `operation_logs.details.before`/`details.after`/`details.reason`）。`feishuRecordId` / `migrationSource` / `orderNo` **永久只读**（防止历史溯源链断裂）。销售员/财务对 `feishu-base` 订单**只读**（避免误改）。**理由**：① 现实业务中"备注写错/客户主体合并"等修正需求很高频，完全冻结会逼业务回到 SQL 直改更危险；② 金额二级确认 + 必填原因卡死会计意义上的乱改；③ operation_logs 让任何修改可追溯，比硬冻结更稳妥。**前置依赖已满足**：`operation_logs` 表 + `OperationLogInterceptor` 已存在（`src/operation-logs/`），金额修正接口在 service 层补充手动 capture 即可，**不需要**新建 audit_logs 模块。
- **Cutover 策略：飞书先冻结后迁移（周六批次切换）**：发布序列固定为 ① 周五下班前全员公告 cutover 时间；② 周六 9:00 飞书 Base 管理员把 4 张表（客户资源 / 销售订单 / 订单产品明细 / 订单收款明细）权限调为"全员只读"；③ 9:30 服务器跑迁移脚本（含 pg_dump 备份）；④ 9:30-11:00 期间监控脚本进度，迁完跑硬阈值对账；⑤ 对账通过宣布上线，发飞书群消息：从现在起新订单走本系统；⑥ 对账不通过 → `pg_restore` 回滚 + 飞书重新放开写入，复盘后重排期。**理由**：① 完全消除"迁移期间飞书新增数据被漏掉"的窗口期；② 周六业务量最小（销售部周末不太下单），加班损失小；③ 4 小时硬截止给出明确决策点，避免拖延；④ 飞书"只读"是软冻结，老板/财务仍可查飞书表。**不选夜间迁移 + 早上增量补差**：增量补差脚本需要 `feishuRecordId` 去重逻辑，复杂度激增、回滚链长，得不偿失。
- **飞书归档保留 3 个月 + XLSX 文件档存**：cutover 上线后 ① 飞书 4 张表保持只读 3 个月（过渡期供老板/财务做"老 vs 新"对账查验）；② 3 个月期满前用飞书自带"导出 XLSX"功能把 4 张表完整导出，命名 `feishu-archive-{tableName}-cutover-YYYYMMDD.xlsx`，上传到公司云盘的"历史归档"目录（永久保留）；③ 3 个月后飞书 Base 删除 4 张表（或转入 admin-only 隐藏分组），释放飞书付费 record 配额。**理由**：① 3 个月覆盖大部分财务季度结账场景，足够过渡；② XLSX 永久档存比飞书 base 永久付费更经济，离线可查；③ 飞书 record 配额释放给新功能（线索池 / 授权商等延后表）使用。**操作责任人**：cutover 当日由飞书管理员（运营负责人）执行 ①；3 个月后由 admin 执行 ②③；时间到期前 7 天系统自动飞书机器人提醒 admin。
- **自由文本字段：原文原样存 + 增加标准化字段**：飞书的 `收款方式` / `税率` 等自由文本字段迁入时**双字段策略**：① 原文按飞书表 `method` / `taxRate` 字段原样存（保留输入意图）；② 同时新增 `methodNormalized: enum`（`'public_transfer'/'private_wechat'/'private_alipay'/'cash'/'other'`）与 `taxRateNormalized: numeric(4,2) nullable`（如 0/0.01/0.03/0.06/0.13/0.17），由迁移脚本里硬编码的映射表（如"对公"→`public_transfer`、"对公账户"→`public_transfer`、"微信"→`private_wechat`、"0%"→0.00、"未开票"→null）填充；③ 未能映射的项输出到 `migration-report.json.unmappedTexts`，由运营反馈后回到映射表迭代；④ 未来报表/聚合查询用 `*Normalized` 字段，订单详情页 UI 展示原文。**理由**：① 原文保留是审计与回溯的基础；② Normalized 字段让"对公付款总额"这类报表 SQL 干净（不用 CASE WHEN）；③ 运营持续补字典而非一次性磨皮；④ 标签字段已决定原样塞 jsonb（不字典化），但 `收款方式`/`税率`使用频率高于标签，标准化收益大。
- **Phase 8 拆为两段发布**：
  - **Phase 8.0（销售订单管理 + 历史数据迁移）**：完成 客户/订单/订单产品明细/收款 四张飞书表的全量迁入；信号 signerId→salespersonId 等 schema 调整；完善订单模块的查询/过滤/编辑/权限/导出。**目标**：让飞书订单表停写、本系统成为唯一主数据源；销售员/老板能在本系统查所有历史订单。
  - **Phase 8.5（财务 + 决策）暂缓**：手动开票、双轨应收、账期提醒、信用拦截、底价校验、MRP 建议、全链路追踪 — **全部延后**，等业务侧明确优先级后再开 Phase 8.5。
  - **理由**：用户在 grilling 收尾阶段确认当前**只要销售订单管理**，财务和供应链模块暂不上；订单+迁移作为最小可发布单元先落地，节省周期，避免一次性吞太多模块导致迭代失控。
  - **短期代价**：开票、应收、信用、MRP 这些已经讨论清楚的需求只停在 CONTEXT.md/ADR 层面，不写代码；财务上线前老板看不到全链路视图，需手工跑报表。
- **物料分类挂在 SKU 主数据层级 + BOM Item 保留快照**：`product_skus` 新增 `materialCategoryId uuid nullable`（外键到 `material_categories.id`）+ `materialCategoryName varchar nullable`（冗余存名称避免 join）+ `codeCompliant boolean default false`（编码规范软执行标记）。`bom_items.materialCategoryId/Name` 已存在，保留作为"BOM 编辑时刻的快照"——防 SKU 后续调整分类后历史 BOM 错位；BOM 编辑器选 SKU 时默认从 SKU 带出 categoryId 到 bom_item，可手动覆写。**维护流程**：① 老 SKU（聚水潭同步过来的）`materialCategoryId=NULL`，物控员在 SKU 列表逐个补；② 新 SKU 通过"编码生成器"创建时强制选叶子分类；③ SKU 同步任务在 upsert 时跑正则校验，写 `codeCompliant`。**理由**：编码生成器（按"该分类下已有几个 SKU"算流水号）、违规建码 TOP N 月报（按分类聚合）、SKU 列表分类筛选三个需求都隐含"分类挂在 SKU 主数据"前提；纯成品 SKU 不进 BOM 也需要分类归属；分类双轨（SKU 主权 + BOM 快照）避免历史 BOM 因 SKU 调整而错位。
- **物料分类存量治理（范围 + 工具 + 节奏）**：
  - **范围**：仅 `itemType ∈ ('semi_finished', 'raw_material')` 的 SKU 强制挂分类；`finished_good` / `packaging` 不强制（成品有 `Product.category` + 生命周期阶段满足展示，包材不进 BOM 不参与编码生成）。
  - **工具**：SKU 列表加"物料分类"内联编辑列（树形选择器）+ 顶部"⚠ 待分类物料 (N)"快捷筛选 chip + 多选 SKU 后顶部"批量挂分类"按钮 + 物控员仪表盘 KPI 卡片"待分类物料 SKU 数"。
  - **节奏**：软启用——模块上线即开放所有下游功能（编码生成器、违规建码 TOP N 月报）。未分类 SKU 不阻塞流程：编码生成器入口对未分类报错"先选叶子分类再生成"；违规月报里"未分类" 自成一栏（反而成为推动力）。
  - **前置依赖**：`ProductSku` 新增列 `itemType varchar(16) nullable`，4 枚举值 `finished_good / semi_finished / raw_material / packaging`；同步任务 `upsertFromJushuitan` 增加聚水潭 `item_type` 中文（成品/半成品/原材料/包材）→ 本地英文枚举的映射；老 SKU 一次性全量重跑同步回填该字段。
  - **理由**：① 缩小治理范围避免永远完不成（仅 ~200 条物料 SKU 需挂，非全量数千 SKU）；② 复用 SKU 列表 UI 零学习成本；③ 软启用比硬阻塞更能在实战中推动治理（"上线即雪藏"是硬阻塞的常见陷阱）；④ `itemType` 字段是必要前置——当前 schema 缺失，line 16 描述的"靠 item_type 区分"是目标态而非现状。
- **聚水潭 `item_type` 空值的本地兜底**：同步任务遇到 `item_type=''/null` 的 SKU 时，本地 `itemType` 字段填 **NULL**（不默认 `finished_good`、不 reject 同步）。配套 UI：SKU 列表行展示红色 "未归类" chip + 顶部"未归类大类 (N)" 筛选 chip；物控员仪表盘加 KPI "未归类大类 SKU 数"；违规建码月报"未归类"自成一栏。**理由**：① 默认 `finished_good` 会污染数据、把"管理缺失"伪装成"已归类"；② reject 同步会因聚水潭基础设置疏漏导致 SKU 不入库阻断业务；③ NULL + 可见性比悄悄填默认值更能推动物控员主动治理（CONTEXT.md "软启用 + 治理可见性" 主线一致）。**前置依赖**：`upsertFromJushuitan` 增加 `item_type` 字段读取与中英映射逻辑，无对应中文枚举时落 NULL（不报错）。
- **products.service.ts 编码遗留即刻清理**：当前 3 处代码与本 CONTEXT.md 决策冲突需在物料分类模块上线前一并清理：① `getCategoryPrefix` 返回 CP/YL/`BZ`（line 79 决策 L1 为 CP/BC/YL，无 BZ；line 117 包材不参与编码生成）→ 删除整个方法；② `generateSkuCode` 生成 `EM-CP-20250522-001` 格式（line 79 决策格式为 `[L1]-[L2]-[L3]?-[3位流水]`，例 `YL-AJ-GJ-001`，无 brand 前缀、无日期）→ 删除整个方法；③ `POST /products` 路径中本地 create SKU 数组（line 70 决策"去掉本地新建入口、保留同步按钮"）→ 删除 SKU create 分支，仅保留同步入库 + admin 调试用最小入口（或直接禁用）。**理由**：① 物控员上线后看到旧本地新建 + 新编码生成器两个入口会混淆；② 旧 generateSkuCode 产出的码会被新正则判 `codeCompliant=false`，自污染违规月报；③ 一次性清理比"留着等下个迭代"维护成本更低。**操作锚点**：`src/products/products.service.ts:36-128`、前端 `web/src/pages/ProductPage.tsx` 同步移除"新建产品"按钮（仅保留同步按钮 line 70 决策）。
- **物料分类模块 V1 发布范围（中 MVP）**：首发范围限定到"分类挂载链路 + 治理 UI 暴露问题"，**不**包含编码生成器 UI 与违规月报。**包含**：① ProductSku 新增 `itemType / materialCategoryId / materialCategoryName / codeCompliant` 四列 + DB migration；② `upsertFromJushuitan` 读 `item_type` + 中英映射 + NULL 兜底；③ SKU 列表新增"物料分类"内联编辑列、顶部"⚠ 待分类物料 (N)" / "未归类大类 (N)" chip、多选批量挂分类；④ 物控员仪表盘 KPI "待分类 SKU / 未归类大类 SKU"；⑤ 物料分类管理页（树形增删改 + 软删 RESTRICT + admin/物控员权限分离）；⑥ seed L1 三档（CP 成品 / BC 半成品 / YL 原料）；⑦ 同步任务每次 upsert 对 `skuCode` 跑 codeCompliant 正则并写字段。**不包含**：⓪ 编码生成器独立工具页；⓪ 违规建码 TOP N 月报；⓪ "复制走在聚水潭新建"流程的自动化辅助。**理由**：① 编码生成器是建议级工具（line 123），下游月报依赖 V1 跑完一段时间累积的 codeCompliant 分布数据；② V1 跑通后物控员能用"批量挂分类 + 待分类筛选"治理 ~200 条物料 SKU 的存量积压，是真正的最小可上线单元；③ V2 再上生成器/月报，避免一次性吞太大降低发布质量。
- **codeCompliant 正则严格不向后兼容**：合规校验正则定为 `/^(CP|BC|YL)-[A-Z]{2}(-[A-Z]{2})?-\d{3}$/`。① L1 三档枚举大写（CP/BC/YL）；② L2/L3 严格 2 位大写字母（拼音首字母）；③ 流水号严格 3 位数字（001-999），溢出 1000+ 视为违规（边缘情况，触发时改用细分类拆出新叶子）；④ 不允许 brand 前缀（line 79 决策不带 brand）；⑤ 不允许大小写混合 / 数字 L2-L3 / 空格 / 附加字符；⑥ 老乱码 SKU 永远 `codeCompliant=false`（line 79 决策"不重命名沿用 sku_code"）。**理由**：① 宽松正则会让半合规码被纳入流水号空间（line 123 决策依赖严格隔离）；② 不向后兼容老格式 = 让违规月报真实反映存量积压，提供治理推动力；③ 严格枚举避免拼写漂移导致同类不同码（如 "AJ" / "ANJ" / "Aj" 都是按键 anjian，宽松正则会让三者并存）。**触发点**：同步任务 upsert 时跑、批量挂分类时跑、admin 手工触发"全库重跑 codeCompliant" 时跑。
- **物料分类树 seed 仅 L1 三档**：DB migration 创建 3 条顶级分类记录：`{code: 'CP', name: '成品', level: 1}` / `{code: 'BC', name: '半成品', level: 1}` / `{code: 'YL', name: '原材料', level: 1}`。**不** seed L2/L3（让物控员根据真实物料按需建子类，避免预设和实际仓库不符）。**不** seed L1 包材（line 117 决策"包材不强制挂分类"+ line 79 决策 L1 仅 3 枚举）。**理由**：① 仅 L1 让物控员第一天上线即看到框架，避免"空白起手"体验；② 不预设 L2 避免误导（如老 ERP 截图里的"按键-硅胶"在实际仓库可能已不再用）；③ migration 幂等：用 `ON CONFLICT (code) DO NOTHING` 防止重跑炸库。**操作锚点**：物料分类 DB migration 文件，在新建 `material_categories` 表的 migration 同文件 `up()` 末尾追加 INSERT 三行。
- **历史订单迁移脚本实施细节**：
  - **环境**：dry-run 跑**本地 docker compose 起的 postgres**（已含服务器迁过来的快照，业务表清空、users 表保留）。多次试跑成本 0，跑通后一次性打服务器。
  - **代码位置**：`scripts/import-historical-orders.ts` + npm script `npm run migrate:feishu-orders -- --dry-run`。一次性脚本，cutover 完后归档到 `docs/migrations-archive/`，**不**作为 NestJS Module、不污染 src/ 正常代码。
  - **报告格式**：`migration-report-{YYYYMMDD-HHMM}.json` 原始数据（孤儿明细、异常订单、客户自建列表、字段映射预览）+ `migration-summary-{YYYYMMDD-HHMM}.md` 人可读总结（按 CONTEXT.md line 104 硬阈值 + line 102 希望量指标分章节）。**Markdown 给老板 + 财务看，JSON 给 admin 查细节**。
  - **GO/NO-GO 决策权**：**老板 sign-off**（业务负责人/老板看完 Markdown summary + 财务对账结果后口头/微信确认 GO，admin 把 GO 时间 + 报告快照 hash 记录到迁移执行日志）。**不** 由 admin 单方决策、**不** 由"财务硬阈值通过 = 自动 GO"。**理由**：历史数据影响外部口径，需要明确责任链。
  - **回滚演练**：cutover 前**本地 docker 完整彩排一次**——跑完整 dry-run + pg_dump 备份 + pg_restore 恢复，验证脚本/报告/回滚三者均如预期。**不** 在生产 staging 跑、**不** 跳过演练直接 cutover。
  - **幂等策略**：所有 INSERT 用 `INSERT ... ON CONFLICT (feishu_record_id) DO UPDATE`。`sales_orders.feishuRecordId`、`sales_order_items.feishuRecordId`、`payment_records.feishuRecordId` 三表均加 UNIQUE 约束。**理由**：cutover 当天可多次试跑/对账/重跑修复，脚本逻辑修正后能覆盖已写入行；DO NOTHING 会让旧逻辑写入的脏行残留。
  - **执行序列对齐 line 107**：cutover 当天 ① 9:00 飞书表只读；② 9:30 服务器 pg_dump 备份；③ 9:30 服务器 `npm run migrate:feishu-orders`（不带 dry-run）；④ 9:30-11:00 监控 + 财务跑硬阈值对账脚本；⑤ admin 收齐对账报告 + Markdown summary 发给老板 → 等待 sign-off；⑥ 老板 GO → admin 飞书群公告上线；⑦ NO-GO → pg_restore + 飞书放写 + 复盘。
- **聚水潭 SKU 同步任务字段主权分层**：`upsertFromJushuitan` 对已有 SKU 的字段处理按以下 4 类分层（替代当前 `products.service.ts:414-421` 的"全量覆盖"模式）：
  - **A. 聚水潭主权（每次同步覆盖）**：`skuCode` / `skuName` / `propertiesValue` / `category` / `brand` / `pic` / `salePrice` / `costPrice` / `weight` / `jstSkuId`。聚水潭是事实最终源。
  - **B. 本地主权（同步从不覆盖）**：`localPic`（line 422 已有注释，保留）、`materialCategoryId` / `materialCategoryName`（line 80 决策"本地分类树独立于聚水潭"——物控员手挂的分类不应被同步抹掉）。
  - **C. 协同字段（NULL 时填、非 NULL 不动）**：`itemType`。聚水潭首次提供 item_type 时本地落库，物控员手动修正后不被后续同步覆盖。**理由**：① 简单实现 `existingSku.itemType = existingSku.itemType ?? mapItemType(s.item_type)`；② 物控员有最终控制权，避免聚水潭基础设置疏漏覆盖本地正确值；③ 冲突检测告警工作流复杂度高，V2 再考虑。
  - **D. 计算字段（每次同步重算）**：`codeCompliant`。`existingSku.codeCompliant = SKU_CODE_REGEX.test(skuCode)`。每次 upsert 完跑正则，反映"当前 skuCode 是否合规"的最新结论。
  - **理由**：① 不分层会让物控员每次手挂分类被下一轮同步抹掉，与 line 80 决策直接冲突；② 显式分层让"什么是聚水潭说了算、什么是本地说了算"成为代码自文档；③ NULL 兜底 + 不动策略避免数据"被同步污染"；④ codeCompliant 必须每次重算，否则 skuCode 在聚水潭被修改后本地标记会失真。**操作锚点**：`src/products/products.service.ts:363-429`（A 面 V1 实施时改 line 413-424 的 update 分支）。
- **物料分类树的变更治理**：增/改权限 admin + 物控员；删权限 **admin only** + DB 约束 `ON DELETE RESTRICT`（有 SKU 挂载时拒删，前端提示"请先迁移 N 个 SKU"）。**合并/拆分不做专用工具**——用 SKU 列表的"批量挂分类"组合实现（合并 = 先全挂到目标分类再删源；拆分 = 新建子分类后多选 SKU 迁移）。**重命名**走 service 层 batch 同步刷 `product_skus.materialCategoryName` + `bom_items.materialCategoryName` 冗余字段（不引入 DB 触发器）；操作写 `operation_logs` 可追溯。**不联动聚水潭** `category` 字段（line 80 已定本地树独立于聚水潭）。**理由**：① `RESTRICT` 防 cascade null/delete 的失踪事故（"删完才发现 N 个 SKU 失踪"）；② 合并/拆分用例极低频（预计一年几次），专用向导 ROI 低；③ 重命名 batch 同步比 DB 触发器/物化视图复杂度低；④ 物控员只能"新增/修改"防止其误删影响下游报表聚合维度（删分类影响编码生成器流水基础、违规月报聚合）。
- **物料编码生成器是"建议级"工具，不持有流水号占用**：流水号生成逻辑 `SELECT COUNT(*) WHERE materialCategoryId=X AND codeCompliant=true` + 1；**不为每个分类建独立 PG sequence、不做 advisory lock 并发控制**。老违规编码（`codeCompliant=false`）**不计入**流水号空间——避免"该分类 1 条规范 + 30 条乱码、下一个建议 32"的跳号假象。**撞号兜底**靠聚水潭 `sku_code` 唯一约束（物控员复制到聚水潭新建时报错，回 ERP 重新取下一个建议）。**UI 防撞号**：生成器页面显示"过去 30 分钟内 X 人取过此分类建议"提示，靠错峰避免高频撞号。**不支持手动起始号输入**——一旦支持"建议"语义崩塌。**不记录"取建议"日志**（纯查询，无 side effect）。新分类下从 `001` 起步。**理由**：line 81 已定"复制走在聚水潭新建"，编码本就是建议性质而非本地分配，引入 sequence/advisory lock 是过度设计；聚水潭 `sku_code` 唯一约束才是真权威。
- **新建客户的去重治理（提示级，不阻断）**：新建客户表单中公司名 `name` **onBlur 失焦**后调用 `POST /customers/check-duplicates`，三维度**精确匹配**：① `name` 完全相同；② `taxId` 完全相同（若已填）；③ `contactPhone` 完全相同（若已填）。Top 5 结果以 modal 列出（客户名 + 负责人 + 最近订单时间），销售员可选"跳到此客户"或"我确认是新客户继续创建"。**不做模糊匹配**（line 89 已定不模糊判重）；**不加 DB unique 约束**（name 同名子公司、phone 集团统一电话、taxId 多数 nullable）；**不在 create 检测中加 `jstCustomerId`**（该字段通常 admin 后续关联，非销售员录入时填）；**不实现"合并客户"功能**（Phase 9 范围，line 89 已声明）；**批量 import 不走此检测**（复用 line 89 历史迁移不判重决策）。**理由**：① 三维精确匹配兜底 90% 的同人重复录入场景；② onBlur 检测比 onChange + debounce 简单；③ 提示而非阻断——真有同名独立分公司时不逼销售员变形数据（在名字后加"（2）"等）。
- **物料分类「停用」（软删 `isActive=false`）的级联策略**：`MaterialCategoriesService.remove()` **必须先查引用方**，发现非零引用立即抛 `BadRequestException("该分类被 N 个 SKU、M 条 BOM Item 引用，请先迁移")`，**不**直接 `isActive=false`。前端拿到错误后弹「引用列表」modal：① N 个 SKU（链接到 SKU 列表预筛选 `materialCategoryId=X`，支持批量重挂分类）；② M 条 BOM Item（链接到对应 BOM 详情）。**实现锚点**：`material-categories.service.ts:59-69` 的 `remove()` 在调用 `repo.save(category)` 前增加 `productSkusRepo.count({ where: { materialCategoryId: id } })` + `bomItemsRepo.count({ where: { materialCategoryId: id } })` 双查。**理由**：① 现有 `remove()` 完全无引用检查，会造成"停用完才发现 200 个 SKU 列分类列显示空白"事故；② line 141 已定 `ON DELETE RESTRICT` 是 DB 层兜底（hard delete 用），但软删走 ORM `save(isActive=false)` 绕过外键约束，必须在 service 层补检查；③ 与 line 141"删权限 admin only"互补——admin 也无法在有引用时硬冲；④ BOM `materialCategoryName` 是快照字段（line 16），即使分类停用快照仍可读，但 `materialCategoryId` 指向 `isActive=false` 行会让新建 BOM 选择器看不到，对应历史 BOM 编辑场景需要"显示已停用分类但加灰底 + 不可选其它项"——V2 处理，V1 先按全量树渲染（含 `isActive=false`，但只在编辑该 BOM 时允许保留旧值，新建一律过滤）。
- **聚水潭同步任务的可观测性 (`sync_logs` 表 + admin 页面)**：新建 `sync_logs` 表持久化每次 Bull job 执行结果，admin 提供查询页面。
  - **表 schema**：`id` uuid、`jobName` enum(`push-order`/`sync-stock`/`sync-deliveries`/`sync-skus`)、`status` enum(`running`/`succeeded`/`failed`/`partial`)、`startedAt` / `finishedAt` timestamp、`fetchedCount` int（聚水潭拉到的行）、`insertedCount` int（新建本地行）、`updatedCount` int（更新本地行）、`skippedCount` int（如 brand≠EMIE 被滤）、`itemTypeNullCount` int（line 70 NULL 兜底数）、`codeNonCompliantCount` int（line 88 正则不通过数）、`errors` jsonb（错误详情数组，每条 `{ skuCode, message, stack? }`）、`triggeredBy` enum(`cron`/`manual`/`webhook`)、`triggeredByUserId` uuid? (`manual` 时填)。
  - **写入位置**：`JushuitanSyncProcessor` 各 handler 起头 `INSERT status=running`、结束 `UPDATE status=succeeded/failed` + counts。包一层装饰器 `@SyncLogged()` 自动埋点，业务代码内只调 `incCount('itemTypeNull')` 等辅助 API。
  - **admin 页面**：`/admin/sync-logs` 列表（jobName 筛选、日期范围、status 筛选、按 startedAt DESC）+ 详情抽屉（看 errors jsonb 展开）。**不**在 BullBoard `/admin/queues` 重复造轮子——Bull job ID 在 sync_logs 留 `bullJobId` 字段做交叉引用。
  - **保留期**：**90 天硬删**（cron 每天 03:00 跑 `DELETE WHERE startedAt < now() - 90 days`）。失败记录、含 NULL 兜底/不合规计数的记录**优先保留**（保留期延长到 180 天）——理由：老板年度复盘看治理趋势靠这批数据。
  - **KPI 卡片接入**：line 121「中 MVP」要做的物控员仪表盘 `待分类 SKU 数` + 月度违规建码 TOP N 直接从 sync_logs 聚合（`SUM(itemTypeNullCount) / SUM(codeNonCompliantCount) GROUP BY date_trunc('month')`），**不**单独查 product_skus 实时聚合（实时聚合在 10k+ SKU 后会慢）。
  - **理由**：① Bull Board 只读 + 默认 100 个 job 留存对老板月度复盘场景完全不够；② sync_logs 是 line 70（NULL 兜底数据可见性）+ line 88（违规建码 TOP N）的实现底座，不做这层后面 KPI 无源；③ 失败记录是事故复盘的根证据，必须比成功记录留得久；④ 飞书 webhook 告警可作为补充（V2 加），但不替代 DB 表。**操作锚点**：A 面 V1 实施前先建 sync_logs migration（早做早受益）。

- **V1 走向决定 (2026-05-25)：暂停 V1 物料分类前端 MVP，优先修同步任务**：基于上条数据底子盘点（line 152），采用 **A 方案**——`#153 前端中 MVP UI` 任务**暂停**，不在数据底子修好前推进。**优先级序列**：① 修 `upsertFromJushuitan` 字段拉取范围（接入聚水潭 SKU 接口完整字段映射）；② 取消 UUID skuCode 兜底（聚水潭 sku_code 空则跳过 + 入 sync_log.errors）；③ 跑一次性脚本盘点 316 条 UUID 兜底行，生成"待补 sku_code 列表" Markdown 报告给 admin；④ 全量重跑同步，观察 sync_logs 字段填写率上升；⑤ 待 category/brand/item_type 等关键字段填写率 ≥ 50% 后，再启 V1 物料分类前端 MVP。**理由**：① 治理工具落地需有数据可治理，数据底子修好之前 V1 治理工具是"美丽的空仪表盘"；② 修同步任务独立于销售订单/客户/审批等其他模块，风险低、不阻塞主线；③ 一次性数据清洗比"工具上线后逐条治理 631 条"代价小一个数量级。

- **2026-05-25 数据底子盘点（颠覆性发现）**：本地 docker postgres 跑 SQL 实测：
  - `product_skus` 总量 **631**，products 也是 631（1:1），bom_headers 81，bom_items 287。
  - **jst_sku_id 100% 有值**（631/631）—— 全部从聚水潭同步来。
  - **`skuCode` 一半是 UUID 兜底**：316 条形如 `7dc90ac1-747a-4245-...` 的 UUID（49.9%）；240 条 13 位条形码（38.0%）；其他半结构化码（如 `EM20240528` / `EMIE20210719001`）填剩 75 条。说明 `upsertFromJushuitan` 历史上对聚水潭 `sku_code` 缺失的 SKU **本地生成 UUID 兜底**充当 skuCode（清理前 line 123 `generateSkuCode` 的产物或类似遗留）。
  - **category / brand / sale_price / cost_price / pic / weight 全部 0% 填写**（631/631 空）—— 同步任务历史上**根本没拉这些字段**，或字段映射有 bug，导致聚水潭主数据在本地全是 null/空字符串。
  - **codeCompliant 正则 0/631 合规**（100% 违规）—— V1 上线第一天违规率 100%。
  - 含义：CONTEXT.md line 121"老 SKU 一次性全量重跑同步回填 itemType"**完全不可行**——同步连 category/brand 都拿不到，更别提 item_type；line 122 "聚水潭 NULL 时本地落 NULL" 不是少数兜底而是**全量 NULL**；V1 上线时 "未归类大类 SKU 数" KPI = 631、"违规建码" = 631、"待分类物料" = 0（因为 itemType 全 NULL，line 117 范围内的物料 SKU 数也 = 0，自相矛盾）。
  - **V1 不能直接上**：必须先修同步任务的"拉字段缺漏"和"UUID skuCode 兜底"两个根因，否则治理工具拿到的就是一片空白数据，KPI 全极端值无意义，admin 看到当场放弃。
  - **追加决策（优先级置顶于 V1 物料分类模块之前）**：
    1. **修 `upsertFromJushuitan` 的字段拉取范围**：确认聚水潭 `/open/sku/query` 接口实际返回的字段，对照当前代码逐一补齐（重点：`category` / `brand` / `pic` / `sale_price` / `cost_price` / `weight` / `item_type`）。每次同步全量重跑后，可观察 sync_logs 看填写率上升曲线。
    2. **取消 UUID skuCode 兜底**：聚水潭 SKU 若 `sku_code` 字段为空，**跳过该条**（计入 sync_log.skippedCount + 错误详情），**不**本地生成 UUID 充当 skuCode。修完后下一轮同步会自然纠正 50% UUID 兜底问题（结合 4 层主权 A 层覆盖逻辑）。
    3. **存量 631 条 UUID skuCode 的处置**：① 跑一次性脚本识别 UUID 兜底行（regex `^[0-9a-f]{8}-`）；② 报告输出每条对应的 jst_sku_id / skuName / properties_value，提示 admin 去聚水潭查并补 sku_code；③ admin 操作完后下一轮同步会替换 skuCode（前提：① 中跳过逻辑生效，② line 135-140 4 层主权里 skuCode 是 A 层"聚水潭主权每次覆盖"——会自动接上）。这是一次性数据清洗，不是常态流程。
    4. **V1 物料分类模块顺延**：等同步任务修好、数据底子至少 50% 字段填写后再上 V1，否则治理工具落地为"美丽的空仪表盘"。
  - **理由**：① 数据治理工具的前提是"有数据可治理"；② 治理工具本身设计无问题（line 116-126 决策都合理），但失败模式不是设计而是源头数据为空；③ 与其上线后发现 KPI 卡片全显示 631 admin 当场放弃，不如先把 sync 修了再上工具；④ 修 sync 不阻塞其他模块（销售订单、客户、审批等都不依赖这些字段），所以独立推进风险低。
  - **操作锚点**：`src/integrations/jushuitan-sync.processor.ts` `handleSyncSkus` + `src/integrations/jushuitan.service.ts` (sku.query 调用) + `src/products/products.service.ts` `upsertFromJushuitan`（去掉 UUID 兜底）。

- **2026-05-25 聚水潭 token 全面过期（阻断性发现）**：`integration_logs` 全表拉取：
  - `sync-skus`：2026-05-14 仅成功 1 条，05-15 至今全部失败；05-25 凌晨最新一次失败：`refresh_token无效或已过期`。
  - `sync-boms`：2026-05-15 失败（token expired），05-14 失败（`material_category_id` 列不存在——BOM 表 migration 未对齐导致）。
  - `push-order`：连续 30+ 次失败，全因为"订单未指定签单人"（`signerId` 为空——与 CONTEXT.md line 91"签单人→业务员重命名"决策相关，但当前前端/业务逻辑可能还没切完）。
  - **结论**：聚水潭 access_token + refresh_token **全部失效至少 10 天**，同步任务已完全停摆。这意味着：① line 164 "修字段拉取范围" 无法验证——token 修不好前跑不了同步；② 631 条 SKU（05-15 创建）的**真正创建来源仍然不明**——不是 sync-skus（当天同步任务失败），可能是手工录入、其他脚本灌入或早期废弃路径；③ 如果不先续上 token，整个 A 方案（修 sync → 全量重跑 → 再启 V1）全部卡死。
  - **行动项**：admin 需去聚水潭开放平台后台重新获取 access_token / refresh_token（或检查 `JUSHUITAN_ACCESS_TOKEN` / `JUSHUITAN_REFRESH_TOKEN` 环境变量），填入 `.env` 后重启服务，然后触发一次手动 sync-skus 跑通数据链路。**只有在 token 续上后，才能判断"0% 字段填写"到底是同步 bug 还是聚水潭源数据本身就没填**。
  - **操作锚点**：`docker compose down && docker compose up -d` 或 `.env` 热更新 + 重启 app 容器。

- **2026-05-25 数据底子盘点（颠覆性发现）**
  - **jst_sku_id 100% 有值**（631/631）—— 全部从聚水潭同步来。
  - **`skuCode` 一半是 UUID 兜底**：316 条形如 `7dc90ac1-747a-4245-...` 的 UUID（49.9%）；240 条 13 位条形码（38.0%）；其他半结构化码（如 `EM20240528` / `EMIE20210719001`）填剩 75 条。说明 `upsertFromJushuitan` 历史上对聚水潭 `sku_code` 缺失的 SKU **本地生成 UUID 兜底**充当 skuCode（清理前 line 123 `generateSkuCode` 的产物或类似遗留）。
  - **category / brand / sale_price / cost_price / pic / weight 全部 0% 填写**（631/631 空）—— 同步任务历史上**根本没拉这些字段**，或字段映射有 bug，导致聚水潭主数据在本地全是 null/空字符串。
  - **codeCompliant 正则 0/631 合规**（100% 违规）—— V1 上线第一天违规率 100%。
  - 含义：CONTEXT.md line 121"老 SKU 一次性全量重跑同步回填 itemType"**完全不可行**——同步连 category/brand 都拿不到，更别提 item_type；line 122 "聚水潭 NULL 时本地落 NULL" 不是少数兜底而是**全量 NULL**；V1 上线时 "未归类大类 SKU 数" KPI = 631、"违规建码" = 631、"待分类物料" = 0（因为 itemType 全 NULL，line 117 范围内的物料 SKU 数也 = 0，自相矛盾）。
  - **V1 不能直接上**：必须先修同步任务的"拉字段缺漏"和"UUID skuCode 兜底"两个根因，否则治理工具拿到的就是一片空白数据，KPI 全极端值无意义，admin 看到当场放弃。
  - **追加决策（优先级置顶于 V1 物料分类模块之前）**：
    1. **修 `upsertFromJushuitan` 的字段拉取范围**：确认聚水潭 `/open/sku/query` 接口实际返回的字段，对照当前代码逐一补齐（重点：`category` / `brand` / `pic` / `sale_price` / `cost_price` / `weight` / `item_type`）。每次同步全量重跑后，可观察 sync_logs 看填写率上升曲线。
    2. **取消 UUID skuCode 兜底**：聚水潭 SKU 若 `sku_code` 字段为空，**跳过该条**（计入 sync_log.skippedCount + 错误详情），**不**本地生成 UUID 充当 skuCode。同步任务跑完后产出"跳过列表"，让 admin 回聚水潭补齐 sku_code 后下次再同步。
    3. **存量 631 条 UUID skuCode 的处置**：① 跑一次性脚本识别 UUID 兜底行（regex `^[0-9a-f]{8}-`）；② 报告输出每条对应的 jst_sku_id / skuName / properties_value，提示 admin 去聚水潭查并补 sku_code；③ admin 操作完后下一轮同步会替换 skuCode（前提：① 中跳过逻辑生效，② line 135-140 4 层主权里 skuCode 是 A 层"聚水潭主权每次覆盖"——会自动接上）。这是一次性数据清洗，不是常态流程。
    4. **V1 物料分类模块顺延**：等同步任务修好、数据底子至少 50% 字段填写后再上 V1，否则治理工具落地为"美丽的空仪表盘"。
  - **理由**：① 数据治理工具的前提是"有数据可治理"；② 治理工具本身设计无问题（line 116-126 决策都合理），但失败模式不是设计而是源头数据为空；③ 与其上线后发现 KPI 卡片全显示 631 admin 当场放弃，不如先把 sync 修了再上工具；④ 修 sync 不阻塞其他模块（销售订单、客户、审批等都不依赖这些字段），所以独立推进风险低。
  - **操作锚点**：`src/integrations/jushuitan-sync.processor.ts` `handleSyncSkus` + `src/integrations/jushuitan.service.ts` (sku.query 调用) + `src/products/products.service.ts` `upsertFromJushuitan`（去掉 UUID 兜底）。

- **治理 trigger V1 仅 KPI 卡片（被动可见），不加主动告警条**：admin 单人兼任治理后，V1 治理触发机制**仅依赖 dashboard 顶部 KPI 卡片**（line 124 已规划），**不**在 V1 范围内加"同步任务跑完后 dashboard 红色告警条"或"销售订单/BOM 创建时未归类提示"等主动 trigger。**理由**：① admin 自己使用，先观察 KPI 卡片这种被动机制是否足够形成治理节奏，避免过早过度工程化；② 主动告警条/流程内提示需要额外开发成本，且不知道 admin 实际打开 dashboard 的频率，先看真实数据再定 V2 加什么；③ 即使 V1 完全没有治理动作发生，sync_logs 表也在背后积累数据（line 145-151 设计），V2 决策时有依据。**V1 验证窗口**：上线后 1-2 个月观察"待分类 SKU 数"是否从初始值下降；若 KPI 数字纹丝不动 = 被动机制失败，V2 立即加红色告警条 + 流程内提示 + 飞书机器人推送。**V2 候选优先级**：红色告警条（最便宜）→ 流程内未归类提示 → 飞书机器人月度推送。

- **数据治理责任链：admin 单人兼任，无专职物控员**：当前公司**没有专职/兼职的采购或物控同事**，CONTEXT.md 其他条目里出现的"物控员"语义实际全部落到 **admin（即本系统使用者本人）** 身上。**对 V1 设计的强约束**：
  - **不**单独建"物控员仪表盘"或独立物控员页面——KPI 卡片（待分类 SKU 数 / 未归类大类 SKU 数 / 违规建码计数）直接挂到 admin 主仪表盘 `DashboardPage.tsx` 顶部；
  - **不**对 `material_category:*` / `product:edit` 等权限做"物控员 vs admin"的细粒度分离（line 141 决策"增改权限 admin + 物控员"实际等价于"admin only"）；
  - 治理工具入口（批量挂分类、待分类筛选、编码生成器）必须**默认对 admin 直接可见**，不能藏在二级权限或独立角色入口；
  - **治理推动力不能靠"admin 主动盯 KPI 数字"**——admin 兼任时 KPI 卡片只是"被动可见"，需要更强的主动 trigger（如月度飞书机器人推送、同步任务发现新 NULL 物料时弹窗、违规码 TOP N 月报自动生成并 @admin），V2/V3 优先迭代这块。
  - **理由**：① 假设有专人推动是设计陷阱——admin 一个人兼着治理 + 业务运维 + 系统配置，注意力极度稀缺；② 工具必须为"扫一眼就能用"的状态准备，而非"专人每天来巡检"的姿态；③ 现实里数据治理之所以推不动，根因往往是"没人负责"，承认这点后 V1 要把"减摩擦 + 主动推送"放在首位，而非"卡死规范"。
  - **操作锚点**：① V1 实施时 KPI 卡片放 `DashboardPage.tsx`；② V1 不做飞书机器人推送（V2 加），但所有 KPI 数值同时入 `sync_logs` 表为后续推送预留数据源；③ 物料分类管理页和 SKU 批量挂分类入口顶层菜单可见，不藏二级。

## Flagged ambiguiguities

- "商品" 口语中同时指代 **产品** 和 **规格**，已明确区分。
