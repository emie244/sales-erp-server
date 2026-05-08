// Table UI Standards & Helpers
// Usage: import { tableDefaults, colWidth, renderMoney, renderDate, actionColumn } from '@/utils/table';

import type { TableProps } from 'antd';

/** Standard column widths (px) */
export const colWidth = {
  id: 200,
  name: 160,
  shortName: 100,
  phone: 120,
  date: 110,
  dateTime: 160,
  money: 110,
  status: 90,
  action: 160,
  actionWide: 220,
  sku: 240,
  productName: 160,
  spec: 140,
  category: 100,
  stock: 90,
  warehouse: 120,
  qty: 90,
  percent: 160,
  email: 180,
  address: 200,
} as const;

/** Default table props to ensure consistent UI */
export const tableDefaults: TableProps<any> = {
  size: 'small',
  scroll: { x: 'max-content' },
  pagination: false,
};

/** Render money with ¥ prefix */
export function renderMoney(v: number | string | undefined) {
  return `¥${parseFloat(String(v || 0)).toFixed(2)}`;
}

/** Render date (YYYY-MM-DD) */
export function renderDate(v: string | undefined) {
  return v ? v.split('T')[0] : '-';
}

/** Render date-time */
export function renderDateTime(v: string | undefined) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Standard action column template */
export function actionColumn(
  renderActions: (record: any) => React.ReactNode,
  options?: { width?: number; fixed?: 'left' | 'right' },
) {
  return {
    title: '操作',
    key: 'action',
    width: options?.width ?? colWidth.action,
    fixed: options?.fixed ?? ('right' as const),
    render: (_: any, record: any) => renderActions(record),
  };
}

/** Build a standard column with width, ellipsis, and optional align */
export function stdColumn(
  title: string,
  dataIndex: string,
  options?: {
    width?: number;
    align?: 'left' | 'center' | 'right';
    ellipsis?: boolean;
    render?: (v: any, record: any) => React.ReactNode;
  },
) {
  return {
    title,
    dataIndex,
    key: dataIndex,
    width: options?.width,
    align: options?.align,
    ellipsis: options?.ellipsis ?? (options?.width ? true : false),
    render: options?.render,
  };
}
