const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 表名 → 中文描述
const TABLE_LABELS = {
  'sales_orders': '销售订单',
  'sales_order_items': '销售订单明细',
  'customers': '客户',
  'customer_addresses': '客户地址',
  'products': '商品',
  'product_skus': 'SKU（商品规格）',
  'purchase_orders': '采购单',
  'purchase_order_items': '采购单明细',
  'purchase_order_status_logs': '采购单状态变更日志',
  'purchase_requests': '采购申请',
  'purchase_request_items': '采购申请明细',
  'vouchers': '财务凭证',
  'voucher_items': '凭证明细',
  'material_categories': '物料分类',
  'users': '用户',
  'suppliers': '供应商',
  'approval_records': '审批记录',
  'delivery_orders': '出库单',
  'delivery_order_items': '出库单明细',
  'production_orders': '加工单',
  'production_order_items': '加工单明细',
  'production_order_item_allocations': '加工单物料分配',
  'stock_ledger': '库存台账',
  'stock_snapshots': '库存快照（聚水潭同步）',
  'local_stock_balances': '本地库存余额',
  'sync_logs': '同步日志',
  'invoice_records': '发票记录',
  'payment_records': '回款记录',
  'prepayment_records': '预付款记录',
  'bom_headers': 'BOM 表头',
  'bom_items': 'BOM 明细（物料清单）',
  'sales_rep_achievements': '销售代表业绩',
  'sales_targets': '销售目标',
  'operation_logs': '操作日志',
  'tenants': '租户',
  'migrations': '数据库迁移记录',
  'price_policies': '价格策略',
  'integration_logs': '集成日志',
};

// 字段名 → 中文描述（通用映射，按表覆盖）
const COMMON_FIELD_LABELS = {
  'id': '主键 ID',
  'created_at': '创建时间',
  'updated_at': '更新时间',
  'remark': '备注',
  'status': '状态',
  'type': '类型',
  'name': '名称',
  'code': '编码',
  'qty': '数量',
  'unit_price': '单价',
  'total_amount': '总金额',
  'totalAmount': '总金额',
  'discountAmount': '折扣金额',
  'payAmount': '应付金额',
  'line_amount': '行金额',
  'lineAmount': '行金额',
  'customer_id': '客户 ID',
  'customerId': '客户 ID',
  'supplier_id': '供应商 ID',
  'supplierId': '供应商 ID',
  'creator_id': '创建人 ID',
  'creatorId': '创建人 ID',
  'salesperson_id': '业务员 ID',
  'salespersonId': '业务员 ID',
  'tenant_id': '租户 ID',
  'tenantId': '租户 ID',
  'sku_id': 'SKU ID',
  'skuId': 'SKU ID',
  'sku_code': 'SKU 编码',
  'skuCode': 'SKU 编码',
  'sku_name': 'SKU 名称',
  'skuName': 'SKU 名称',
  'product_id': '商品 ID',
  'productId': '商品 ID',
  'order_id': '订单 ID',
  'orderId': '订单 ID',
  'order_no': '订单编号',
  'orderNo': '订单编号',
  'pr_no': '采购申请编号',
  'prNo': '采购申请编号',
  'purchase_order_id': '采购单 ID',
  'purchaseOrderId': '采购单 ID',
  'purchase_request_id': '采购申请 ID',
  'purchaseRequestId': '采购申请 ID',
  'sales_order_id': '销售订单 ID',
  'salesOrderId': '销售订单 ID',
  'delivery_order_id': '出库单 ID',
  'deliveryOrderId': '出库单 ID',
  'voucher_id': '凭证 ID',
  'voucherId': '凭证 ID',
  'bom_id': 'BOM ID',
  'bomId': 'BOM ID',
  'invoice_id': '发票 ID',
  'invoiceId': '发票 ID',
  'approval_instance_code': '审批实例编码',
  'approvalInstanceCode': '审批实例编码',
  'feishu_record_id': '飞书审批记录 ID',
  'feishuRecordId': '飞书审批记录 ID',
  'feishu_instance_code': '飞书实例编码',
  'feishuInstanceCode': '飞书实例编码',
  'feishu_user_id': '飞书用户 ID',
  'feishuUserId': '飞书用户 ID',
  'jst_shop_owner_id': '聚水潭店铺负责人 ID',
  'jstShopOwnerId': '聚水潭店铺负责人 ID',
  'jst_sku_id': '聚水潭 SKU ID',
  'jstSkuId': '聚水潭 SKU ID',
  'jst_goods_id': '聚水潭商品 ID',
  'jstGoodsId': '聚水潭商品 ID',
  'express_no': '快递单号',
  'expressNo': '快递单号',
  'logistics_company': '物流公司',
  'logisticsCompany': '物流公司',
  'payment_method': '付款方式',
  'paymentMethod': '付款方式',
  'payment_due_date': '付款截止日期',
  'paymentDueDate': '付款截止日期',
  'invoice_date': '开票日期',
  'invoiceDate': '开票日期',
  'invoiced_amount': '已开票金额',
  'invoicedAmount': '已开票金额',
  'collected_amount': '已回款金额',
  'collectedAmount': '已回款金额',
  'prepayment_deducted': '预付款抵扣金额',
  'prepaymentDeducted': '预付款抵扣金额',
  'credit_warning': '信用预警',
  'creditWarning': '信用预警',
  'floor_price_warning': '底价预警',
  'floorPriceWarning': '底价预警',
  'delivery_date': '交货日期',
  'deliveryDate': '交货日期',
  'expected_delivery_date': '预计到货日期',
  'expectedDeliveryDate': '预计到货日期',
  'consignee': '收货人',
  'consignee_phone': '收货人电话',
  'consigneePhone': '收货人电话',
  'consignee_address': '收货地址',
  'consigneeAddress': '收货地址',
  'consignee_province': '省',
  'consigneeProvince': '省',
  'consignee_city': '市',
  'consigneeCity': '市',
  'consignee_district': '区',
  'consigneeDistrict': '区',
  'consignee_town': '镇',
  'consigneeTown': '镇',
  'consignee_tel': '收货人固话',
  'consigneeTel': '收货人固话',
  'buyer_message': '买家留言',
  'buyerMessage': '买家留言',
  'attachments': '附件',
  'collection_data': '回款数据',
  'collectionData': '回款数据',
  'migration_source': '迁移来源',
  'migrationSource': '迁移来源',
  'order_no': '订单编号',
  'orderNo': '订单编号',
  'received_qty': '已到货数量',
  'receivedQty': '已到货数量',
  'estimated_unit_price': '预估单价',
  'estimatedUnitPrice': '预估单价',
  'supplier_name': '供应商名称',
  'supplierName': '供应商名称',
  'converted_po_id': '已转采购单 ID',
  'convertedPoId': '已转采购单 ID',
  'version': '版本',
  'is_active': '是否启用',
  'isActive': '是否启用',
  'credit_limit': '信用额度',
  'creditLimit': '信用额度',
  'is_credit_blocked': '信用冻结',
  'isCreditBlocked': '信用冻结',
  'prepayment_balance': '预付款余额',
  'prepaymentBalance': '预付款余额',
  'cost_price': '成本价',
  'costPrice': '成本价',
  'floor_price': '底价',
  'floorPrice': '底价',
  'item_type': '物料类型',
  'itemType': '物料类型',
  'code_compliant': '编码合规',
  'codeCompliant': '编码合规',
  'material_category_id': '物料分类 ID',
  'materialCategoryId': '物料分类 ID',
  'material_category_name': '物料分类名称',
  'materialCategoryName': '物料分类名称',
  'level': '层级',
  'parent_id': '父分类 ID',
  'parentId': '父分类 ID',
  'sort_order': '排序',
  'sortOrder': '排序',
  'role': '角色',
  'permissions': '权限',
  'email': '邮箱',
  'password': '密码',
  'avatar': '头像',
  'phone': '电话',
  'address': '地址',
  'from_status': '变更前状态',
  'fromStatus': '变更前状态',
  'to_status': '变更后状态',
  'toStatus': '变更后状态',
  'operator_id': '操作人 ID',
  'operatorId': '操作人 ID',
  'tracking_no': '物流单号',
  'trackingNo': '物流单号',
  'carrier': '承运商',
  'shipped_at': '发货时间',
  'shippedAt': '发货时间',
  'is_transferred_to_finance': '已转财务',
  'isTransferredToFinance': '已转财务',
  'account_code': '科目编码',
  'accountCode': '科目编码',
  'account_name': '科目名称',
  'accountName': '科目名称',
  'debit_amount': '借方金额',
  'debitAmount': '借方金额',
  'credit_amount': '贷方金额',
  'creditAmount': '贷方金额',
  'voucher_date': '凭证日期',
  'voucherDate': '凭证日期',
  'voucher_no': '凭证编号',
  'voucherNo': '凭证编号',
  'source_type': '来源类型',
  'sourceType': '来源类型',
  'source_id': '来源 ID',
  'sourceId': '来源 ID',
  'amount': '金额',
  'description': '描述',
  'reference_type': '引用类型',
  'referenceType': '引用类型',
  'reference_id': '引用 ID',
  'referenceId': '引用 ID',
  'inbound': '入库',
  'outbound': '出库',
  'snapshot_at': '快照时间',
  'snapshotAt': '快照时间',
  'synced_at': '同步时间',
  'syncedAt': '同步时间',
  'triggered_by': '触发人',
  'triggeredBy': '触发人',
  'action': '操作',
  'module': '模块',
  'resource_id': '资源 ID',
  'resourceId': '资源 ID',
  'resource_type': '资源类型',
  'resourceType': '资源类型',
  'detail': '详情',
  'target_month': '目标月份',
  'targetMonth': '目标月份',
  'target_amount': '目标金额',
  'targetAmount': '目标金额',
  'actual_amount': '实际金额',
  'actualAmount': '实际金额',
  'achievement_rate': '达成率',
  'achievementRate': '达成率',
  'year': '年份',
  'month': '月份',
  'rep_id': '销售代表 ID',
  'repId': '销售代表 ID',
  'region': '地区',
  'contact_name': '联系人',
  'contactName': '联系人',
  'contact_phone': '联系人电话',
  'contactPhone': '联系人电话',
  'bank_name': '开户行',
  'bankName': '开户行',
  'bank_account': '银行账号',
  'bankAccount': '银行账号',
  'tax_id': '税号',
  'taxId': '税号',
  'is_primary': '是否默认',
  'isPrimary': '是否默认',
  'feishu_open_id': '飞书 Open ID',
  'feishuOpenId': '飞书 Open ID',
  'feishu_union_id': '飞书 Union ID',
  'feishuUnionId': '飞书 Union ID',
  'jushuitan_shop_id': '聚水潭店铺 ID',
  'jushuitanShopId': '聚水潭店铺 ID',
};

function sshPsql(query) {
  const cmd = `ssh emie@192.168.200.60 "docker exec sales-erp-db psql -U postgres -d sales_erp -tA -c \\"${query.replace(/"/g, '\\"').replace(/\\/g, '\\\\')}\\""`;
  return execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
}

function getTables() {
  const sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
  return sshPsql(sql).trim().split('\n').filter(Boolean);
}

function getColumns(tableName) {
  const sql = `SELECT c.column_name, c.data_type || CASE WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')' WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL THEN '(' || c.numeric_precision || ',' || c.numeric_scale || ')' ELSE '' END, c.is_nullable, COALESCE(c.column_default, ''), CASE WHEN pk.column_name IS NOT NULL THEN 'PK' ELSE '' END FROM information_schema.columns c LEFT JOIN (SELECT ku.table_name, ku.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public') pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name WHERE c.table_schema = 'public' AND c.table_name = '${tableName}' ORDER BY c.ordinal_position`;
  const lines = sshPsql(sql).trim().split('\n').filter(Boolean);
  return lines.map(line => {
    const parts = line.split('|');
    return { name: parts[0], type: parts[1], nullable: parts[2], default: parts[3], pk: parts[4] };
  });
}

function getForeignKeys() {
  const sql = `SELECT tc.table_name, kcu.column_name, ccu.table_name, ccu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name, kcu.ordinal_position`;
  const lines = sshPsql(sql).trim().split('\n').filter(Boolean);
  return lines.map(line => {
    const parts = line.split('|');
    return { table: parts[0], column: parts[1], foreignTable: parts[2], foreignColumn: parts[3] };
  });
}

function getIndexes(tableName) {
  const sql = `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = '${tableName}' ORDER BY indexname`;
  const lines = sshPsql(sql).trim().split('\\n').filter(Boolean);
  return lines.map(line => {
    const parts = line.split('|');
    return { name: parts[0], def: parts[1] };
  });
}

function getFieldLabel(fieldName) {
  return COMMON_FIELD_LABELS[fieldName] || '';
}

function getTableLabel(tableName) {
  return TABLE_LABELS[tableName] || '';
}

function generateDoc(tableName, columns, fks, indexes) {
  const label = getTableLabel(tableName);
  const tableFks = fks.filter(fk => fk.table === tableName);
  const referencedBy = fks.filter(fk => fk.foreignTable === tableName);

  let md = `## \`${tableName}\` ${label ? '— ' + label : ''}\n\n`;

  md += '### 字段\n\n';
  md += '| 字段名 | 中文 | 类型 | 可空 | 默认值 | 键 |\n';
  md += '|--------|------|------|------|--------|-----|\n';
  for (const col of columns) {
    const keys = [col.pk].filter(Boolean).join(', ');
    const def = col.default ? col.default.replace(/'/g, "'") : '';
    const cn = getFieldLabel(col.name);
    md += `| \`${col.name}\` | ${cn} | ${col.type} | ${col.nullable} | ${def} | ${keys} |\n`;
  }
  md += '\n';

  if (tableFks.length > 0) {
    md += '### 外键\n\n';
    for (const fk of tableFks) {
      const ftLabel = getTableLabel(fk.foreignTable);
      md += `- \`${fk.column}\` → [${fk.foreignTable}](${fk.foreignTable}.md)\`${fk.foreignColumn}\` ${ftLabel ? '(' + ftLabel + ')' : ''}\n`;
    }
    md += '\n';
  }

  if (referencedBy.length > 0) {
    md += '### 被引用\n\n';
    for (const ref of referencedBy) {
      const refLabel = getTableLabel(ref.table);
      md += `- [${ref.table}](${ref.table}.md).\`${ref.column}\` → \`${tableName}\` ${refLabel ? '(' + refLabel + ')' : ''}\n`;
    }
    md += '\n';
  }

  if (indexes.length > 0) {
    md += '### 索引\n\n';
    for (const idx of indexes) {
      md += `- \`${idx.name}\`: ${idx.def}\n`;
    }
    md += '\n';
  }

  return md;
}

function generateMermaidER(fks) {
  const relations = [];
  for (const fk of fks) {
    const ftLabel = getTableLabel(fk.foreignTable);
    const tLabel = getTableLabel(fk.table);
    relations.push(`    ${fk.foreignTable}${ftLabel ? `[${ftLabel}]` : ''} ||--o{ ${fk.table}${tLabel ? `[${tLabel}]` : ''} : "${fk.column}"`);
  }

  let md = '## ER 关系图\n\n';
  md += '```mermaid\n';
  md += 'erDiagram\n';
  for (const rel of [...new Set(relations)].sort()) {
    md += rel + '\n';
  }
  md += '```\n\n';
  return md;
}

function main() {
  const outputDir = process.argv[2] || '/tmp/erp-db-docs-cn';
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('Fetching tables...');
  const tables = getTables();
  console.log(`Found ${tables.length} tables`);

  console.log('Fetching foreign keys...');
  const fks = getForeignKeys();

  let overview = `# Sales ERP 数据库文档\n\n`;
  overview += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
  overview += `> 数据库: sales_erp\n`;
  overview += `> 共 ${tables.length} 张表\n\n`;

  overview += '## 表清单\n\n';
  overview += '| 表名 | 中文说明 |\n';
  overview += '|------|----------|\n';
  for (const t of tables) {
    const label = getTableLabel(t);
    overview += `| [\`${t}\`](${t}.md) | ${label} |\n`;
  }
  overview += '\n';

  overview += generateMermaidER(fks);

  fs.writeFileSync(path.join(outputDir, 'README.md'), overview);
  console.log('Generated README.md');

  for (const table of tables) {
    console.log(`Generating ${table}.md...`);
    const columns = getColumns(table);
    const indexes = getIndexes(table);
    const doc = generateDoc(table, columns, fks, indexes);
    fs.writeFileSync(path.join(outputDir, `${table}.md`), doc);
  }

  console.log(`Done! Output: ${outputDir}`);
}

main();
