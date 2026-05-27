const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('input[placeholder="邮箱 / 账号"]', { timeout: 10000 });
  await page.fill('input[placeholder="邮箱 / 账号"]', 'admin@example.com');
  await page.fill('input[placeholder="密码"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  await page.waitForTimeout(1000);

  // 销售订单页
  await page.goto('http://localhost:3000/sales-orders');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/sales-order-table.png', fullPage: false });

  // 采购单页
  await page.goto('http://localhost:3000/purchase-orders');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/purchase-order-table.png', fullPage: false });

  // 库存流水页
  await page.goto('http://localhost:3000/stock-ledger');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/stock-ledger-table.png', fullPage: false });

  console.log('Screenshots saved');
  await browser.close();
})();
