import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/* ------------------------------------------------------------------ */
/*  Configuration                                                       */
/* ------------------------------------------------------------------ */

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;
const LOGIN_CREDENTIALS = { username: 'user', password: '1234555@' };

interface TestResult {
  name: string;
  passed: boolean;
  screenshotPath: string;
  issues: string[];
}

const results: TestResult[] = [];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

async function loginViaApi(): Promise<string> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(LOGIN_CREDENTIALS),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const result = await response.json();
  if (result.code !== 0 || !result.data?.token) {
    throw new Error(`Login API error: ${JSON.stringify(result)}`);
  }

  return result.data.token;
}

async function setupAuth(page: Page, token: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate((t) => {
    localStorage.setItem('erp_token', t);
    localStorage.setItem('erp_role', 'user');
    localStorage.setItem(
      'erp_permissions',
      JSON.stringify([
        'order:view', 'order:create', 'order:edit', 'order:submit',
        'customer:view', 'customer:create', 'customer:edit',
        'product:view', 'product:create', 'product:edit',
        'prepayment:view', 'prepayment:create', 'prepayment:edit',
        'approval:view', 'approval:handle',
        'report:view', 'stock:view', 'bom:view',
        'supplier:view', 'purchase_order:view', 'purchase_request:view',
        'production_order:view', 'material_category:view',
        'invoice:view', 'invoice:create', 'invoice:edit',
        'voucher:view', 'voucher:create', 'voucher:edit',
        'customer:delete', 'stock:edit_safety',
        'bom:create', 'bom:edit', 'bom:delete',
      ]),
    );
  }, token);
}

function collectConsoleMessages(page: Page): { errors: string[]; warnings: string[]; all: string[] } {
  const messages = { errors: [] as string[], warnings: [] as string[], all: [] as string[] };

  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text();
    messages.all.push(`[${msg.type()}] ${text}`);

    if (msg.type() === 'error') {
      // Filter out known non-issue errors
      if (
        text.includes('favicon') ||
        text.includes('Source map') ||
        text.includes('sourcemap') ||
        text.includes('net::ERR_BLOCKED_BY_CLIENT') ||
        text.includes('ERR_NAME_NOT_RESOLVED') ||
        text.includes('Failed to load resource') && text.includes('img')
      ) {
        return;
      }
      messages.errors.push(text);
    }

    if (msg.type() === 'warning') {
      messages.warnings.push(text);
    }
  });

  page.on('pageerror', (error) => {
    const text = `PAGE ERROR: ${error.message}`;
    messages.errors.push(text);
    messages.all.push(text);
  });

  return messages;
}

async function waitForPageLoad(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

async function screenshot(page: Page, name: string): Promise<string> {
  const path = `e2e/screenshots/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function checkForToast(page: Page, keyword: string, timeout = 3000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const toast = page.locator('.ant-message-notice, .ant-notification-notice').first();
    if (await toast.isVisible().catch(() => false)) {
      const text = await toast.textContent().catch(() => '');
      if (text.includes(keyword)) return true;
    }
    await page.waitForTimeout(200);
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Test 1: Profile Page - No 403 Toast                               */
/* ------------------------------------------------------------------ */

test('Test 1: Profile page - no 403 permission toast', async ({ page }) => {
  const token = await loginViaApi();
  const messages = collectConsoleMessages(page);
  const issues: string[] = [];
  const network403Urls: string[] = [];

  // Listen for network 403 responses
  page.on('response', (response) => {
    if (response.status() === 403) {
      network403Urls.push(response.url());
    }
  });

  await setupAuth(page, token);
  await waitForPageLoad(page, '/profile');

  // Wait for page to fully render
  await page.waitForTimeout(2000);

  // Check for 403 / permission-related toast (the main thing we're testing)
  const toastLocator = page.locator('.ant-message-notice, .ant-notification-notice');
  const toastCount = await toastLocator.count().catch(() => 0);

  let hasPermissionToast = false;
  if (toastCount > 0) {
    for (let i = 0; i < Math.min(toastCount, 5); i++) {
      const toast = toastLocator.nth(i);
      const text = await toast.textContent().catch(() => '');
      if (text.includes('403') || text.includes('权限') || text.includes('权限不足')) {
        hasPermissionToast = true;
        issues.push(`Found permission toast: "${text.trim()}"`);
      }
    }
  }

  // Check network 403s to identify which API is failing
  if (network403Urls.length > 0) {
    for (const url of network403Urls) {
      issues.push(`Network 403: ${url}`);
    }
  }

  // Only fail if there's a visible permission toast (the bug we're fixing)
  // Console resource 403s from unrelated APIs are noted but don't fail the test
  const screenshotPath = await screenshot(page, 'test1-profile');

  results.push({
    name: 'Test 1: Profile page - no 403 permission toast',
    passed: !hasPermissionToast,
    screenshotPath,
    issues,
  });

  expect(hasPermissionToast, `Permission toast still shown: ${issues.join('; ')}`).toBe(false);
});

/* ------------------------------------------------------------------ */
/*  Test 2: Reports Page - No Chart Errors                            */
/* ------------------------------------------------------------------ */

test('Test 2: Reports page - no Unknown position chart error', async ({ page }) => {
  const token = await loginViaApi();
  const messages = collectConsoleMessages(page);
  const issues: string[] = [];

  await setupAuth(page, token);
  await waitForPageLoad(page, '/reports');

  // Wait for charts to render
  await page.waitForTimeout(2000);

  // Check for "Unknown position" error
  const chartErrors = messages.errors.filter(
    (e) => e.includes('Unknown position') || e.includes('position: middle'),
  );
  if (chartErrors.length > 0) {
    issues.push(`Chart position errors: ${chartErrors.join('; ')}`);
  }

  // Check that charts rendered (canvas or svg elements)
  const chartElements = page.locator('canvas, svg, .ant-chart, [class*="chart"]');
  const chartCount = await chartElements.count().catch(() => 0);
  if (chartCount === 0) {
    issues.push('No chart elements found on page');
  }

  // Also check for any chart-related console errors
  const allChartErrors = messages.errors.filter(
    (e) =>
      e.includes('chart') ||
      e.includes('Chart') ||
      e.includes('recharts') ||
      e.includes('antv') ||
      e.includes('g2') ||
      e.includes('plot'),
  );
  if (allChartErrors.length > 0) {
    issues.push(`Other chart errors: ${allChartErrors.join('; ')}`);
  }

  const screenshotPath = await screenshot(page, 'test2-reports');

  results.push({
    name: 'Test 2: Reports page - no Unknown position chart error',
    passed: issues.length === 0,
    screenshotPath,
    issues,
  });

  expect(issues.length, `Issues found: ${issues.join('; ')}`).toBe(0);
});

/* ------------------------------------------------------------------ */
/*  Test 3: Products Page - Normal Load                               */
/* ------------------------------------------------------------------ */

test('Test 3: Products page - normal load without critical errors', async ({ page }) => {
  const token = await loginViaApi();
  const messages = collectConsoleMessages(page);
  const issues: string[] = [];

  await setupAuth(page, token);
  await waitForPageLoad(page, '/products');

  // Wait for page to load
  await page.waitForTimeout(1500);

  // Check page loaded
  const pageTitle = page.locator('text=商品管理, text=产品列表, text=商品, text=产品').first();
  const hasTitle = await pageTitle.isVisible().catch(() => false);
  if (!hasTitle) {
    // Try broader selector
    const anyContent = page.locator('table, .ant-table, .ant-card').first();
    const hasContent = await anyContent.isVisible().catch(() => false);
    if (!hasContent) {
      issues.push('Page content not detected');
    }
  }

  // Check for critical errors (ignore image domain resolution failures)
  const criticalErrors = messages.errors.filter(
    (e) =>
      !e.includes('ERR_NAME_NOT_RESOLVED') &&
      !e.includes('Failed to load resource') &&
      !e.includes('img') &&
      !e.includes('image') &&
      !e.includes('图片'),
  );
  if (criticalErrors.length > 0) {
    issues.push(`Critical console errors: ${criticalErrors.join('; ')}`);
  }

  const screenshotPath = await screenshot(page, 'test3-products');

  results.push({
    name: 'Test 3: Products page - normal load without critical errors',
    passed: issues.length === 0,
    screenshotPath,
    issues,
  });

  expect(issues.length, `Issues found: ${issues.join('; ')}`).toBe(0);
});

/* ------------------------------------------------------------------ */
/*  Test 4: Sales Orders Page - Sales Rep Filter No 403               */
/* ------------------------------------------------------------------ */

test('Test 4: Sales orders page - sales rep filter loads without 403', async ({ page }) => {
  const token = await loginViaApi();
  const messages = collectConsoleMessages(page);
  const issues: string[] = [];

  await setupAuth(page, token);
  await waitForPageLoad(page, '/sales-orders');

  // Wait for page to load
  await page.waitForTimeout(1500);

  // Find and click the sales rep filter dropdown
  const salesRepSelect = page
    .locator('.ant-select')
    .filter({ hasText: /业务员|销售员|负责人/ })
    .first();
  const anySelect = page.locator('.ant-select').first();
  const targetSelect = (await salesRepSelect.isVisible().catch(() => false))
    ? salesRepSelect
    : anySelect;

  if (await targetSelect.isVisible().catch(() => false)) {
    await targetSelect.click();
    await page.waitForTimeout(1000);

    // Check if dropdown opened with user list
    const dropdown = page.locator('.ant-select-dropdown').first();
    const dropdownVisible = await dropdown.isVisible().catch(() => false);

    if (dropdownVisible) {
      // Check if dropdown has options (not empty/error state)
      const options = dropdown.locator('.ant-select-item');
      const optionCount = await options.count().catch(() => 0);

      if (optionCount === 0) {
        // Could be loading or empty - check for loading state
        const loading = await dropdown.locator('.ant-select-loading').count().catch(() => 0);
        if (loading > 0) {
          await page.waitForTimeout(1000);
        }
      }
    }

    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    issues.push('Sales rep filter dropdown not found');
  }

  // Check for 403 errors in console
  const forbiddenErrors = messages.errors.filter(
    (e) => e.includes('403') || e.includes('Forbidden') || e.includes('权限'),
  );
  if (forbiddenErrors.length > 0) {
    issues.push(`403 errors when loading sales rep filter: ${forbiddenErrors.join('; ')}`);
  }

  // Also check network responses for 403
  const network403: string[] = [];
  page.on('response', (response) => {
    if (response.status() === 403) {
      network403.push(response.url());
    }
  });

  // Re-open dropdown to trigger API call and check for 403
  if (await targetSelect.isVisible().catch(() => false)) {
    await targetSelect.click();
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  if (network403.length > 0) {
    issues.push(`Network 403 responses: ${network403.join('; ')}`);
  }

  const screenshotPath = await screenshot(page, 'test4-sales-orders');

  results.push({
    name: 'Test 4: Sales orders page - sales rep filter loads without 403',
    passed: issues.length === 0,
    screenshotPath,
    issues,
  });

  expect(issues.length, `Issues found: ${issues.join('; ')}`).toBe(0);
});

/* ------------------------------------------------------------------ */
/*  Summary Report                                                      */
/* ------------------------------------------------------------------ */

test.afterAll(async () => {
  console.log('\n' + '='.repeat(80));
  console.log('FIX VERIFICATION TEST SUMMARY');
  console.log('='.repeat(80));

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`\n${icon} ${r.name}`);
    console.log(`   Screenshot: ${r.screenshotPath}`);
    if (r.issues.length > 0) {
      console.log(`   Issues:`);
      for (const issue of r.issues) {
        console.log(`     - ${issue}`);
      }
    } else {
      console.log(`   No issues found.`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n' + '-'.repeat(80));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(80) + '\n');
});
