export const RETAIL_UNITS = [
  ['PCS', 'Pieces', 'PIECE'], ['KG', 'Kilograms', 'WEIGHT'], ['GM', 'Grams', 'WEIGHT'],
  ['LTR', 'Litres', 'WEIGHT'], ['ML', 'Millilitres', 'WEIGHT'],
  ['MTR', 'Metres', 'LENGTH'], ['M', 'Metres', 'LENGTH'], ['FT', 'Feet', 'LENGTH'],
  ['CM', 'Centimetres', 'LENGTH'], ['MM', 'Millimetres', 'LENGTH'], ['IN', 'Inches', 'LENGTH'],
  ['SQFT', 'Square feet', 'AREA'], ['SQM', 'Square metres', 'AREA'], ['SQIN', 'Square inches', 'AREA'],
  ['CBM', 'Cubic metres', 'VOLUME'], ['CFT', 'Cubic feet', 'VOLUME'],
  ['BOX', 'Box', 'PIECE'], ['PKT', 'Packet', 'PIECE'], ['DZ', 'Dozen', 'PIECE'],
  ['POUCH', 'Pouch', 'PIECE'], ['SACHET', 'Sachet', 'PIECE'], ['BOTTLE', 'Bottle', 'PIECE'],
  ['JAR', 'Jar', 'PIECE'], ['CAN', 'Can', 'PIECE'], ['PACK', 'Pack', 'PIECE'],
  ['BUNDLE', 'Bundle', 'PIECE'], ['TUBE', 'Tube', 'PIECE'], ['TRAY', 'Tray', 'PIECE'],
  ['BORA', 'Bora / sack', 'PIECE'], ['PETI', 'Peti / crate', 'PIECE'], ['TIN', 'Tin', 'PIECE'],
  ['SACK', 'Sack', 'PIECE'], ['SET', 'Set', 'PIECE'], ['PAIR', 'Pair', 'PIECE'],
  ['ROLL', 'Roll', 'PIECE'], ['HOUR', 'Hour', 'PIECE'], ['DAY', 'Day', 'PIECE'], ['JOB', 'Job', 'PIECE'],
].map(([code, name, selling_mode]) => ({ code, name, selling_mode, decimal_places: selling_mode === 'PIECE' ? 0 : 6 }));

// Changing a base unit must never reinterpret a saved document, pack recipe or stock.
export const BASE_UNIT_USAGE = {
  stock_movements: true, purchase_order_lines: true, goods_receipt_lines: true,
  purchase_invoice_lines: true, purchase_return_lines: true, sales_quotation_lines: true,
  sales_order_lines: true, delivery_challan_lines: true, sales_invoice_lines: true,
  sales_return_lines: true, pos_held_bill_lines: true, StockAdjustmentLine: true,
  StockTransferLine: true, OpeningStockLine: true, StockCountLine: true,
  unit_conversions: true, variants: true, batches: true, serials: true, stock_balance_projection: true, cost_states: true,
  bundle_components: true, bundle_of: true, price_list_items: true, customer_item_prices: true,
} as const;
