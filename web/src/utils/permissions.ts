/**
 * 权限检查工具函数
 */
export function hasPermission(permission: string): boolean {
  const permissions = getUserPermissions();

  // 管理员拥有所有权限
  if (permissions.includes('*')) return true;

  return permissions.includes(permission);
}

/**
 * 检查当前用户是否拥有指定权限列表中的任意一个
 * @param permissions 权限点列表
 * @returns boolean
 */
export function hasAnyPermission(...permissions: string[]): boolean {
  return permissions.some((p) => hasPermission(p));
}

/**
 * 获取当前用户的权限列表
 * @returns string[]
 */
export function getUserPermissions(): string[] {
  try {
    const perms = localStorage.getItem('erp_permissions');
    if (perms) {
      const parsed = JSON.parse(perms);
      if (parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }

  // 兼容旧数据：若 localStorage 中无权限但角色为 admin，返回通配符
  const role = localStorage.getItem('erp_role');
  if (role === 'admin') {
    return ['*'];
  }

  return [];
}

/**
 * 保存用户权限到 localStorage
 * @param permissions 权限列表
 */
export function setUserPermissions(permissions: string[]): void {
  localStorage.setItem('erp_permissions', JSON.stringify(permissions));
}

/**
 * 清除用户权限
 */
export function clearUserPermissions(): void {
  localStorage.removeItem('erp_permissions');
}

/**
 * 获取默认权限列表（普通用户）
 * @returns string[]
 */
export function getDefaultPermissions(): string[] {
  return [
    'order:view',
    'order:create',
    'order:edit',
    'order:submit',
    'order:push_jst',
    'order:collect',
    'customer:view',
    'customer:create',
    'customer:edit',
    'product:view',
    'product:create',
    'product:edit',
    'prepayment:view',
    'prepayment:create',
    'prepayment:edit',
    'approval:view',
    'approval:handle',
    'report:view',
    'stock:view',
    'bom:view',
    'supplier:view',
    'purchase_order:view',
    'production_order:view',
    'material_category:view',
  ];
}

/**
 * 获取所有权限列表（用于权限配置界面）
 */
export function getAllPermissions() {
  return [
    {
      module: '销售订单',
      permissions: [
        { key: 'order:view', label: '查看订单' },
        { key: 'order:create', label: '创建订单' },
        { key: 'order:edit', label: '编辑订单' },
        { key: 'order:submit', label: '提交审批' },
        { key: 'order:push_jst', label: '推送聚水潭' },
        { key: 'order:collect', label: '登记回款' },
      ],
    },
    {
      module: '客户管理',
      permissions: [
        { key: 'customer:view', label: '查看客户' },
        { key: 'customer:create', label: '创建客户' },
        { key: 'customer:edit', label: '编辑客户' },
        { key: 'customer:delete', label: '删除客户' },
      ],
    },
    {
      module: '产品管理',
      permissions: [
        { key: 'product:view', label: '查看产品' },
        { key: 'product:create', label: '创建产品' },
        { key: 'product:edit', label: '编辑产品' },
      ],
    },
    {
      module: '预付款管理',
      permissions: [
        { key: 'prepayment:view', label: '查看预付款' },
        { key: 'prepayment:create', label: '创建预付款' },
        { key: 'prepayment:edit', label: '编辑预付款' },
      ],
    },
    {
      module: '审批中心',
      permissions: [
        { key: 'approval:view', label: '查看审批' },
        { key: 'approval:handle', label: '处理审批' },
      ],
    },
    {
      module: '报表分析',
      permissions: [{ key: 'report:view', label: '查看报表' }],
    },
    {
      module: '库存管理',
      permissions: [
        { key: 'stock:view', label: '查看库存' },
        { key: 'stock:edit_safety', label: '设置安全库存' },
      ],
    },
    {
      module: 'BOM 管理',
      permissions: [
        { key: 'bom:view', label: '查看 BOM' },
        { key: 'bom:create', label: '创建 BOM' },
        { key: 'bom:edit', label: '编辑 BOM' },
        { key: 'bom:delete', label: '删除 BOM' },
      ],
    },
    {
      module: '供应商管理',
      permissions: [
        { key: 'supplier:view', label: '查看供应商' },
        { key: 'supplier:create', label: '创建供应商' },
        { key: 'supplier:edit', label: '编辑供应商' },
        { key: 'supplier:delete', label: '删除供应商' },
      ],
    },
    {
      module: '采购单管理',
      permissions: [
        { key: 'purchase_order:view', label: '查看采购单' },
        { key: 'purchase_order:create', label: '创建采购单' },
        { key: 'purchase_order:edit', label: '编辑采购单' },
        { key: 'purchase_order:submit', label: '提交审批' },
        { key: 'purchase_order:receive', label: '到货入库' },
        { key: 'purchase_order:delete', label: '删除采购单' },
      ],
    },
    {
      module: '加工入库',
      permissions: [
        { key: 'production_order:view', label: '查看加工单' },
        { key: 'production_order:create', label: '创建加工单' },
        { key: 'production_order:edit', label: '编辑加工单' },
        { key: 'production_order:complete', label: '完成加工' },
        { key: 'production_order:delete', label: '删除加工单' },
      ],
    },
    {
      module: '物料分类',
      permissions: [
        { key: 'material_category:view', label: '查看分类' },
        { key: 'material_category:create', label: '创建分类' },
        { key: 'material_category:edit', label: '编辑分类' },
        { key: 'material_category:delete', label: '删除分类' },
      ],
    },
    {
      module: '系统管理',
      permissions: [
        { key: 'admin:users', label: '用户管理' },
        { key: 'admin:settings', label: '系统设置' },
      ],
    },
  ];
}
