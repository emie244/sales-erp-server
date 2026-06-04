import { Repository, DataSource } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductSku } from './entities/product-sku.entity';

const ITEM_TYPE_PREFIX_MAP: Record<string, string> = {
  finished_good: 'CP',
  semi_finished: 'BCP',
  raw_material: 'YC',
  packaging: 'BC',
};

/**
 * 根据物料类型获取编码前缀
 */
export function getPrefixByItemType(itemType: string | null | undefined): string {
  return ITEM_TYPE_PREFIX_MAP[itemType || 'finished_good'] || 'CP';
}

/**
 * 标准化中类代码为 2 位大写字母
 */
export function normalizeCategoryCode(category: string | null | undefined): string {
  if (!category) return 'XX';
  const code = category
    .replace(/[^a-zA-Z0-9一-龥]/g, '')
    .toUpperCase()
    .slice(0, 2);
  // 如果是中文，取拼音首字母（简化处理，实际可用 pinyin 库）
  if (/^[一-龥]/.test(code)) {
    // 简单映射常见分类
    const chineseMap: Record<string, string> = {
      数: 'SZ',
      码: 'SZ',
      配: 'PJ',
      件: 'PJ',
      充: 'PB',
      电: 'PB',
      线: 'XL',
      材: 'BC',
      料: 'BC',
    };
    const firstChar = category.charAt(0);
    return chineseMap[firstChar] || 'OT';
  }
  return code.padEnd(2, 'X');
}

export interface CodeGenerateOptions {
  prefix?: string;
  categoryCode?: string;
}

/**
 * 生成 SPU 编码
 * 格式: [前缀]-[中类2位]-[流水4位]
 * 示例: CP-PB-0001
 */
export async function generateSpuCode(
  dataSource: DataSource,
  options: CodeGenerateOptions = {},
): Promise<string> {
  const prefix = options.prefix || 'CP';
  const categoryCode = normalizeCategoryCode(options.categoryCode);

  const result = await dataSource.query(
    `SELECT MAX(SUBSTRING(spu_code FROM '[0-9]{4}$')) as max_num
     FROM products
     WHERE spu_code LIKE $1`,
    [`${prefix}-${categoryCode}-%`],
  );

  const maxNum = parseInt(result[0]?.max_num || '0', 10);
  const nextNum = maxNum + 1;

  if (nextNum > 9999) {
    throw new Error(`SPU 编码已耗尽: ${prefix}-${categoryCode}-9999，请联系管理员扩展编码规则`);
  }

  return `${prefix}-${categoryCode}-${String(nextNum).padStart(4, '0')}`;
}

/**
 * 生成 SKU 编码
 * 格式: [SPU编码]-[规格流水3位]
 * 示例: CP-PB-0001-001
 */
export async function generateSkuCode(
  dataSource: DataSource,
  spuCode: string,
): Promise<string> {
  const result = await dataSource.query(
    `SELECT MAX(SUBSTRING("skuCode" FROM '[0-9]{3}$')) as max_num
     FROM product_skus
     WHERE "skuCode" LIKE $1`,
    [`${spuCode}-%`],
  );

  const maxNum = parseInt(result[0]?.max_num || '0', 10);
  const nextNum = maxNum + 1;

  if (nextNum > 999) {
    throw new Error(`SKU 编码已耗尽: ${spuCode}-999，该产品规格数量已达上限`);
  }

  return `${spuCode}-${String(nextNum).padStart(3, '0')}`;
}
