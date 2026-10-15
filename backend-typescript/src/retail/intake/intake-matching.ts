import { BadRequestException } from '@nestjs/common';
import Fuse from 'fuse.js';
import { PrismaService } from '../../database/prisma.service';
import { normalizeName, normalizeUnit, unitMode } from './intake-parser';
import type { IntakeRow } from './intake.types';
export async function intakeCatalog(db: PrismaService, company: string) {
  const rows = await db.item.findMany({
    where: { company_id: company, is_active: true, is_system: false },
    include: {
      primary_unit: true,
      barcodes: true,
      unit_conversions: { include: { from_unit: true } },
    },
    take: 10001,
  });
  if (rows.length > 10000)
    throw new BadRequestException(
      'This shop has more than 10,000 items. Use the existing import tool with SKU references.',
    );
  return rows;
}
export function matchIntakeRow(
  row: IntakeRow,
  catalog: Awaited<ReturnType<typeof intakeCatalog>>,
) {
  const candidates = (items: typeof catalog) =>
    items
      .slice(0, 4)
      .map((i) => ({ id: i.id, name: i.name, unit: i.primary_unit.code }));
  if (row.matched_item_id) {
    const saved = catalog.find((i) => i.id === row.matched_item_id);
    return saved
      ? {
          ...row,
          match_status: 'EXISTING' as const,
          candidates: candidates([saved]),
        }
      : {
          ...row,
          matched_item_id: undefined,
          match_status: 'POSSIBLE' as const,
          candidates: [],
        };
  }
  let exact = row.barcode
    ? catalog.filter((i) => i.barcodes.some((b) => b.barcode === row.barcode))
    : [];
  const skuMatches = row.sku
    ? catalog.filter((i) => i.sku?.toLowerCase() === row.sku!.toLowerCase())
    : [];
  if (
    exact.length &&
    skuMatches.some((i) => !exact.some((b) => b.id === i.id))
  ) {
    return {
      ...row,
      match_status: 'POSSIBLE' as const,
      candidates: candidates([...exact, ...skuMatches]),
    };
  }
  if (!exact.length && row.sku) exact = skuMatches;
  if (!exact.length && row.name)
    exact = catalog.filter(
      (i) =>
        normalizeName(i.name) === normalizeName(row.name) ||
        (Array.isArray((i.custom_attributes as any)?.aliases) &&
          (i.custom_attributes as any).aliases.some(
            (a: unknown) =>
              typeof a === 'string' &&
              normalizeName(a) === normalizeName(row.name),
          )),
    );
  if (exact.length === 1)
    return {
      ...row,
      match_status: 'EXISTING' as const,
      matched_item_id: exact[0].id,
      candidates: candidates(exact),
    };
  const possible = exact.length
    ? exact
    : row.name
      ? new Fuse(catalog, {
          keys: ['name'],
          threshold: 0.32,
          ignoreLocation: true,
          minMatchCharLength: 3,
        })
          .search(row.name, { limit: 4 })
          .map((r) => r.item)
      : [];
  return {
    ...row,
    match_status: possible.length ? ('POSSIBLE' as const) : ('NEW' as const),
    candidates: candidates(possible),
  };
}
export function intakeRowErrors(
  row: IntakeRow,
  kind: string,
  catalog: Awaited<ReturnType<typeof intakeCatalog>>,
  features: Set<string>,
) {
  if (row.ignore) return [];
  const errors: string[] = [];
  if ((row as any).unsupported_fields?.length)
    errors.push(
      'This file contains advanced fields that need the existing item configuration flow. Skip this row or use Buy Stock; they cannot be discarded silently.',
    );
  if (!row.name?.trim()) errors.push('Enter the item name.');
  for (const [field, max] of Object.entries({
    name: 255,
    sku: 255,
    barcode: 100,
    unit_code: 20,
    sale_unit: 20,
    hsn_sac: 20,
    batch_number: 100,
  }))
    if (
      typeof (row as any)[field] === 'string' &&
      (row as any)[field].length > max
    )
      errors.push('Shorten ' + field.replaceAll('_', ' ') + '.');
  if (
    Object.values(row).some(
      (v) => typeof v === 'string' && /^[=+@]/.test(v.trim()),
    )
  )
    errors.push(
      'Spreadsheet formulas are not accepted as item details. Replace them with plain values.',
    );
  for (const f of [
    'quantity',
    'conversion',
    'purchase_price',
    'selling_price',
    'mrp',
    'gst_rate',
  ] as const)
    if (
      row[f] !== undefined &&
      (typeof row[f] !== 'number' ||
        !Number.isFinite(row[f]) ||
        row[f]! < 0 ||
        row[f]! > 999999999)
    )
      errors.push('Check ' + f.replaceAll('_', ' ') + '.');
  if (row.match_status === 'POSSIBLE')
    errors.push('Choose an existing item or confirm a new item.');
  const item = catalog.find((i) => i.id === row.matched_item_id),
    code = normalizeUnit(row.unit_code || ''),
    sale = normalizeUnit(row.sale_unit || code),
    mode = unitMode(item?.primary_unit.code || sale);
  if (row.matched_item_id && !item)
    errors.push('This item is no longer available in this shop.');
  if (!item && !unitMode(sale)) errors.push('Choose a supported selling unit.');
  if (!item && row.selling_price === undefined)
    errors.push('Enter the selling price for this new item.');
  if (mode && mode !== 'PIECE' && !features.has(mode))
    errors.push(mode + ' requires an eligible plan and Shop Feature.');
  if (kind === 'INTAKE_PURCHASE' && ['AREA', 'VOLUME'].includes(mode || ''))
    errors.push(
      'This measured item needs dimensions. Receive it through Buy Stock.',
    );
  if (
    item?.has_variants ||
    item?.track_serial ||
    item?.is_bundle ||
    item?.item_type === 'SERVICE'
  )
    errors.push(
      'Use Buy Stock to receive this item with its variant, serial or service details.',
    );
  if (
    (item?.track_batch || row.batch_number || row.expiry_date) &&
    !features.has('BATCH_TRACKING')
  )
    errors.push('Batch & Expiry requires an eligible plan and Shop Feature.');
  if (row.expiry_date && !row.batch_number)
    errors.push('Enter the batch number for this expiry date.');
  for (const field of ['expiry_date', 'manufacturing_date'] as const)
    if (
      row[field] &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(row[field]!) ||
        !Number.isFinite(Date.parse(row[field]!)) ||
        new Date(row[field]!).toISOString().slice(0, 10) !== row[field])
    )
      errors.push('Check ' + field.replaceAll('_', ' ') + '.');
  if (
    row.gst_rate !== undefined &&
    (row.gst_rate > 100 || (!features.has('GST_INVOICES') && row.gst_rate > 0))
  )
    errors.push('Check GST and your GST entitlement.');
  if (kind === 'INTAKE_PURCHASE') {
    if (!(row.quantity! > 0)) errors.push('Enter the received quantity.');
    if (row.purchase_price === undefined)
      errors.push('Enter the purchase price. Missing cost is not zero.');
    if (!code) errors.push('Choose the purchase unit.');
    const base = item?.primary_unit.code || sale;
    if (code && base && code !== base) {
      if (!features.has('MULTI_UNIT'))
        errors.push('Different purchase packs require Multi-unit.');
      if (
        !item?.unit_conversions.some((c) => c.from_unit.code === code) &&
        !(row.conversion! > 0)
      )
        errors.push('Enter how many selling units are in one purchase pack.');
    }
    if (item?.track_batch && !row.batch_number)
      errors.push('Enter the received batch number.');
  } else {
    if (
      row.batch_number ||
      row.expiry_date ||
      row.manufacturing_date ||
      row.conversion ||
      sale !== code
    )
      errors.push(
        'Batch, expiry and pack receipts need a purchase draft. Use Scan Supplier Bill or Buy Stock.',
      );
    if (item && row.use_quantity_as_stock && row.quantity !== undefined)
      errors.push('This item already exists. Receive stock through Buy Stock.');
  }
  if (!row.confirmed) errors.push('Check and confirm this row.');
  return [...new Set(errors)];
}
