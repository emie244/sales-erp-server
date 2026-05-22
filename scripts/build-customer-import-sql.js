#!/usr/bin/env node
/* eslint-disable */
/**
 * Customer migration: Feishu Base 客户资源.xlsx → customers SQL.
 * One-shot script. Output:
 *   - import-customers.sql  : idempotent INSERT WHERE NOT EXISTS by feishu_record_id
 *   - import-customers-report.txt : counts + unmatched assignees
 *
 * Usage:
 *   node scripts/build-customer-import-sql.js \
 *     /Users/a1234/Downloads/亿觅销售订单信息聚合_客户资源.xlsx
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const XLSX = process.argv[2];
if (!XLSX) {
  console.error('usage: node build-customer-import-sql.js <xlsx>');
  process.exit(1);
}

const STATUS_MAP = {
  达成合作: 'active',
  感兴趣: 'lead',
  已联系: 'lead',
};

const SETTLEMENT_MAP = {
  账期结算: 'monthly',
};

// Excel value cleansers
function clean(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && 'text' in v) v = v.text;
  if (typeof v === 'object' && 'result' in v) v = v.result;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === 'null') return null;
  return s;
}

function num(v) {
  const s = clean(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function tagsFrom(v) {
  const s = clean(v);
  if (!s) return [];
  return s.split(/[、,，]/).map((x) => x.trim()).filter(Boolean);
}

function urlsFrom(v) {
  const s = clean(v);
  if (!s) return null;
  const parts = s.split(/[\s,，；;]+/).map((x) => x.trim()).filter((x) => x.startsWith('http'));
  return parts.length ? parts : null;
}

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlJson(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
}

function sqlNum(v) {
  return v === null || v === undefined ? 'NULL' : String(v);
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const ws = wb.worksheets[0];
  const headerRow = ws.getRow(1);
  const cols = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, c) => {
    cols[String(cell.value).trim()] = c;
  });

  const need = [
    '客户名称', '预收款金额', '结算类型', '客户负责人 (人员 )', '客户状态',
    '客户标签', '线上销售店铺&链接', '姓名', '职位', '手机', '微信',
    '客户ID', '多维表格记录ID',
  ];
  for (const k of need) {
    if (!cols[k]) {
      console.error(`missing column: ${k}`);
      process.exit(1);
    }
  }

  const rows = [];
  const skipped = [];
  const assigneeNames = new Set();
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = clean(row.getCell(cols['客户名称']).value);
    if (!name) {
      skipped.push({ row: r, reason: '客户名称为空' });
      continue;
    }
    const feishuRecord = clean(row.getCell(cols['多维表格记录ID']).value);
    if (!feishuRecord) {
      skipped.push({ row: r, name, reason: '多维表格记录ID为空' });
      continue;
    }
    const assignee = clean(row.getCell(cols['客户负责人 (人员 )']).value);
    if (assignee) assigneeNames.add(assignee);
    const statusRaw = clean(row.getCell(cols['客户状态']).value);
    const settlementRaw = clean(row.getCell(cols['结算类型']).value);
    rows.push({
      name,
      prepaymentBalance: num(row.getCell(cols['预收款金额']).value) ?? 0,
      settlementType: settlementRaw ? (SETTLEMENT_MAP[settlementRaw] || 'one_off') : 'one_off',
      assigneeName: assignee,
      customerStatus: statusRaw ? (STATUS_MAP[statusRaw] || 'active') : 'active',
      tags: tagsFrom(row.getCell(cols['客户标签']).value),
      onlineShopUrls: urlsFrom(row.getCell(cols['线上销售店铺&链接']).value),
      contactName: clean(row.getCell(cols['姓名']).value),
      contactTitle: clean(row.getCell(cols['职位']).value),
      phone: clean(row.getCell(cols['手机']).value),
      wechat: clean(row.getCell(cols['微信']).value),
      legacyCustomerId: clean(row.getCell(cols['客户ID']).value),
      feishuRecordId: feishuRecord,
    });
  }

  const out = [];
  out.push("-- Auto-generated. Re-runnable: ON NOT EXISTS by feishu_record_id.");
  out.push("BEGIN;");
  for (const r of rows) {
    const assigneeSubquery = r.assigneeName
      ? `(SELECT id FROM users WHERE name = ${sqlStr(r.assigneeName)} LIMIT 1)`
      : 'NULL';
    out.push(`INSERT INTO customers (
  name, "contactName", contact_title, phone, wechat,
  settlement_type, customer_status, tags, online_shop_urls,
  primary_assignee_id, prepayment_balance,
  legacy_customer_id, feishu_record_id, migration_source
)
SELECT
  ${sqlStr(r.name)}, ${sqlStr(r.contactName)}, ${sqlStr(r.contactTitle)}, ${sqlStr(r.phone)}, ${sqlStr(r.wechat)},
  ${sqlStr(r.settlementType)}, ${sqlStr(r.customerStatus)}, ${sqlJson(r.tags)}, ${sqlJson(r.onlineShopUrls)},
  ${assigneeSubquery}, ${sqlNum(r.prepaymentBalance)},
  ${sqlStr(r.legacyCustomerId)}, ${sqlStr(r.feishuRecordId)}, 'feishu_base_2026_05_22'
WHERE NOT EXISTS (
  SELECT 1 FROM customers WHERE feishu_record_id = ${sqlStr(r.feishuRecordId)}
);`);
  }
  out.push("COMMIT;");
  out.push("");
  out.push("-- Verification");
  out.push("SELECT COUNT(*) AS total_customers FROM customers;");
  out.push("SELECT COUNT(*) AS imported_from_feishu FROM customers WHERE migration_source='feishu_base_2026_05_22';");
  out.push("SELECT name AS assignee_name FROM users WHERE id IN (SELECT DISTINCT primary_assignee_id FROM customers WHERE primary_assignee_id IS NOT NULL) ORDER BY name;");
  out.push("SELECT name FROM customers WHERE migration_source='feishu_base_2026_05_22' AND primary_assignee_id IS NULL ORDER BY name LIMIT 30;");

  const outDir = path.resolve(__dirname);
  const sqlPath = path.join(outDir, 'import-customers.sql');
  fs.writeFileSync(sqlPath, out.join('\n'));

  // Report
  const report = [];
  report.push(`=== Customer import preparation report ===`);
  report.push(`Source: ${XLSX}`);
  report.push(`Sheet: ${ws.name}`);
  report.push(`Total rows in sheet (excl header): ${ws.rowCount - 1}`);
  report.push(`Prepared INSERTs: ${rows.length}`);
  report.push(`Skipped rows: ${skipped.length}`);
  for (const s of skipped) report.push(`  - row ${s.row}: ${s.reason}${s.name ? ` (${s.name})` : ''}`);
  report.push('');
  report.push(`Assignee names to resolve via subquery on users.name (${assigneeNames.size} unique):`);
  for (const n of [...assigneeNames].sort()) report.push(`  - ${n}`);
  report.push('');
  report.push(`Status distribution:`);
  const statusCount = {};
  for (const r of rows) statusCount[r.customerStatus] = (statusCount[r.customerStatus] || 0) + 1;
  for (const [k, v] of Object.entries(statusCount)) report.push(`  ${k}: ${v}`);
  report.push('');
  report.push(`Field coverage:`);
  const fields = ['contactName', 'contactTitle', 'phone', 'wechat', 'legacyCustomerId', 'tags', 'onlineShopUrls'];
  for (const f of fields) {
    const filled = rows.filter((r) => {
      const v = r[f];
      if (Array.isArray(v)) return v.length > 0;
      return v !== null && v !== undefined && v !== '';
    }).length;
    report.push(`  ${f}: ${filled}/${rows.length}`);
  }
  const reportPath = path.join(outDir, 'import-customers-report.txt');
  fs.writeFileSync(reportPath, report.join('\n'));

  console.log(`SQL: ${sqlPath}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Rows prepared: ${rows.length}, skipped: ${skipped.length}`);
})();
