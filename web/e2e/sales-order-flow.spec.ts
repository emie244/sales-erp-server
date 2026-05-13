import { test, expect } from '@playwright/test';

function createToken(role: string, permissions: string[]): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-1', role, permissions }));
  return `${header}.${payload}.`;
}

async function setupAuth(
  page: any,
  permissions: string[] = ['order:view', 'order:create', 'customer:view'],
) {
  const token = createToken('user', permissions);
  await page.goto('/login');
  await page.evaluate(
    ({ t, perms }: { t: string; perms: string[] }) => {
      localStorage.setItem('erp_token', t);
      localStorage.setItem('erp_role', 'user');
      localStorage.setItem('erp_permissions', JSON.stringify(perms));
    },
    { t: token, perms: permissions },
  );
}

test.describe('Sales Order Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/sales-orders') && !url.includes('/sales-orders/')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            code: 0,
            data: {
              data: [
                {
                  id: 'order-1',
                  status: 'draft',
                  totalAmount: 1000,
                  payAmount: 1000,
                  customer: { name: 'Test Customer' },
                  items: [
                    { productName: 'Product A', qty: 1, unitPrice: 1000 },
                  ],
                  createdAt: new Date().toISOString(),
                },
              ],
              total: 1,
              page: 1,
              pageSize: 20,
            },
            message: '',
          }),
        });
        return;
      }

      if (url.includes('/users/profile')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            code: 0,
            data: { id: 'user-1', name: 'Test User', feishuUserId: 'feishu-1' },
            message: '',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        body: JSON.stringify({ code: 0, data: [], message: '' }),
      });
    });
  });

  test('navigates to sales orders page and shows order list', async ({
    page,
  }) => {
    await setupAuth(page);
    await page.goto('/sales-orders');

    await expect(page.getByRole('main').getByText('销售订单')).toBeVisible();
    await expect(page.getByText('Test Customer')).toBeVisible();
    await expect(page.getByText('草稿')).toBeVisible();
  });

  test('filters orders by status', async ({ page }) => {
    await setupAuth(page);
    await page.goto('/sales-orders');

    await expect(page.getByText('Test Customer')).toBeVisible();

    const statusSelect = page.locator('.ant-select').first();
    await statusSelect.click();
    await page.locator('.ant-select-dropdown').getByText('草稿').click();

    await expect(page.getByText('Test Customer')).toBeVisible();
  });
});
