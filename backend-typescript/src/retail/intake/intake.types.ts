export type IntakeSource =
  'SUPPLIER_BILL_IMAGE' | 'EXCEL' | 'CSV' | 'VOICE' | 'SHARED_DOCUMENT';
export type IntakeRow = {
  name: string;
  sku?: string;
  barcode?: string;
  quantity?: number;
  unit_code?: string;
  sale_unit?: string;
  conversion?: number;
  purchase_price?: number;
  selling_price?: number;
  mrp?: number;
  gst_rate?: number;
  hsn_sac?: string;
  batch_number?: string;
  expiry_date?: string;
  manufacturing_date?: string;
  matched_item_id?: string;
  match_status?: 'EXISTING' | 'POSSIBLE' | 'NEW';
  candidates?: { id: string; name: string; unit: string }[];
  warnings?: string[];
  provenance?: Record<string, string>;
  confirmed?: boolean;
  use_quantity_as_stock?: boolean;
  ignore?: boolean;
};
export const intakeFields = [
  'name',
  'sku',
  'barcode',
  'quantity',
  'unit_code',
  'sale_unit',
  'conversion',
  'purchase_price',
  'selling_price',
  'mrp',
  'gst_rate',
  'hsn_sac',
  'batch_number',
  'expiry_date',
  'manufacturing_date',
] as const;
