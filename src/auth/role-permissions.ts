export const VALID_ROLES = ['admin', 'sales', 'purchaser', 'finance'] as const;
export type UserRole = (typeof VALID_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  sales: '销售',
  purchaser: '采购',
  finance: '财务',
};

export const ROLE_PERMISSION_TEMPLATES: Record<UserRole, string[]> = {
  admin: ['*'],
  sales: [
    'order:view',
    'order:create',
    'order:edit',
    'order:submit',
    'order:collect',
    'customer:view',
    'customer:create',
    'customer:edit',
    'product:view',
    'prepayment:view',
    'prepayment:create',
    'prepayment:edit',
    'stock:view',
    'stock:ledger',
    'purchase_order:view',
    'approval:view',
    'report:view',
  ],
  purchaser: [
    'supplier:view',
    'supplier:create',
    'supplier:edit',
    'purchase_order:view',
    'purchase_order:create',
    'purchase_order:edit',
    'purchase_order:submit',
    'purchase_request:view',
    'purchase_request:create',
    'purchase_request:edit',
    'purchase_request:convert',
    'product:view',
    'stock:view',
    'stock:ledger',
    'bom:view',
    'bom:create',
    'bom:edit',
    'production_order:view',
    'production_order:create',
    'production_order:edit',
    'approval:view',
    'report:view',
  ],
  finance: [
    'order:view',
    'order:collect',
    'customer:view',
    'product:view',
    'prepayment:view',
    'prepayment:create',
    'prepayment:edit',
    'stock:view',
    'stock:ledger',
    'purchase_order:view',
    'invoice:view',
    'invoice:create',
    'invoice:edit',
    'invoice:delete',
    'voucher:view',
    'voucher:create',
    'voucher:edit',
    'voucher:delete',
    'approval:view',
    'report:view',
  ],
};

/**
 * 根据角色获取默认权限列表
 */
export function getDefaultPermissionsForRole(role: string): string[] {
  if (role === 'admin') return ['*'];
  return (
    ROLE_PERMISSION_TEMPLATES[role as UserRole] ??
    ROLE_PERMISSION_TEMPLATES.sales
  );
}

/**
 * 尝试从飞书部门名称推断角色
 * 获取不到时默认返回 sales
 */
export function detectRoleFromDepartment(deptName?: string): UserRole {
  if (!deptName) return 'sales';
  const lower = deptName.toLowerCase();
  if (lower.includes('采购') || lower.includes('供应链') || lower.includes('supply')) {
    return 'purchaser';
  }
  if (lower.includes('财务') || lower.includes('finance') || lower.includes('account')) {
    return 'finance';
  }
  if (lower.includes('销售') || lower.includes('sale') || lower.includes('市场')) {
    return 'sales';
  }
  return 'sales';
}
