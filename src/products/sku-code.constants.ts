export const SKU_CODE_REGEX = /^(CP|BC|YL)-[A-Z]{2}(-[A-Z]{2})?-\d{3}$/;

export type ItemType =
  | 'finished_good'
  | 'semi_finished'
  | 'raw_material'
  | 'packaging';

const ITEM_TYPE_MAP: Record<string, ItemType> = {
  成品: 'finished_good',
  半成品: 'semi_finished',
  原材料: 'raw_material',
  包材: 'packaging',
};

export function mapItemType(raw: string | null | undefined): ItemType | null {
  if (!raw) return null;
  const key = String(raw).trim();
  return ITEM_TYPE_MAP[key] ?? null;
}
