-- ============================================================
-- 测试数据插入脚本：供应商、采购单、加工单
-- ============================================================

-- 清理之前可能插入的测试数据（按订单号匹配）
DELETE FROM purchase_order_items WHERE purchase_order_id IN (
  SELECT id FROM purchase_orders WHERE order_no LIKE 'CG-20260509-%'
);
DELETE FROM purchase_orders WHERE order_no LIKE 'CG-20260509-%';

DELETE FROM production_order_items WHERE production_order_id IN (
  SELECT id FROM production_orders WHERE order_no LIKE 'SC-20260509-%'
);
DELETE FROM production_orders WHERE order_no LIKE 'SC-20260509-%';

DELETE FROM suppliers WHERE name IN ('深圳市亿觅科技有限公司', '东莞佳美包装制品厂', '苏州芯联电子有限公司');

-- 1) 插入测试供应商
INSERT INTO suppliers (id, name, contact_name, phone, email, address, remark, is_active, created_at, updated_at)
VALUES
  ('a1111111-1111-1111-1111-111111111111', '深圳市亿觅科技有限公司', '张经理', '13800138001', 'zhang@emie.com', '深圳市南山区科技园', '主要原材料供应商', true, now(), now()),
  ('a2222222-2222-2222-2222-222222222222', '东莞佳美包装制品厂', '李主管', '13900139002', 'li@jiamei.com', '东莞市厚街镇', '包装材料供应商', true, now(), now()),
  ('a3333333-3333-3333-3333-333333333333', '苏州芯联电子有限公司', '王采购', '13700137003', 'wang@xinlian.com', '苏州市工业园区', '电子元器件供应商', true, now(), now());

-- 2) 插入测试采购单
DO $$
DECLARE
  v_sku_id_1 varchar := '6955631313156';
  v_sku_id_2 varchar := '6955631313163';
  v_sku_id_3 varchar := '6955631313712';
  v_sku_id_4 varchar := '6955631313729';
  v_supplier_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_po_id_1 uuid := 'b1111111-1111-1111-1111-111111111111';
  v_po_id_2 uuid := 'b2222222-2222-2222-2222-222222222222';
  v_po_id_3 uuid := 'b3333333-3333-3333-3333-333333333333';
BEGIN
  -- 采购单 1: 草稿状态
  INSERT INTO purchase_orders (id, order_no, supplier_id, supplier_name, status, total_amount, remark, created_at, updated_at)
  VALUES (v_po_id_1, 'CG-20260509-001', v_supplier_id, '深圳市亿觅科技有限公司', 'draft', 12500.00, '测试采购单-草稿', now(), now());

  INSERT INTO purchase_order_items (id, purchase_order_id, sku_id, sku_code, sku_name, qty, received_qty, unit_price, line_amount, remark, created_at, updated_at)
  VALUES
    ('c1111111-1111-1111-1111-111111111111', v_po_id_1, v_sku_id_1, v_sku_id_1, '测试商品A', 100, 0, 50.00, 5000.00, '首批采购', now(), now()),
    ('c2222222-2222-2222-2222-222222222222', v_po_id_1, v_sku_id_2, v_sku_id_2, '测试商品B', 150, 0, 50.00, 7500.00, '首批采购', now(), now());

  -- 采购单 2: 已审批状态
  INSERT INTO purchase_orders (id, order_no, supplier_id, supplier_name, status, total_amount, remark, created_at, updated_at)
  VALUES (v_po_id_2, 'CG-20260509-002', v_supplier_id, '深圳市亿觅科技有限公司', 'approved', 8000.00, '测试采购单-已审批', now(), now());

  INSERT INTO purchase_order_items (id, purchase_order_id, sku_id, sku_code, sku_name, qty, received_qty, unit_price, line_amount, remark, created_at, updated_at)
  VALUES
    ('c3333333-3333-3333-3333-333333333333', v_po_id_2, v_sku_id_3, v_sku_id_3, '测试商品C', 80, 0, 60.00, 4800.00, '加急采购', now(), now()),
    ('c4444444-4444-4444-4444-444444444444', v_po_id_2, v_sku_id_4, v_sku_id_4, '测试商品D', 40, 0, 80.00, 3200.00, '加急采购', now(), now());

  -- 采购单 3: 部分到货状态
  INSERT INTO purchase_orders (id, order_no, supplier_id, supplier_name, status, total_amount, remark, created_at, updated_at)
  VALUES (v_po_id_3, 'CG-20260509-003', v_supplier_id, '深圳市亿觅科技有限公司', 'partial_received', 15000.00, '测试采购单-部分到货', now(), now());

  INSERT INTO purchase_order_items (id, purchase_order_id, sku_id, sku_code, sku_name, qty, received_qty, unit_price, line_amount, remark, created_at, updated_at)
  VALUES
    ('c5555555-5555-5555-5555-555555555555', v_po_id_3, v_sku_id_1, v_sku_id_1, '测试商品A', 200, 50, 50.00, 10000.00, '分批到货', now(), now()),
    ('c6666666-6666-6666-6666-666666666666', v_po_id_3, v_sku_id_3, v_sku_id_3, '测试商品C', 100, 20, 50.00, 5000.00, '分批到货', now(), now());

END $$;

-- 3) 插入测试加工单
DO $$
DECLARE
  v_bom_id_1 uuid;
  v_bom_id_2 uuid;
  v_bom_sku_1 varchar;
  v_bom_sku_2 varchar;
  v_pro_id_1 uuid := 'd1111111-1111-1111-1111-111111111111';
  v_pro_id_2 uuid := 'd2222222-2222-2222-2222-222222222222';
BEGIN
  -- 获取两个现有 BOM
  SELECT id, sku_id INTO v_bom_id_1, v_bom_sku_1 FROM bom_headers WHERE "isActive" = true ORDER BY created_at DESC LIMIT 1 OFFSET 0;
  SELECT id, sku_id INTO v_bom_id_2, v_bom_sku_2 FROM bom_headers WHERE "isActive" = true ORDER BY created_at DESC LIMIT 1 OFFSET 1;

  -- 加工单 1: 待处理状态
  INSERT INTO production_orders (id, order_no, bom_id, sku_id, sku_name, qty, status, remark, created_at, updated_at)
  VALUES (v_pro_id_1, 'SC-20260509-001', v_bom_id_1, v_bom_sku_1, '测试成品A', 100, 'pending', '测试加工单-待处理', now(), now());

  INSERT INTO production_order_items (id, production_order_id, material_sku_id, material_sku_name, required_qty, actual_qty, remark, created_at, updated_at)
  SELECT gen_random_uuid(), v_pro_id_1, bi.material_sku_id, '原材料-' || bi.material_sku_id,
         bi.qty * 100 * (1 + COALESCE(bi.loss_rate, 0) / 100), 0, 'BOM计算用量', now(), now()
  FROM bom_items bi
  WHERE bi.bom_header_id = v_bom_id_1;

  -- 加工单 2: 加工中状态
  INSERT INTO production_orders (id, order_no, bom_id, sku_id, sku_name, qty, status, remark, created_at, updated_at)
  VALUES (v_pro_id_2, 'SC-20260509-002', v_bom_id_2, v_bom_sku_2, '测试成品B', 50, 'processing', '测试加工单-加工中', now(), now());

  INSERT INTO production_order_items (id, production_order_id, material_sku_id, material_sku_name, required_qty, actual_qty, remark, created_at, updated_at)
  SELECT gen_random_uuid(), v_pro_id_2, bi.material_sku_id, '原材料-' || bi.material_sku_id,
         bi.qty * 50 * (1 + COALESCE(bi.loss_rate, 0) / 100), 0, 'BOM计算用量', now(), now()
  FROM bom_items bi
  WHERE bi.bom_header_id = v_bom_id_2;

END $$;

-- 验证插入结果
SELECT '=== 供应商 ===' as section;
SELECT id, name, contact_name, phone FROM suppliers WHERE name IN ('深圳市亿觅科技有限公司', '东莞佳美包装制品厂', '苏州芯联电子有限公司');

SELECT '=== 采购单 ===' as section;
SELECT order_no, status, total_amount, supplier_name FROM purchase_orders WHERE order_no LIKE 'CG-20260509-%' ORDER BY order_no;

SELECT '=== 采购明细 ===' as section;
SELECT po.order_no, poi.sku_id, poi.sku_name, poi.qty, poi.received_qty, poi.unit_price, poi.line_amount
FROM purchase_order_items poi
JOIN purchase_orders po ON po.id = poi.purchase_order_id
WHERE po.order_no LIKE 'CG-20260509-%'
ORDER BY po.order_no;

SELECT '=== 加工单 ===' as section;
SELECT order_no, status, qty, sku_name FROM production_orders WHERE order_no LIKE 'SC-20260509-%' ORDER BY order_no;

SELECT '=== 加工明细 ===' as section;
SELECT pro.order_no, proi.material_sku_id, proi.required_qty, proi.actual_qty
FROM production_order_items proi
JOIN production_orders pro ON pro.id = proi.production_order_id
WHERE pro.order_no LIKE 'SC-20260509-%'
ORDER BY pro.order_no, proi.material_sku_id;
