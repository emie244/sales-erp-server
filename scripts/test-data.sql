-- 查询现有数据用于参考
SELECT 'SUPPLIERS' as section;
SELECT id, name FROM suppliers LIMIT 5;

SELECT 'SKUS' as section;
SELECT id, "skuCode", "skuName", jst_sku_id, product_id FROM product_skus LIMIT 10;

SELECT 'BOMS' as section;
SELECT id, sku_id, version FROM bom_headers WHERE "isActive" = true LIMIT 10;

SELECT 'PRODUCTS' as section;
SELECT id, name FROM products LIMIT 10;
