import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNDI3ZjEzMC03NzQyLTQzMmYtYjE1ZC1lM2EyYjliOTU2ZGYiLCJ1c2VybmFtZSI6InVzZXIiLCJyb2xlIjoidXNlciIsInBlcm1pc3Npb25zIjpbIm9yZGVyOnZpZXciLCJvcmRlcjpjcmVhdGUiLCJvcmRlcjplZGl0Iiwib3JkZXI6c3VibWl0Iiwib3JkZXI6cHVzaF9qc3QiLCJvcmRlcjpjb2xsZWN0IiwiY3VzdG9tZXI6dmlldyIsImN1c3RvbWVyOmNyZWF0ZSIsImN1c3RvbWVyOmVkaXQiLCJjdXN0b21lcjpkZWxldGUiLCJwcm9kdWN0OnZpZXciLCJwcm9kdWN0OmNyZWF0ZSIsInByb2R1Y3Q6ZWRpdCIsInByZXBheW1lbnQ6dmlldyIsInByZXBheW1lbnQ6Y3JlYXRlIiwiYXBwcm92YWw6dmlldyIsImFwcHJvdmFsOmhhbmRsZSIsInJlcG9ydDp2aWV3Iiwic3RvY2s6dmlldyIsInN0b2NrOmVkaXRfc2FmZXR5IiwiYm9tOnZpZXciLCJib206Y3JlYXRlIiwiYm9tOmVkaXQiLCJib206ZGVsZXRlIl0sInRlbmFudElkIjpudWxsLCJpYXQiOjE3Nzk4NzE1NTMsImV4cCI6MTc4MDQ3NjM1M30.hs_ILRCkp34MMDk8d_Zk_3GBImIgTC2LwxZvyO3amxw';

async function loginWithToken(page: any) {
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate((token: string) => {
    localStorage.setItem('erp_token', token);
    localStorage.setItem('erp_username', 'user');
    localStorage.setItem('erp_role', 'user');
    localStorage.setItem('erp_permissions', JSON.stringify([
      'order:view','order:create','order:edit','order:submit','order:push_jst','order:collect',
      'customer:view','customer:create','customer:edit','customer:delete',
      'product:view','product:create','product:edit',
      'prepayment:view','prepayment:create',
      'approval:view','approval:handle',
      'report:view','stock:view','stock:edit_safety',
      'bom:view','bom:create','bom:edit','bom:delete'
    ]));
  }, AUTH_TOKEN);
}

test.describe('供应商管理页面', () => {
  test('页面加载和菜单可见性', async ({ page }) => {
    await loginWithToken(page);
    await page.goto(`${BASE_URL}/suppliers`);
    await page.waitForLoadState('networkidle');

    // 检查页面标题
    await expect(page.locator('text=供应商管理').first()).toBeVisible();

    // 检查表格是否存在
    await expect(page.locator('.ant-table').first()).toBeVisible();
  });

  test('API 响应格式检查', async ({ page }) => {
    await loginWithToken(page);

    // 先拦截请求
    const apiPromise = page.waitForResponse(
      (resp: any) => resp.url().includes('/api/v1/suppliers'),
      { timeout: 15000 }
    );

    await page.goto(`${BASE_URL}/suppliers`);
    await page.waitForLoadState('networkidle');

    const response = await apiPromise;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('code');
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('message');

    if (body.code === 0 && body.data) {
      expect(body.data).toHaveProperty('data');
      expect(body.data).toHaveProperty('total');
      expect(body.data).toHaveProperty('page');
      expect(body.data).toHaveProperty('pageSize');
    }
  });

  test('搜索和筛选功能', async ({ page }) => {
    await loginWithToken(page);
    await page.goto(`${BASE_URL}/suppliers`);
    await page.waitForLoadState('networkidle');

    // 等待表格加载
    await page.waitForSelector('.ant-table', { timeout: 15000 });

    // 检查搜索框是否存在并测试
    const searchInput = page.locator('input[placeholder*="搜索"], .ant-input-search input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('测试');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // 检查状态筛选
    const statusSelect = page.locator('.ant-select').first();
    if (await statusSelect.isVisible().catch(() => false)) {
      await statusSelect.click();
      await page.click('.ant-select-item:has-text("全部")');
    }
  });
});

test.describe('库存流水页面', () => {
  test('页面加载和菜单可见性', async ({ page }) => {
    await loginWithToken(page);
    await page.goto(`${BASE_URL}/stock-ledger`);
    await page.waitForLoadState('networkidle');

    // 检查页面标题
    await expect(page.locator('text=库存流水').first()).toBeVisible();

    // 检查表格是否存在
    await expect(page.locator('.ant-table').first()).toBeVisible();
  });

  test('API 响应格式检查', async ({ page }) => {
    await loginWithToken(page);

    const apiPromise = page.waitForResponse(
      (resp: any) => resp.url().includes('/api/v1/stocks/local-balances'),
      { timeout: 15000 }
    );

    await page.goto(`${BASE_URL}/stock-ledger`);
    await page.waitForLoadState('networkidle');

    const response = await apiPromise;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('code');
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('message');

    if (body.code === 0 && body.data) {
      expect(body.data).toHaveProperty('data');
      expect(body.data).toHaveProperty('total');
      expect(body.data).toHaveProperty('page');
      expect(body.data).toHaveProperty('pageSize');
    }
  });

  test('筛选和排序功能', async ({ page }) => {
    await loginWithToken(page);
    await page.goto(`${BASE_URL}/stock-ledger`);
    await page.waitForLoadState('networkidle');

    // 等待表格加载
    await page.waitForSelector('.ant-table', { timeout: 15000 });

    // 检查搜索框
    const searchInput = page.locator('input[placeholder*="SKU"], input[placeholder*="搜索"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test');
      await page.click('button:has-text("查询")');
      await page.waitForTimeout(1000);
    }

    // 检查排序选择器
    const sortSelect = page.locator('.ant-select').first();
    if (await sortSelect.isVisible().catch(() => false)) {
      await sortSelect.click();
      await page.click('.ant-select-item:has-text("当前数量")');
      await page.waitForTimeout(1000);
    }
  });
});
