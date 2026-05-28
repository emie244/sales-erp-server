# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/suppliers-and-stock-ledger.spec.ts >> 供应商管理页面 >> API 响应格式检查
- Location: e2e/suppliers-and-stock-ledger.spec.ts:37:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 403
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]: Sales ERP
        - menu [ref=e8]:
          - menuitem "dashboard 业务概览" [ref=e9] [cursor=pointer]:
            - img "dashboard" [ref=e10]:
              - img [ref=e11]
            - generic [ref=e13]: 业务概览
          - menuitem "shopping-cart 销售管理" [ref=e14] [cursor=pointer]:
            - img "shopping-cart" [ref=e15]:
              - img [ref=e16]
            - generic [ref=e18]: 销售管理
          - menuitem "appstore 供应链" [ref=e19] [cursor=pointer]:
            - img "appstore" [ref=e20]:
              - img [ref=e21]
            - generic [ref=e23]: 供应链
          - menuitem "build 生产库存" [ref=e24] [cursor=pointer]:
            - img "build" [ref=e25]:
              - img [ref=e26]
            - generic [ref=e28]: 生产库存
          - menuitem "file-done 财务" [ref=e29] [cursor=pointer]:
            - img "file-done" [ref=e30]:
              - img [ref=e31]
            - generic [ref=e33]: 财务
          - menuitem "file-text 审批与报表" [ref=e34] [cursor=pointer]:
            - img "file-text" [ref=e35]:
              - img [ref=e36]
            - generic [ref=e38]: 审批与报表
    - generic [ref=e39]:
      - banner [ref=e40]:
        - generic [ref=e41]:
          - button "menu-fold" [ref=e43] [cursor=pointer]:
            - img "menu-fold" [ref=e45]:
              - img [ref=e46]
          - navigation [ref=e49]:
            - list [ref=e50]:
              - listitem [ref=e51]: 首页
              - listitem [ref=e52]: /
              - listitem
        - generic [ref=e53] [cursor=pointer]:
          - generic [ref=e56]: U
          - generic [ref=e57]: user
          - img "down" [ref=e59]:
            - img [ref=e60]
      - main [ref=e62]:
        - generic [ref=e63]:
          - generic [ref=e64]:
            - generic [ref=e65]: 供应商管理
            - generic [ref=e68]:
              - generic [ref=e70]:
                - generic [ref=e71]:
                  - img "search" [ref=e73]:
                    - img [ref=e74]
                  - searchbox "搜索名称/联系人/电话" [ref=e76]
                - button "search" [ref=e78] [cursor=pointer]:
                  - img "search" [ref=e80]:
                    - img [ref=e81]
              - generic [ref=e84] [cursor=pointer]:
                - generic [ref=e85]:
                  - generic: 状态筛选
                  - combobox [ref=e86]
                - img "down" [ref=e88]:
                  - img [ref=e89]
              - generic [ref=e92] [cursor=pointer]:
                - generic "创建时间 ↓" [ref=e93]:
                  - text: 创建时间 ↓
                  - combobox [ref=e94]
                - img "down" [ref=e96]:
                  - img [ref=e97]
              - button "plus 新建供应商" [ref=e100] [cursor=pointer]:
                - img "plus" [ref=e102]:
                  - img [ref=e103]
                - generic [ref=e106]: 新建供应商
          - generic [ref=e111]:
            - table [ref=e113]:
              - rowgroup [ref=e122]:
                - row "名称 联系人 电话 邮箱 地址 状态 操作" [ref=e123]:
                  - columnheader "名称" [ref=e124]
                  - columnheader "联系人" [ref=e125]
                  - columnheader "电话" [ref=e126]
                  - columnheader "邮箱" [ref=e127]
                  - columnheader "地址" [ref=e128]
                  - columnheader "状态" [ref=e129]
                  - columnheader "操作" [ref=e130]
            - table [ref=e132]:
              - rowgroup [ref=e141]:
                - row [ref=e142]:
                  - cell [ref=e143]
                  - cell [ref=e144]
                  - cell [ref=e145]
                  - cell [ref=e146]
                  - cell [ref=e147]
                  - cell [ref=e148]
                  - cell [ref=e149]
                - row "暂无数据 暂无数据" [ref=e150]:
                  - cell "暂无数据 暂无数据" [ref=e151]:
                    - generic [ref=e153]:
                      - img "暂无数据" [ref=e155]
                      - generic [ref=e161]: 暂无数据
  - generic:
    - generic [ref=e163]:
      - img "close-circle" [ref=e164]:
        - img [ref=e165]
      - generic [ref=e167]: 权限不足，请联系管理员
    - generic [ref=e169]:
      - img "close-circle" [ref=e170]:
        - img [ref=e171]
      - generic [ref=e173]: 加载供应商列表失败
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const BASE_URL = 'http://localhost:3000';
  4   | const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNDI3ZjEzMC03NzQyLTQzMmYtYjE1ZC1lM2EyYjliOTU2ZGYiLCJ1c2VybmFtZSI6InVzZXIiLCJyb2xlIjoidXNlciIsInBlcm1pc3Npb25zIjpbIm9yZGVyOnZpZXciLCJvcmRlcjpjcmVhdGUiLCJvcmRlcjplZGl0Iiwib3JkZXI6c3VibWl0Iiwib3JkZXI6cHVzaF9qc3QiLCJvcmRlcjpjb2xsZWN0IiwiY3VzdG9tZXI6dmlldyIsImN1c3RvbWVyOmNyZWF0ZSIsImN1c3RvbWVyOmVkaXQiLCJjdXN0b21lcjpkZWxldGUiLCJwcm9kdWN0OnZpZXciLCJwcm9kdWN0OmNyZWF0ZSIsInByb2R1Y3Q6ZWRpdCIsInByZXBheW1lbnQ6dmlldyIsInByZXBheW1lbnQ6Y3JlYXRlIiwiYXBwcm92YWw6dmlldyIsImFwcHJvdmFsOmhhbmRsZSIsInJlcG9ydDp2aWV3Iiwic3RvY2s6dmlldyIsInN0b2NrOmVkaXRfc2FmZXR5IiwiYm9tOnZpZXciLCJib206Y3JlYXRlIiwiYm9tOmVkaXQiLCJib206ZGVsZXRlIl0sInRlbmFudElkIjpudWxsLCJpYXQiOjE3Nzk4NzE1NTMsImV4cCI6MTc4MDQ3NjM1M30.hs_ILRCkp34MMDk8d_Zk_3GBImIgTC2LwxZvyO3amxw';
  5   | 
  6   | async function loginWithToken(page: any) {
  7   |   await page.goto(`${BASE_URL}/login`);
  8   |   await page.evaluate((token: string) => {
  9   |     localStorage.setItem('erp_token', token);
  10  |     localStorage.setItem('erp_username', 'user');
  11  |     localStorage.setItem('erp_role', 'user');
  12  |     localStorage.setItem('erp_permissions', JSON.stringify([
  13  |       'order:view','order:create','order:edit','order:submit','order:push_jst','order:collect',
  14  |       'customer:view','customer:create','customer:edit','customer:delete',
  15  |       'product:view','product:create','product:edit',
  16  |       'prepayment:view','prepayment:create',
  17  |       'approval:view','approval:handle',
  18  |       'report:view','stock:view','stock:edit_safety',
  19  |       'bom:view','bom:create','bom:edit','bom:delete'
  20  |     ]));
  21  |   }, AUTH_TOKEN);
  22  | }
  23  | 
  24  | test.describe('供应商管理页面', () => {
  25  |   test('页面加载和菜单可见性', async ({ page }) => {
  26  |     await loginWithToken(page);
  27  |     await page.goto(`${BASE_URL}/suppliers`);
  28  |     await page.waitForLoadState('networkidle');
  29  | 
  30  |     // 检查页面标题
  31  |     await expect(page.locator('text=供应商管理').first()).toBeVisible();
  32  | 
  33  |     // 检查表格是否存在
  34  |     await expect(page.locator('.ant-table').first()).toBeVisible();
  35  |   });
  36  | 
  37  |   test('API 响应格式检查', async ({ page }) => {
  38  |     await loginWithToken(page);
  39  | 
  40  |     // 先拦截请求
  41  |     const apiPromise = page.waitForResponse(
  42  |       (resp: any) => resp.url().includes('/api/v1/suppliers'),
  43  |       { timeout: 15000 }
  44  |     );
  45  | 
  46  |     await page.goto(`${BASE_URL}/suppliers`);
  47  |     await page.waitForLoadState('networkidle');
  48  | 
  49  |     const response = await apiPromise;
> 50  |     expect(response.status()).toBe(200);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  51  |     const body = await response.json();
  52  |     expect(body).toHaveProperty('code');
  53  |     expect(body).toHaveProperty('data');
  54  |     expect(body).toHaveProperty('message');
  55  | 
  56  |     if (body.code === 0 && body.data) {
  57  |       expect(body.data).toHaveProperty('data');
  58  |       expect(body.data).toHaveProperty('total');
  59  |       expect(body.data).toHaveProperty('page');
  60  |       expect(body.data).toHaveProperty('pageSize');
  61  |     }
  62  |   });
  63  | 
  64  |   test('搜索和筛选功能', async ({ page }) => {
  65  |     await loginWithToken(page);
  66  |     await page.goto(`${BASE_URL}/suppliers`);
  67  |     await page.waitForLoadState('networkidle');
  68  | 
  69  |     // 等待表格加载
  70  |     await page.waitForSelector('.ant-table', { timeout: 15000 });
  71  | 
  72  |     // 检查搜索框是否存在并测试
  73  |     const searchInput = page.locator('input[placeholder*="搜索"], .ant-input-search input').first();
  74  |     if (await searchInput.isVisible().catch(() => false)) {
  75  |       await searchInput.fill('测试');
  76  |       await page.keyboard.press('Enter');
  77  |       await page.waitForTimeout(1000);
  78  |     }
  79  | 
  80  |     // 检查状态筛选
  81  |     const statusSelect = page.locator('.ant-select').first();
  82  |     if (await statusSelect.isVisible().catch(() => false)) {
  83  |       await statusSelect.click();
  84  |       await page.click('.ant-select-item:has-text("全部")');
  85  |     }
  86  |   });
  87  | });
  88  | 
  89  | test.describe('库存流水页面', () => {
  90  |   test('页面加载和菜单可见性', async ({ page }) => {
  91  |     await loginWithToken(page);
  92  |     await page.goto(`${BASE_URL}/stock-ledger`);
  93  |     await page.waitForLoadState('networkidle');
  94  | 
  95  |     // 检查页面标题
  96  |     await expect(page.locator('text=库存流水').first()).toBeVisible();
  97  | 
  98  |     // 检查表格是否存在
  99  |     await expect(page.locator('.ant-table').first()).toBeVisible();
  100 |   });
  101 | 
  102 |   test('API 响应格式检查', async ({ page }) => {
  103 |     await loginWithToken(page);
  104 | 
  105 |     const apiPromise = page.waitForResponse(
  106 |       (resp: any) => resp.url().includes('/api/v1/stocks/local-balances'),
  107 |       { timeout: 15000 }
  108 |     );
  109 | 
  110 |     await page.goto(`${BASE_URL}/stock-ledger`);
  111 |     await page.waitForLoadState('networkidle');
  112 | 
  113 |     const response = await apiPromise;
  114 |     expect(response.status()).toBe(200);
  115 |     const body = await response.json();
  116 |     expect(body).toHaveProperty('code');
  117 |     expect(body).toHaveProperty('data');
  118 |     expect(body).toHaveProperty('message');
  119 | 
  120 |     if (body.code === 0 && body.data) {
  121 |       expect(body.data).toHaveProperty('data');
  122 |       expect(body.data).toHaveProperty('total');
  123 |       expect(body.data).toHaveProperty('page');
  124 |       expect(body.data).toHaveProperty('pageSize');
  125 |     }
  126 |   });
  127 | 
  128 |   test('筛选和排序功能', async ({ page }) => {
  129 |     await loginWithToken(page);
  130 |     await page.goto(`${BASE_URL}/stock-ledger`);
  131 |     await page.waitForLoadState('networkidle');
  132 | 
  133 |     // 等待表格加载
  134 |     await page.waitForSelector('.ant-table', { timeout: 15000 });
  135 | 
  136 |     // 检查搜索框
  137 |     const searchInput = page.locator('input[placeholder*="SKU"], input[placeholder*="搜索"]').first();
  138 |     if (await searchInput.isVisible().catch(() => false)) {
  139 |       await searchInput.fill('test');
  140 |       await page.click('button:has-text("查询")');
  141 |       await page.waitForTimeout(1000);
  142 |     }
  143 | 
  144 |     // 检查排序选择器
  145 |     const sortSelect = page.locator('.ant-select').first();
  146 |     if (await sortSelect.isVisible().catch(() => false)) {
  147 |       await sortSelect.click();
  148 |       await page.click('.ant-select-item:has-text("当前数量")');
  149 |       await page.waitForTimeout(1000);
  150 |     }
```