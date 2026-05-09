import { test, expect } from '@playwright/test';

function createToken(role: string, permissions: string[]): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-1', role, permissions }));
  return `${header}.${payload}.`;
}

test.describe('Login page', () => {
  test('shows Feishu login button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('飞书扫码登录')).toBeVisible();
    await expect(page.getByText('Sales ERP')).toBeVisible();
  });
});

test.describe('Authenticated routes', () => {
  test.beforeEach(async ({ page }) => {
    const token = createToken('user', ['order:view', 'customer:view']);
    await page.goto('/login');
    await page.evaluate(
      (t) => {
        localStorage.setItem('erp_token', t);
        localStorage.setItem('erp_role', 'user');
        localStorage.setItem(
          'erp_permissions',
          JSON.stringify(['order:view', 'customer:view']),
        );
      },
      token,
    );
  });

  test('redirects to dashboard from root', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('dashboard loads with layout', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: '仪表盘' })).toBeVisible();
    await expect(page.getByText('Sales ERP')).toBeVisible();
  });

  test('sales orders page loads when accessed directly', async ({ page }) => {
    await page.goto('/sales-orders');
    await expect(page.getByRole('link', { name: '销售订单' })).toBeVisible();
  });
});

test.describe('Admin route guard', () => {
  test('blocks non-admin users from admin page', async ({ page }) => {
    const token = createToken('user', ['order:view']);
    await page.goto('/login');
    await page.evaluate(
      (t) => {
        localStorage.setItem('erp_token', t);
        localStorage.setItem('erp_role', 'user');
        localStorage.setItem('erp_permissions', JSON.stringify(['order:view']));
      },
      token,
    );

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
