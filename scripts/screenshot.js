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

  await page.goto('http://localhost:3000/products');
  await page.waitForTimeout(2000);
  await page.click('.ant-tabs-tab:nth-child(2)');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/products-sku.png', fullPage: false });

  console.log('Screenshot saved');
  await browser.close();
})();
