import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/* ------------------------------------------------------------------ */
/*  Configuration                                                       */
/* ------------------------------------------------------------------ */

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;
const LOGIN_CREDENTIALS = { username: 'user', password: '1234555@' };

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface PageResult {
  path: string;
  title: string;
  loadStatus: 'pass' | 'fail';
  dataStatus: 'has-data' | 'empty' | 'no-table' | 'fail';
  searchStatus: 'pass' | 'none' | 'fail';
  filterStatus: 'pass' | 'none' | 'fail';
  createStatus: 'pass' | 'none' | 'fail';
  consoleErrors: string[];
  notes: string[];
}

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

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        text.includes('favicon') ||
        text.includes('Source map') ||
        text.includes('sourcemap') ||
        text.includes('net::ERR_BLOCKED_BY_CLIENT')
      ) {
        return;
      }
      errors.push(text);
    }
  });

  page.on('pageerror', (error) => {
    errors.push(`PAGE ERROR: ${error.message}`);
  });

  return errors;
}

async function waitForPageLoad(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `e2e/screenshots/${name}.png`,
    fullPage: true,
  });
}

/**
 * Check if page has visible text matching any of the given keywords.
 * Uses getByText which is more reliable than CSS text selectors.
 */
async function hasPageTitle(page: Page, keywords: string[], timeout = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const kw of keywords) {
      const locator = page.getByText(kw, { exact: false });
      const count = await locator.count().catch(() => 0);
      if (count > 0) {
        const visible = await locator.first().isVisible().catch(() => false);
        if (visible) return true;
      }
    }
    await page.waitForTimeout(200);
  }
  return false;
}

async function expectPageTitle(page: Page, keywords: string[], timeout = 5000): Promise<void> {
  const found = await hasPageTitle(page, keywords, timeout);
  if (!found) {
    throw new Error(`Page title not found. Expected one of: ${keywords.join(', ')}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Page Test Functions                                                 */
/* ------------------------------------------------------------------ */

async function testDashboard(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/dashboard', title: '仪表盘',
    loadStatus: 'pass', dataStatus: 'no-table',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/dashboard');
    await expectPageTitle(page, ['仪表盘', 'Dashboard', 'Sales ERP']);

    // 统计卡片是否显示数据
    const statCards = page.locator('.ant-statistic, .ant-card, [class*="stat"]').first();
    const hasStats = await statCards.isVisible().catch(() => false);
    if (!hasStats) result.notes.push('No stat cards detected');

    // 图表是否渲染
    const chart = page.locator('canvas, .ant-chart, [class*="chart"], svg').first();
    const hasChart = await chart.isVisible().catch(() => false);
    if (!hasChart) result.notes.push('No charts detected');

    await screenshot(page, 'dashboard');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Load error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testCustomers(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/customers', title: '客户管理',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/customers');
    await expectPageTitle(page, ['客户列表', '客户管理', '客户']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    // 搜索框测试
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="查询"], .ant-input-search input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      result.searchStatus = 'pass';
      await searchInput.fill('test');
      await page.waitForTimeout(800);
      await searchInput.clear();
      await page.waitForTimeout(400);
    } else { result.searchStatus = 'none'; }

    // 状态筛选测试
    const statusSelect = page.locator('.ant-select').filter({ hasText: /状态|全部/ }).first();
    if (await statusSelect.isVisible().catch(() => false)) {
      result.filterStatus = 'pass';
      await statusSelect.click();
      await page.waitForTimeout(600);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    } else {
      result.filterStatus = 'none';
    }

    // 点击"新建客户"按钮测试
    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增"), button:has-text("添加")').first();
    if (await createBtn.isVisible().catch(() => false)) {
      result.createStatus = 'pass';
      await createBtn.click();
      await page.waitForTimeout(800);
      const modal = page.locator('.ant-modal-wrap, .ant-drawer-open, .ant-modal-content').first();
      if (await modal.isVisible().catch(() => false)) {
        const closeBtn = page.locator('.ant-modal-close, .ant-drawer-close').first();
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
        await page.waitForTimeout(400);
      }
    } else { result.createStatus = 'none'; }

    await screenshot(page, 'customers');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testProducts(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/products', title: '商品管理',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/products');
    await expectPageTitle(page, ['商品管理', '产品列表', '商品', '产品']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    const searchInput = page.locator('input[placeholder*="搜索"], input.ant-input').first();
    result.searchStatus = await searchInput.isVisible().catch(() => false) ? 'pass' : 'none';

    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增")').first();
    result.createStatus = await createBtn.isVisible().catch(() => false) ? 'pass' : 'none';

    // Tab 切换测试 (products/skus/categories)
    const tabs = page.locator('.ant-tabs-tab');
    const tabCount = await tabs.count().catch(() => 0);
    if (tabCount > 1) {
      for (let i = 1; i < Math.min(tabCount, 3); i++) {
        const tab = tabs.nth(i);
        if (await tab.isVisible().catch(() => false)) {
          await tab.click();
          await page.waitForTimeout(600);
        }
      }
      // 切回第一个 tab
      const firstTab = tabs.nth(0);
      if (await firstTab.isVisible().catch(() => false)) {
        await firstTab.click();
        await page.waitForTimeout(400);
      }
    }

    await screenshot(page, 'products');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testSalesOrders(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/sales-orders', title: '销售订单',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/sales-orders');
    await expectPageTitle(page, ['销售订单']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    // 搜索框测试
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="订单号"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      result.searchStatus = 'pass';
      await searchInput.fill('test');
      await page.waitForTimeout(800);
      await searchInput.clear();
      await page.waitForTimeout(400);
    } else {
      result.searchStatus = 'none';
    }

    // 业务员筛选下拉框测试（之前报 403 的问题）
    const salesRepSelect = page.locator('.ant-select').filter({ hasText: /业务员|销售员|负责人/ }).first();
    const anySelect = page.locator('.ant-select').first();
    const targetSelect = await salesRepSelect.isVisible().catch(() => false) ? salesRepSelect : anySelect;
    if (await targetSelect.isVisible().catch(() => false)) {
      result.filterStatus = 'pass';
      await targetSelect.click();
      await page.waitForTimeout(600);
      const dropdown = page.locator('.ant-select-dropdown').first();
      if (await dropdown.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    } else {
      result.filterStatus = 'none';
    }

    // 状态筛选测试
    const statusSelect = page.locator('.ant-select').filter({ hasText: /状态|全部状态/ }).first();
    if (await statusSelect.isVisible().catch(() => false)) {
      await statusSelect.click();
      await page.waitForTimeout(600);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // 日期筛选测试
    const datePicker = page.locator('.ant-picker').first();
    if (await datePicker.isVisible().catch(() => false)) {
      await datePicker.click();
      await page.waitForTimeout(400);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // 点击"新建订单"按钮测试
    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增"), button:has-text("新建订单")').first();
    if (await createBtn.isVisible().catch(() => false)) {
      result.createStatus = 'pass';
      await createBtn.click();
      await page.waitForTimeout(800);
      const modal = page.locator('.ant-modal-wrap, .ant-drawer-open, .ant-modal-content').first();
      if (await modal.isVisible().catch(() => false)) {
        const closeBtn = page.locator('.ant-modal-close, .ant-drawer-close').first();
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
        await page.waitForTimeout(400);
      }
    } else {
      result.createStatus = 'none';
    }

    // 点击"查看"按钮测试（如果有数据）
    if (result.dataStatus === 'has-data') {
      const viewBtn = page.locator('button:has-text("查看"), a:has-text("查看")').first();
      if (await viewBtn.isVisible().catch(() => false)) {
        await viewBtn.click();
        await page.waitForTimeout(800);
        const detailModal = page.locator('.ant-modal-wrap, .ant-drawer-open, .ant-modal-content').first();
        if (await detailModal.isVisible().catch(() => false)) {
          const closeBtn = page.locator('.ant-modal-close, .ant-drawer-close').first();
          if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
          await page.waitForTimeout(400);
        }
      }
    }

    await screenshot(page, 'sales-orders');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testPrepayments(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/prepayments', title: '预付款管理',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/prepayments');
    await expectPageTitle(page, ['预付款管理', '预付款']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    const searchInput = page.locator('input[placeholder*="搜索"]').first();
    result.searchStatus = await searchInput.isVisible().catch(() => false) ? 'pass' : 'none';

    // 点击"新建预付款"按钮测试
    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增"), button:has-text("新建预付款")').first();
    if (await createBtn.isVisible().catch(() => false)) {
      result.createStatus = 'pass';
      await createBtn.click();
      await page.waitForTimeout(800);
      const modal = page.locator('.ant-modal-wrap, .ant-drawer-open, .ant-modal-content').first();
      if (await modal.isVisible().catch(() => false)) {
        const closeBtn = page.locator('.ant-modal-close, .ant-drawer-close').first();
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
        await page.waitForTimeout(400);
      }
    } else {
      result.createStatus = 'none';
    }

    await screenshot(page, 'prepayments');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testApprovals(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/approvals', title: '审批中心',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/approvals');
    await expectPageTitle(page, ['审批中心', '审批']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    // Tab 切换测试
    const tabs = page.locator('.ant-tabs-tab');
    const tabCount = await tabs.count().catch(() => 0);
    if (tabCount > 1) {
      for (let i = 1; i < Math.min(tabCount, 4); i++) {
        const tab = tabs.nth(i);
        if (await tab.isVisible().catch(() => false)) {
          await tab.click();
          await page.waitForTimeout(600);
        }
      }
      const firstTab = tabs.nth(0);
      if (await firstTab.isVisible().catch(() => false)) {
        await firstTab.click();
        await page.waitForTimeout(400);
      }
    }

    await screenshot(page, 'approvals');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testReports(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/reports', title: '报表分析',
    loadStatus: 'pass', dataStatus: 'no-table',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/reports');
    await expectPageTitle(page, ['报表分析', '报表']);

    // Tab 切换测试
    const tabs = page.locator('.ant-tabs-tab');
    const tabCount = await tabs.count().catch(() => 0);
    if (tabCount > 1) {
      for (let i = 1; i < Math.min(tabCount, 4); i++) {
        const tab = tabs.nth(i);
        if (await tab.isVisible().catch(() => false)) {
          await tab.click();
          await page.waitForTimeout(600);
        }
      }
      const firstTab = tabs.nth(0);
      if (await firstTab.isVisible().catch(() => false)) {
        await firstTab.click();
        await page.waitForTimeout(400);
      }
    }

    // 图表是否渲染
    const chart = page.locator('canvas, .ant-chart, [class*="chart"], svg').first();
    const hasChart = await chart.isVisible().catch(() => false);
    if (!hasChart) result.notes.push('No charts detected');

    await screenshot(page, 'reports');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testSuppliers(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/suppliers', title: '供应商管理',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/suppliers');
    await expectPageTitle(page, ['供应商管理', '供应商']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    // 搜索框测试
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="查询"], .ant-input-search input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      result.searchStatus = 'pass';
      await searchInput.fill('test');
      await page.waitForTimeout(800);
      await searchInput.clear();
      await page.waitForTimeout(400);
    } else {
      result.searchStatus = 'none';
    }

    // 状态筛选测试
    const statusSelect = page.locator('.ant-select').filter({ hasText: /状态|全部/ }).first();
    if (await statusSelect.isVisible().catch(() => false)) {
      result.filterStatus = 'pass';
      await statusSelect.click();
      await page.waitForTimeout(600);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    } else {
      result.filterStatus = 'none';
    }

    // 排序测试 - 点击表头排序
    const sortHeader = page.locator('th.ant-table-column-has-sorters, th[aria-sort]').first();
    if (await sortHeader.isVisible().catch(() => false)) {
      await sortHeader.click();
      await page.waitForTimeout(600);
      await sortHeader.click();
      await page.waitForTimeout(400);
    }

    // 点击"新建供应商"按钮测试
    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增"), button:has-text("添加")').first();
    if (await createBtn.isVisible().catch(() => false)) {
      result.createStatus = 'pass';
      await createBtn.click();
      await page.waitForTimeout(800);
      const modal = page.locator('.ant-modal-wrap, .ant-drawer-open, .ant-modal-content').first();
      if (await modal.isVisible().catch(() => false)) {
        const closeBtn = page.locator('.ant-modal-close, .ant-drawer-close').first();
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
        await page.waitForTimeout(400);
      }
    } else {
      result.createStatus = 'none';
    }

    await screenshot(page, 'suppliers');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testPurchaseRequests(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/purchase-requests', title: '采购申请',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/purchase-requests');
    await expectPageTitle(page, ['采购申请']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增")').first();
    result.createStatus = await createBtn.isVisible().catch(() => false) ? 'pass' : 'none';

    await screenshot(page, 'purchase-requests');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testPurchaseOrders(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/purchase-orders', title: '采购单管理',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/purchase-orders');
    await expectPageTitle(page, ['采购单管理', '采购单']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增")').first();
    result.createStatus = await createBtn.isVisible().catch(() => false) ? 'pass' : 'none';

    await screenshot(page, 'purchase-orders');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testProductionOrders(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/production-orders', title: '加工入库',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/production-orders');
    await expectPageTitle(page, ['加工入库', '加工']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增")').first();
    result.createStatus = await createBtn.isVisible().catch(() => false) ? 'pass' : 'none';

    await screenshot(page, 'production-orders');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testBoms(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/boms', title: 'BOM管理',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/boms');
    await expectPageTitle(page, ['BOM 管理', 'BOM管理', 'BOM']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    // 点击"新建 BOM"按钮测试
    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增"), button:has-text("新建 BOM")').first();
    if (await createBtn.isVisible().catch(() => false)) {
      result.createStatus = 'pass';
      await createBtn.click();
      await page.waitForTimeout(800);
      const modal = page.locator('.ant-modal-wrap, .ant-drawer-open, .ant-modal-content').first();
      if (await modal.isVisible().catch(() => false)) {
        const closeBtn = page.locator('.ant-modal-close, .ant-drawer-close').first();
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
        await page.waitForTimeout(400);
      }
    } else {
      result.createStatus = 'none';
    }

    await screenshot(page, 'boms');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testStockLedger(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/stock-ledger', title: '库存流水',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/stock-ledger');
    await expectPageTitle(page, ['库存流水', '库存']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    await screenshot(page, 'stock-ledger');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testInvoices(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/invoices', title: '发票管理',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/invoices');
    await expectPageTitle(page, ['发票管理', '发票']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    // 点击"新建发票"按钮测试
    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增"), button:has-text("新建发票")').first();
    if (await createBtn.isVisible().catch(() => false)) {
      result.createStatus = 'pass';
      await createBtn.click();
      await page.waitForTimeout(800);
      const modal = page.locator('.ant-modal-wrap, .ant-drawer-open, .ant-modal-content').first();
      if (await modal.isVisible().catch(() => false)) {
        const closeBtn = page.locator('.ant-modal-close, .ant-drawer-close').first();
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
        await page.waitForTimeout(400);
      }
    } else {
      result.createStatus = 'none';
    }

    await screenshot(page, 'invoices');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testVouchers(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/vouchers', title: '会计凭证',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/vouchers');
    await expectPageTitle(page, ['会计凭证', '凭证']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    // 点击"新建凭证"按钮测试
    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增"), button:has-text("新建凭证")').first();
    if (await createBtn.isVisible().catch(() => false)) {
      result.createStatus = 'pass';
      await createBtn.click();
      await page.waitForTimeout(800);
      const modal = page.locator('.ant-modal-wrap, .ant-drawer-open, .ant-modal-content').first();
      if (await modal.isVisible().catch(() => false)) {
        const closeBtn = page.locator('.ant-modal-close, .ant-drawer-close').first();
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
        await page.waitForTimeout(400);
      }
    } else {
      result.createStatus = 'none';
    }

    await screenshot(page, 'vouchers');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testAgingReport(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/aging-report', title: '账龄分析',
    loadStatus: 'pass', dataStatus: 'no-table',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/aging-report');
    await expectPageTitle(page, ['账龄分析', '账龄']);
    await screenshot(page, 'aging-report');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testCustomerStatement(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/customer-statement', title: '客户对账单',
    loadStatus: 'pass', dataStatus: 'no-table',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/customer-statement');
    await expectPageTitle(page, ['客户对账单', '对账单', '对账']);
    await screenshot(page, 'customer-statement');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testMaterialCategories(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/material-categories', title: '物料分类',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/material-categories');
    await expectPageTitle(page, ['物料分类', '物料']);

    const table = page.locator('table, .ant-table').first();
    if (await table.isVisible().catch(() => false)) {
      const count = await page.locator('table tbody tr').count().catch(() => 0);
      result.dataStatus = count > 0 ? 'has-data' : 'empty';
    }

    // 点击"新建分类"按钮测试
    const createBtn = page.locator('button:has-text("新建"), button:has-text("新增"), button:has-text("新建分类")').first();
    if (await createBtn.isVisible().catch(() => false)) {
      result.createStatus = 'pass';
      await createBtn.click();
      await page.waitForTimeout(800);
      const modal = page.locator('.ant-modal-wrap, .ant-drawer-open, .ant-modal-content').first();
      if (await modal.isVisible().catch(() => false)) {
        const closeBtn = page.locator('.ant-modal-close, .ant-drawer-close').first();
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
        await page.waitForTimeout(400);
      }
    } else {
      result.createStatus = 'none';
    }

    await screenshot(page, 'material-categories');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testProfile(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/profile', title: '个人中心',
    loadStatus: 'pass', dataStatus: 'no-table',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/profile');
    await expectPageTitle(page, ['个人中心', '个人', '资料', '信息']);

    // 统计卡片是否显示数据
    const statCards = page.locator('.ant-card, .ant-statistic, [class*="stat"]').first();
    const hasStats = await statCards.isVisible().catch(() => false);
    if (!hasStats) {
      result.notes.push('No stat cards detected');
    }

    // 操作日志区域 - 检查是否静默处理 403（不应该弹 toast）
    const logArea = page.locator('.ant-list, .ant-table, [class*="log"]').first();
    if (await logArea.isVisible().catch(() => false)) {
      // 检查是否有 toast 报错弹窗
      await page.waitForTimeout(500);
      const toast = page.locator('.ant-message-notice, .ant-notification-notice').first();
      if (await toast.isVisible().catch(() => false)) {
        const toastText = await toast.textContent().catch(() => '');
        if (toastText.includes('403') || toastText.includes('权限')) {
          result.notes.push('WARNING: 403 toast still shown for operation logs');
        }
      }
    }

    await screenshot(page, 'profile');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testAdmin(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/admin', title: '系统管理',
    loadStatus: 'pass', dataStatus: 'no-table',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/admin');

    const currentUrl = page.url();
    if (currentUrl.includes('/dashboard')) {
      result.loadStatus = 'pass';
      result.notes.push('Non-admin user correctly redirected to dashboard');
    } else {
      await expectPageTitle(page, ['用户管理', '系统管理', '管理']);
      result.notes.push('WARNING: Admin page accessible with user role');
    }

    await screenshot(page, 'admin');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

async function testOperationLogs(page: Page, errors: string[]): Promise<PageResult> {
  const result: PageResult = {
    path: '/operation-logs', title: '操作日志',
    loadStatus: 'pass', dataStatus: 'empty',
    searchStatus: 'none', filterStatus: 'none', createStatus: 'none',
    consoleErrors: [], notes: [],
  };

  try {
    await waitForPageLoad(page, '/operation-logs');

    const currentUrl = page.url();
    if (currentUrl.includes('/dashboard')) {
      result.loadStatus = 'pass';
      result.notes.push('Non-admin user correctly redirected to dashboard');
    } else {
      await expectPageTitle(page, ['操作日志', '日志', '操作']);

      const table = page.locator('table, .ant-table').first();
      if (await table.isVisible().catch(() => false)) {
        const count = await page.locator('table tbody tr').count().catch(() => 0);
        result.dataStatus = count > 0 ? 'has-data' : 'empty';
      }
    }

    await screenshot(page, 'operation-logs');
  } catch (e: any) {
    result.loadStatus = 'fail'; result.notes.push(`Error: ${e.message}`);
  }
  result.consoleErrors = [...errors];
  return result;
}

/* ------------------------------------------------------------------ */
/*  Main Test Suite                                                     */
/* ------------------------------------------------------------------ */

test.describe('ERP All Pages Smoke Test', () => {
  let token: string;
  const allResults: PageResult[] = [];

  test.beforeAll(async () => {
    token = await loginViaApi();
  });

  test.afterAll(async () => {
    console.log('\n' + '='.repeat(80));
    console.log('ERP PAGE TEST SUMMARY');
    console.log('='.repeat(80));

    const passed = allResults.filter((r) => r.loadStatus === 'pass');
    const failed = allResults.filter((r) => r.loadStatus === 'fail');
    const withErrors = allResults.filter((r) => r.consoleErrors.length > 0);

    for (const r of allResults) {
      const loadIcon = r.loadStatus === 'pass' ? '✅' : '❌';
      const dataIcon = r.dataStatus === 'has-data' ? '✅' : r.dataStatus === 'empty' ? '⚠️' : r.dataStatus === 'no-table' ? '⚪' : '❌';
      const searchIcon = r.searchStatus === 'pass' ? '✅' : r.searchStatus === 'none' ? '⚪' : '❌';
      const filterIcon = r.filterStatus === 'pass' ? '✅' : r.filterStatus === 'none' ? '⚪' : '❌';
      const createIcon = r.createStatus === 'pass' ? '✅' : r.createStatus === 'none' ? '⚪' : '❌';
      const errorIcon = r.consoleErrors.length > 0 ? '❌' : '✅';

      console.log(`\n${loadIcon} ${r.path} (${r.title})`);
      console.log(`   加载: ${loadIcon} | 数据: ${dataIcon} | 搜索: ${searchIcon} | 筛选: ${filterIcon} | 新建: ${createIcon} | 控制台: ${errorIcon}`);

      if (r.consoleErrors.length > 0) {
        console.log(`   Console errors (${r.consoleErrors.length}):`);
        for (const err of r.consoleErrors.slice(0, 3)) {
          console.log(`     - ${err.substring(0, 120)}`);
        }
      }

      if (r.notes.length > 0) {
        for (const note of r.notes) {
          console.log(`   Note: ${note}`);
        }
      }
    }

    console.log('\n' + '-'.repeat(80));
    console.log(`总计页面: ${allResults.length}`);
    console.log(`正常加载: ${passed.length}`);
    console.log(`加载失败: ${failed.length}`);
    console.log(`有控制台报错: ${withErrors.length}`);

    if (failed.length > 0) {
      console.log('\n❌ 失败的页面:');
      for (const r of failed) {
        console.log(`   - ${r.path}: ${r.notes.join(', ')}`);
      }
    }

    if (withErrors.length > 0) {
      console.log('\n⚠️ 有控制台报错的页面:');
      for (const r of withErrors) {
        console.log(`   - ${r.path}: ${r.consoleErrors.length} errors`);
      }
    }

    console.log('='.repeat(80) + '\n');
  });

  const testPages = [
    { name: 'dashboard', fn: testDashboard },
    { name: 'customers', fn: testCustomers },
    { name: 'products', fn: testProducts },
    { name: 'sales-orders', fn: testSalesOrders },
    { name: 'prepayments', fn: testPrepayments },
    { name: 'approvals', fn: testApprovals },
    { name: 'reports', fn: testReports },
    { name: 'suppliers', fn: testSuppliers },
    { name: 'purchase-requests', fn: testPurchaseRequests },
    { name: 'purchase-orders', fn: testPurchaseOrders },
    { name: 'production-orders', fn: testProductionOrders },
    { name: 'boms', fn: testBoms },
    { name: 'stock-ledger', fn: testStockLedger },
    { name: 'invoices', fn: testInvoices },
    { name: 'vouchers', fn: testVouchers },
    { name: 'aging-report', fn: testAgingReport },
    { name: 'customer-statement', fn: testCustomerStatement },
    { name: 'material-categories', fn: testMaterialCategories },
    { name: 'profile', fn: testProfile },
    { name: 'admin', fn: testAdmin },
    { name: 'operation-logs', fn: testOperationLogs },
  ];

  for (const { name, fn } of testPages) {
    test(name, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await setupAuth(page, token);
      const result = await fn(page, errors);
      allResults.push(result);

      expect(result.loadStatus).toBe('pass');
    });
  }
});
