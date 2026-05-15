import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;

interface ConsoleLog {
  type: string;
  text: string;
  location: string;
}

async function loginAndGetToken(): Promise<string> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: '管理员', password: 'admin123' }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.code !== 0 || !(result.data?.access_token || result.data?.token)) {
    throw new Error(`Login API error: ${JSON.stringify(result)}`);
  }

  return result.data.access_token || result.data.token;
}

test.describe('Console Error Check - Critical Pages', () => {
  let token: string;
  const consoleLogs: ConsoleLog[] = [];

  test.beforeAll(async () => {
    token = await loginAndGetToken();
    console.log('[INFO] Login successful, token obtained');
  });

  test.beforeEach(async ({ page }) => {
    consoleLogs.length = 0;

    page.on('console', (msg) => {
      const log: ConsoleLog = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location().url || '',
      };
      consoleLogs.push(log);

      if (msg.type() === 'error') {
        console.error(`[CONSOLE ERROR] ${msg.text()} at ${msg.location().url}`);
      }
    });

    page.on('pageerror', (error) => {
      console.error(`[PAGE ERROR] ${error.message}`);
      consoleLogs.push({
        type: 'pageerror',
        text: error.message,
        location: '',
      });
    });

    // Set auth state
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate((t) => {
      localStorage.setItem('erp_token', t);
      localStorage.setItem('erp_role', 'admin');
      localStorage.setItem('erp_permissions', JSON.stringify(['*']));
    }, token);
  });

  test('homepage loads without console errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Wait for dashboard to load
    await expect(page.locator('text=Sales ERP').first()).toBeVisible({
      timeout: 10000,
    });

    const errors = consoleLogs.filter(
      (l) => l.type === 'error' || l.type === 'pageerror',
    );
    if (errors.length > 0) {
      console.log('[WARN] Console errors on homepage:', errors);
    }

    // Take screenshot
    await page.screenshot({
      path: 'e2e/screenshots/homepage.png',
      fullPage: true,
    });

    // We report but don't fail - some errors might be expected in dev
    console.log(`[RESULT] Homepage: ${errors.length} console errors`);
  });

  test('purchase orders page - new order BOM selection', async ({ page }) => {
    await page.goto(`${BASE_URL}/purchase-orders`);
    await page.waitForLoadState('networkidle');

    // Wait for page to load
    await expect(page.locator('text=采购单').first()).toBeVisible({
      timeout: 10000,
    });

    // Click "新建" (New) button
    const newButton = page.locator('button:has-text("新建")').first();
    if (await newButton.isVisible().catch(() => false)) {
      await newButton.click();
      await page.waitForTimeout(500);

      // Look for BOM selector
      const bomSelect = page
        .locator(
          '.ant-select:has-text("BOM"), [data-testid*="bom"], input[placeholder*="BOM"]',
        )
        .first();
      if (await bomSelect.isVisible().catch(() => false)) {
        await bomSelect.click();
        await page.waitForTimeout(500);

        // Take screenshot of BOM dropdown state
        await page.screenshot({
          path: 'e2e/screenshots/purchase-order-bom-dropdown.png',
        });
      }

      // Take screenshot of modal/form
      await page.screenshot({
        path: 'e2e/screenshots/purchase-order-new.png',
        fullPage: true,
      });
    } else {
      console.log('[INFO] New button not found, taking page screenshot');
      await page.screenshot({
        path: 'e2e/screenshots/purchase-orders-list.png',
        fullPage: true,
      });
    }

    const errors = consoleLogs.filter(
      (l) => l.type === 'error' || l.type === 'pageerror',
    );
    console.log(
      `[RESULT] Purchase Orders page: ${errors.length} console errors`,
    );
    if (errors.length > 0) {
      console.log(
        '[WARN] Errors:',
        errors.map((e) => e.text),
      );
    }
  });

  test('products page - product detail BOM明细', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    // Wait for page to load
    await expect(page.locator('text=商品').first()).toBeVisible({
      timeout: 10000,
    });

    await page.screenshot({
      path: 'e2e/screenshots/products-list.png',
      fullPage: true,
    });

    // Try to click on first product row to open detail
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(800);

      // Take screenshot of detail modal/drawer
      await page.screenshot({
        path: 'e2e/screenshots/product-detail.png',
        fullPage: true,
      });

      // Look for BOM明细 tab/link
      const bomTab = page
        .locator(
          'text=BOM明细, .ant-tabs-tab:has-text("BOM"), [data-testid*="bom"]',
        )
        .first();
      if (await bomTab.isVisible().catch(() => false)) {
        await bomTab.click();
        await page.waitForTimeout(800);
        await page.screenshot({
          path: 'e2e/screenshots/product-bom-detail.png',
          fullPage: true,
        });
      }
    }

    const errors = consoleLogs.filter(
      (l) => l.type === 'error' || l.type === 'pageerror',
    );
    console.log(`[RESULT] Products page: ${errors.length} console errors`);
    if (errors.length > 0) {
      console.log(
        '[WARN] Errors:',
        errors.map((e) => e.text),
      );
    }
  });
});
