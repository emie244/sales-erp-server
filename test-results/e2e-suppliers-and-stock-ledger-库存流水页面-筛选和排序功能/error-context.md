# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/suppliers-and-stock-ledger.spec.ts >> 库存流水页面 >> 筛选和排序功能
- Location: e2e/suppliers-and-stock-ledger.spec.ts:128:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('button:has-text("查询")')

```

# Page snapshot

```yaml
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
            - listitem [ref=e53]: 库存流水
      - generic [ref=e54] [cursor=pointer]:
        - generic [ref=e57]: U
        - generic [ref=e58]: user
        - img "down" [ref=e60]:
          - img [ref=e61]
    - main [ref=e63]:
      - generic [ref=e64]:
        - generic [ref=e66]: 库存流水
        - generic [ref=e67]:
          - generic [ref=e69]:
            - generic [ref=e70]:
              - searchbox "搜索 SKU ID" [active] [ref=e71]: test
              - button "close-circle" [ref=e73] [cursor=pointer]:
                - img "close-circle" [ref=e74]:
                  - img [ref=e75]
            - button "search" [ref=e77] [cursor=pointer]:
              - img "search" [ref=e79]:
                - img [ref=e80]
          - generic [ref=e83] [cursor=pointer]:
            - generic "更新时间" [ref=e84]:
              - text: 更新时间
              - combobox [ref=e85]
            - img "down" [ref=e87]:
              - img [ref=e88]
          - generic [ref=e91] [cursor=pointer]:
            - generic "降序" [ref=e92]:
              - text: 降序
              - combobox [ref=e93]
            - img "down" [ref=e95]:
              - img [ref=e96]
          - button "查 询" [ref=e99] [cursor=pointer]:
            - generic [ref=e100]: 查 询
          - button "重 置" [ref=e102] [cursor=pointer]:
            - generic [ref=e103]: 重 置
        - generic [ref=e108]:
          - table [ref=e110]:
            - rowgroup [ref=e116]:
              - row "SKU ID 当前数量 更新时间 操作" [ref=e117]:
                - columnheader "SKU ID" [ref=e118]
                - columnheader "当前数量" [ref=e119]
                - columnheader "更新时间" [ref=e120]
                - columnheader "操作" [ref=e121]
          - table [ref=e123]:
            - rowgroup [ref=e129]:
              - row [ref=e130]:
                - cell [ref=e131]
                - cell [ref=e132]
                - cell [ref=e133]
                - cell [ref=e134]
              - row "暂无数据 暂无数据" [ref=e135]:
                - cell "暂无数据 暂无数据" [ref=e136]:
                  - generic [ref=e138]:
                    - img "暂无数据" [ref=e140]
                    - generic [ref=e146]: 暂无数据
```

# Test source

```ts
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
  50  |     expect(response.status()).toBe(200);
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
> 140 |       await page.click('button:has-text("查询")');
      |                  ^ Error: page.click: Test timeout of 60000ms exceeded.
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
  151 |   });
  152 | });
  153 | 
```