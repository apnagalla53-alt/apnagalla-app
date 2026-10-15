import { key } from '../imports/import-format';
import { RETAIL_UNITS } from '../retail-units';
import type { IntakeRow } from './intake.types';

const aliases: Record<string, string> = {
  piece: 'PCS',
  pieces: 'PCS',
  pc: 'PCS',
  pcs: 'PCS',
  पीस: 'PCS',
  packet: 'PKT',
  packets: 'PKT',
  pack: 'PKT',
  पैकेट: 'PKT',
  box: 'BOX',
  boxes: 'BOX',
  बॉक्स: 'BOX',
  strip: 'STRIP',
  strips: 'STRIP',
  kg: 'KG',
  kilogram: 'KG',
  kilo: 'KG',
  किलो: 'KG',
  gram: 'GM',
  grams: 'GM',
  g: 'GM',
  gm: 'GM',
  ग्राम: 'GM',
  litre: 'LTR',
  liter: 'LTR',
  litres: 'LTR',
  liters: 'LTR',
  लीटर: 'LTR',
  ml: 'ML',
  metre: 'MTR',
  meter: 'MTR',
  metres: 'MTR',
  meters: 'MTR',
  मीटर: 'MTR',
  foot: 'FT',
  feet: 'FT',
  roll: 'ROLL',
  bottle: 'BOTTLE',
  bottles: 'BOTTLE',
  pair: 'PAIR',
  pairs: 'PAIR',
  set: 'SET',
  tube: 'TUBE',
  sachet: 'PKT',
};
export const normalizeUnit = (s: string) =>
  aliases[s.normalize('NFKC').trim().toLowerCase()] || s.trim().toUpperCase();
export const normalizeName = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]/gu, '');
const digits = (s: string) =>
  s.replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));
export function intakeNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || String(value).trim() === '')
    return undefined;
  const s = digits(String(value))
    .replace(/₹|INR|Rs\.?|rupees|रुपये|रुपए/gi, '')
    .trim();
  if (
    !/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,6})?$/.test(
      s,
    )
  )
    return NaN;
  return Number(s.replaceAll(',', ''));
}
/** Controlled grammar. Unrecognized text remains a flagged draft, never a guessed row. */
export function parseSpokenItems(text: string): IntakeRow[] {
  return digits(text)
    .split(/\r?\n|;|।|\.(?=\s*[\p{L}])/u)
    .filter((s) => s.trim())
    .slice(0, 200)
    .map((source) => {
      const s = source.trim().replace(/,/g, ' '),
        price = s.match(
          /(?:selling\s+price|sale\s+price|price|rate|कीमत|दाम)\s*(?:is\s*)?[₹]?\s*(\d+(?:\.\d{1,6})?)/i,
        );
      const before = price ? s.slice(0, price.index) : s,
        qty = before.match(
          /^(.*?)\s+(\d+(?:\.\d{1,6})?)\s+([\p{L}\p{M}]+)\s*$/u,
        );
      return {
        name: (qty ? qty[1] : before).trim(),
        ...(qty
          ? { quantity: Number(qty[2]), unit_code: normalizeUnit(qty[3]) }
          : {}),
        ...(price ? { selling_price: Number(price[1]) } : {}),
        confirmed: false,
        warnings:
          qty && price
            ? ['Check the transcript and confirm this row.']
            : ['Could not identify every value. Enter the missing details.'],
        provenance: {
          name: 'SOURCE_VOICE',
          quantity: 'SOURCE_VOICE',
          unit_code: 'SOURCE_VOICE',
          selling_price: 'SOURCE_VOICE',
        },
      };
    });
}
/** Invoice V1 recognizes an explicit name / quantity / unit / rate / amount layout.
 * Other layouts stay editable and uncertain; totals and tax are never reverse engineered. */
export function parseInvoiceText(text: string, confidence: number) {
  const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
    rows: IntakeRow[] = [];
  let invoice_number: string | undefined,
    invoice_date: string | undefined,
    detected_total: number | undefined;
  for (const line of lines) {
    const inv = line.match(
      /(?:invoice|bill)\s*(?:no\.?|number|#)\s*[:#-]?\s*([\w/-]{1,100})/i,
    );
    if (inv) invoice_number = inv[1];
    const dt = line.match(
      /(?:invoice\s*)?date\s*[:#-]?\s*(\d{4}-\d{2}-\d{2})/i,
    );
    if (dt) invoice_date = dt[1];
    const total = line.match(
      /(?:grand\s+total|total\s+amount)\s*[:₹]?\s*([\d,.]+)\s*$/i,
    );
    if (total) detected_total = intakeNumber(total[1]);
    const m = line.match(
      /^(.+?)\s+(\d+(?:\.\d+)?)\s+([\p{L}\p{M}]+)\s+([\d,.]+)\s+([\d,.]+)(?:\s+(\d+(?:\.\d+)?)\s*%)?\s*$/u,
    );
    if (
      !m ||
      /^(?:item|product|description|total|subtotal|tax|gst|amount)/i.test(m[1])
    )
      continue;
    const quantity = Number(m[2]),
      purchase_price = intakeNumber(m[4]),
      amount = intakeNumber(m[5]),
      warnings = ['Check the photo and confirm this row.'];
    if (
      !Number.isFinite(purchase_price) ||
      !Number.isFinite(amount) ||
      Math.abs(quantity * purchase_price! - amount!) > 0.02
    )
      warnings.push(
        'Line amount does not match quantity × purchase price. Check discounts and tax.',
      );
    if (confidence < 80)
      warnings.push(
        'Some text was unclear. Check every value against the bill.',
      );
    rows.push({
      name: m[1].replace(/^\d+[.)]?\s+/, ''),
      quantity,
      unit_code: normalizeUnit(m[3]),
      purchase_price,
      ...(m[6] ? { gst_rate: Number(m[6]) } : {}),
      warnings,
      confirmed: false,
      provenance: {
        name: 'SOURCE_EXTRACTED',
        quantity: 'SOURCE_EXTRACTED',
        purchase_price: 'SOURCE_EXTRACTED',
        unit_code: 'SOURCE_EXTRACTED',
      },
    });
  }
  return {
    rows,
    header: { invoice_number, invoice_date, detected_total },
    unparsed_lines: Math.max(0, lines.length - rows.length),
  };
}
const columns: Record<string, string[]> = {
  name: ['name', 'item name', 'product', 'product name', 'description'],
  sku: ['sku', 'item code', 'product code'],
  barcode: ['barcode', 'ean'],
  quantity: [
    'stock',
    'stock qty',
    'stock quantity',
    'quantity',
    'qty',
    'opening stock',
  ],
  unit_code: ['unit', 'uom', 'unit code', 'purchase unit'],
  sale_unit: ['sale unit', 'selling unit'],
  conversion: ['conversion', 'conversion factor', 'pack size'],
  purchase_price: ['purchase price', 'purchase rate', 'cost', 'cost price'],
  selling_price: ['selling price', 'sale price', 'selling rate', 'rate'],
  mrp: ['mrp'],
  gst_rate: ['gst', 'gst rate', 'tax rate'],
  hsn_sac: ['hsn', 'hsn code', 'hsn sac'],
  batch_number: ['batch', 'batch number', 'batch no'],
  expiry_date: ['expiry', 'expiry date'],
  manufacturing_date: ['manufacturing date', 'mfg date'],
};
export function suggestIntakeMapping(headers: string[]) {
  const mapping: Record<string, string> = {};
  for (const [field, names] of Object.entries(columns)) {
    const found = headers.filter((h) => names.some((n) => key(n) === key(h)));
    if (found.length === 1) mapping[field] = found[0];
  }
  return mapping;
}
export function rowFromFile(
  source: Record<string, string>,
  mapping: Record<string, string>,
): IntakeRow {
  const row: any = { name: '', provenance: {}, confirmed: false, warnings: [] };
  for (const [field, column] of Object.entries(mapping)) {
    const v = source[column]?.trim();
    if (v !== undefined && v !== '') {
      row[field] = [
        'quantity',
        'conversion',
        'purchase_price',
        'selling_price',
        'mrp',
        'gst_rate',
      ].includes(field)
        ? intakeNumber(v)
        : field === 'unit_code' || field === 'sale_unit'
          ? normalizeUnit(v)
          : v;
      row.provenance[field] = 'SOURCE_FILE';
    }
  }
  return row;
}
export const unitMode = (code: string) =>
  RETAIL_UNITS.find((u) => u.code === code)?.selling_mode;
