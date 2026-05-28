const XLSX = require('/Users/a1234/Documents/📂_02_项目与开发/Github/sales-erp-server/web/node_modules/xlsx');
const { Client } = require('pg');

const EXCLUDE_NAMES = [
  '个人（额温枪）',
  '谭建荣',
  '到货入库',
  '退货入库',
  '盘亏出库',
  '盘盈入库',
  '仓库调拨',
  '促销物料',
  '促销品采购',
  '市场购',
];

(async () => {
  const wb = XLSX.readFile('/Users/a1234/Downloads/亿觅产品表_供应商列表.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // header row
  const headers = rows[0];
  const getIdx = (name) => headers.indexOf(name);

  const nameIdx = getIdx('供应商名称');
  const contactIdx = getIdx('联系人');
  const phoneIdx = getIdx('电话');
  const emailIdx = getIdx('邮箱');
  const addressIdx = getIdx('地址');
  const remarkIdx = getIdx('备注');

  const data = rows
    .slice(1)
    .map((row) => ({
      name: row[nameIdx]?.toString().trim(),
      contactName: row[contactIdx]?.toString().trim() || null,
      phone: row[phoneIdx]?.toString().trim() || null,
      email: row[emailIdx]?.toString().trim() || null,
      address: row[addressIdx]?.toString().trim() || null,
      remark: row[remarkIdx]?.toString().trim() || null,
    }))
    .filter((s) => s.name && !EXCLUDE_NAMES.includes(s.name));

  console.log(`Total rows: ${rows.length - 1}, after filter: ${data.length}`);

  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'sales_erp',
  });
  await client.connect();

  let inserted = 0;
  for (const s of data) {
    try {
      await client.query(
        `INSERT INTO suppliers (id, name, contact_name, phone, email, address, remark, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, NOW(), NOW())`,
        [s.name, s.contactName, s.phone, s.email, s.address, s.remark],
      );
      inserted++;
    } catch (err) {
      console.error(`Failed to insert ${s.name}:`, err.message);
    }
  }

  console.log(`Inserted ${inserted} suppliers`);
  await client.end();
})();
