import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;

async function loginAndGetToken(): Promise<string> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: '管理员', password: 'admin123' }),
  });

  const result = await response.json();
  if (result.code !== 0 || !(result.data?.access_token || result.data?.token)) {
    throw new Error(`Login API error: ${JSON.stringify(result)}`);
  }
  return result.data.access_token || result.data.token;
}

async function setupAuth(page: any, token: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate((t: string) => {
    localStorage.setItem('erp_token', t);
    localStorage.setItem('erp_role', 'admin');
    localStorage.setItem('erp_permissions', JSON.stringify(['*']));
  }, token);
}

test.describe('BOM Deep Check', () => {
  let token: string;
  const consoleLogs: Array<{ type: string; text: string }> = [];

  test.beforeAll(async () => {
    token = await loginAndGetToken();
  });

  test.beforeEach(async ({ page }) => {
    consoleLogs.length = 0;

    page.on('console', (msg: any) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        console.error(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });

    page.on('pageerror', (error: Error) => {
      console.error(`[PAGE ERROR] ${error.message}`);
      consoleLogs.push({ type: 'pageerror', text: error.message });
    });

    await setupAuth(page, token);
  });

  test('purchase orders - add item and select BOM version', async ({ page }) => {
    await page.goto(`${BASE_URL}/purchase-orders`);
    await page.waitForLoadState('networkidle');

    // Click New button
    await page.locator('button:has-text("新建")').first().click();
    await page.waitForTimeout(500);

    // Click "+ 添加采购项"
    await page.locator('text=+ 添加采购项').click();
    await page.waitForTimeout(500);

    // Screenshot: modal with empty row
    await page.screenshot({ path: 'e2e/screenshots/purchase-order-row-added.png' });

    // Click on the "产品名" Select (first column)
    const productSelect = page.locator('.ant-select').filter({ hasText: '选择产品' }).first();
    await productSelect.click();
    await page.waitForTimeout(800);

    // Screenshot: product dropdown
    await page.screenshot({ path: 'e2e/screenshots/purchase-order-product-dropdown.png' });

    // Select first product from dropdown if available
    const firstOption = page.locator('.ant-select-dropdown .ant-select-item-option-content').first();
    const hasOptions = await firstOption.isVisible().catch(() => false);
    if (hasOptions) {
      await firstOption.click();
      await page.waitForTimeout(1000);

      // Screenshot after product selected
      await page.screenshot({ path: 'e2e/screenshots/purchase-order-product-selected.png' });

      // Now click on SKU select
      const skuSelect = page.locator('.ant-select').filter({ hasText: '选择规格型号' }).first();
      await skuSelect.click();
      await page.waitForTimeout(800);

      // Screenshot: SKU dropdown
      await page.screenshot({ path: 'e2e/screenshots/purchase-order-sku-dropdown.png' });

      // Select first SKU
      const firstSkuOption = page.locator('.ant-select-dropdown .ant-select-item-option-content').first();
      const hasSkuOptions = await firstSkuOption.isVisible().catch(() => false);
      if (hasSkuOptions) {
        await firstSkuOption.click();
        await page.waitForTimeout(1000);

        // Screenshot after SKU selected
        await page.screenshot({ path: 'e2e/screenshots/purchase-order-sku-selected.png' });

        // Now check if BOM version select appears
        const bomSelect = page.locator('.ant-select').filter({ hasText: '选择 BOM' }).first();
        const hasBomSelect = await bomSelect.isVisible().catch(() => false);
        console.log(`[INFO] BOM select visible: ${hasBomSelect}`);

        if (hasBomSelect) {
          await bomSelect.click();
          await page.waitForTimeout(800);
          await page.screenshot({ path: 'e2e/screenshots/purchase-order-bom-dropdown.png' });

          // Try to select first BOM option
          const firstBomOption = page.locator('.ant-select-dropdown .ant-select-item-option-content').first();
          const hasBomOptions = await firstBomOption.isVisible().catch(() => false);
          if (hasBomOptions) {
            await firstBomOption.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'e2e/screenshots/purchase-order-bom-selected.png' });
          }
        }
      }
    } else {
      console.log('[INFO] No products available in dropdown');
    }

    const errors = consoleLogs.filter((l) => l.type === 'error' || l.type === 'pageerror');
    console.log(`[RESULT] Purchase Order BOM selection: ${errors.length} console errors`);
    if (errors.length > 0) {
      console.log('[WARN] Errors:', errors.map((e) => e.text));
    }

    expect(errors.length).toBe(0);
  });

  test('products - open detail and check BOM明细 tab', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    // Wait for table to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    // Use page.evaluate to find and click the first eye icon button via JS
    // The action column uses Ant Design fixed columns which render in a separate overlay table
    await page.evaluate(() => {
      // Try to find buttons in the fixed-right table wrapper
      const fixedRight = document.querySelector('.ant-table-fixed-right, .ant-table-cell-fix-right');
      if (fixedRight) {
        const buttons = fixedRight.querySelectorAll('button, .ant-btn');
        if (buttons.length > 0) {
          (buttons[0] as HTMLElement).click();
          return;
        }
      }
      // Fallback: find any button with eye icon (svg with data-icon="eye")
      const eyeSvg = document.querySelector('svg[data-icon="eye"]');
      if (eyeSvg) {
        const btn = eyeSvg.closest('button, .ant-btn');
        if (btn) (btn as HTMLElement).click();
        return;
      }
      // Last fallback: click first row
      const firstRow = document.querySelector('table tbody tr');
      if (firstRow) (firstRow as HTMLElement).click();
    });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/product-detail-drawer.png' });

    // Check for Drawer - try multiple selectors
    const drawerTitle = page.locator('.ant-drawer-title, .ant-drawer-header-title, [class*="drawer"] h4').first();
    const isDrawerOpen = await drawerTitle.isVisible().catch(() => false);
    console.log(`[INFO] Drawer open: ${isDrawerOpen}`);

    // Look for BOM 明细 tab
    const bomTab = page.locator('.ant-tabs-tab:has-text("BOM 明细")').first();
    const hasBomTab = await bomTab.isVisible().catch(() => false);
    console.log(`[INFO] BOM tab visible: ${hasBomTab}`);

    if (hasBomTab) {
      await bomTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'e2e/screenshots/product-bom-tab.png' });

      // Check for BOM content or empty state
      const bomContent = page.locator('text=BOM 明细, .ant-empty, .ant-table').first();
      console.log(`[INFO] BOM content visible: ${await bomContent.isVisible().catch(() => false)}`);
    }

    const errors = consoleLogs.filter((l) => l.type === 'error' || l.type === 'pageerror');
    console.log(`[RESULT] Product BOM detail: ${errors.length} console errors`);
    if (errors.length > 0) {
      console.log('[WARN] Errors:', errors.map((e) => e.text));
    }

    expect(errors.length).toBe(0);
  });
});
