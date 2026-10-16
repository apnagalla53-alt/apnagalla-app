export function isEmptyBulkRow(row:{name:string;price:string;stock:string;unit:{code:string}}){return !row.name.trim()&&!row.price.trim()&&!row.stock.trim()&&row.unit.code==='PCS';}
export const BULK_ITEM_NUMBER_MAX = 999_999_999.999999;

export function bulkRowError(row: {name: string; price: string; stock: string}): string {
  if (!row.name.trim()) return 'Enter an item name.';
  if (!row.price.trim() || !Number.isFinite(Number(row.price)) || Number(row.price) < 0)
    return 'Enter a valid selling price of zero or more.';
  if (Number(row.price) > BULK_ITEM_NUMBER_MAX)
    return 'Selling price is too large. Enter an amount below 1,000,000,000.';
  if (row.stock !== '' && (!row.stock.trim() || !Number.isFinite(Number(row.stock)) || Number(row.stock) < 0))
    return 'Enter a valid stock quantity or leave it blank.';
  if (Number(row.stock) > BULK_ITEM_NUMBER_MAX)
    return 'Stock quantity is too large. Enter a quantity below 1,000,000,000.';
  return '';
}
