# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/suppliers-and-stock-ledger.spec.ts >> 库存流水页面 >> API 响应格式检查
- Location: e2e/suppliers-and-stock-ledger.spec.ts:102:7

# Error details

```
Error: expect(received).toHaveProperty(path)

Expected path: "data"
Received path: []

Received value: []
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
              - searchbox "搜索 SKU ID" [ref=e71]
              - button "search" [ref=e73] [cursor=pointer]:
                - img "search" [ref=e75]:
                  - img [ref=e76]
            - generic [ref=e79] [cursor=pointer]:
              - generic "更新时间" [ref=e80]:
                - text: 更新时间
                - combobox [ref=e81]
              - img "down" [ref=e83]:
                - img [ref=e84]
            - generic [ref=e87] [cursor=pointer]:
              - generic "降序" [ref=e88]:
                - text: 降序
                - combobox [ref=e89]
              - img "down" [ref=e91]:
                - img [ref=e92]
            - button "查 询" [ref=e95] [cursor=pointer]:
              - generic [ref=e96]: 查 询
            - button "重 置" [ref=e98] [cursor=pointer]:
              - generic [ref=e99]: 重 置
          - generic [ref=e104]:
            - table [ref=e106]:
              - rowgroup [ref=e112]:
                - row "SKU ID 当前数量 更新时间 操作" [ref=e113]:
                  - columnheader "SKU ID" [ref=e114]
                  - columnheader "当前数量" [ref=e115]
                  - columnheader "更新时间" [ref=e116]
                  - columnheader "操作" [ref=e117]
            - table [ref=e119]:
              - rowgroup [ref=e125]:
                - row [ref=e126]:
                  - cell [ref=e127]
                  - cell [ref=e128]
                  - cell [ref=e129]
                  - cell [ref=e130]
                - row "暂无数据 暂无数据" [ref=e131]:
                  - cell "暂无数据 暂无数据" [ref=e132]:
                    - generic [ref=e134]:
                      - img "暂无数据" [ref=e136]
                      - generic [ref=e142]: 暂无数据
  - generic [ref=e144]:
    - img "close-circle" [ref=e145]:
      - img [ref=e146]
    - generic [ref=e148]: 加载库存余额失败
```

# Test source

```ts
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
> 121 |       expect(body.data).toHaveProperty('data');
      |                         ^ Error: expect(received).toHaveProperty(path)
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
  151 |   });
  152 | });
  153 | 
```