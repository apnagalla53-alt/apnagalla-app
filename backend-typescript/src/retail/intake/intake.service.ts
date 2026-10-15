import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EntitlementService } from '../../common/entitlement.service';
import { RetailService } from '../retail.service';
import { ItemCompositionService } from '../../item-composition/item-composition.service';
import { StorageService } from '../../attachments/storage/storage.interface';
import { cleanUploadedImage } from '../../attachments/image-validation';
import { businessDate } from '../../common/business-date';
import { throttleOperation } from '../../common/operation-throttle';
import { hash, parseExport } from '../imports/import-format';
import { importCapabilities } from '../imports/import-entitlements';
import {
  intakeCatalog,
  intakeRowErrors,
  matchIntakeRow,
} from './intake-matching';
import {
  normalizeName,
  normalizeUnit,
  parseSpokenItems,
  rowFromFile,
  suggestIntakeMapping,
  unitMode,
} from './intake-parser';
import { intakeFields, IntakeRow, IntakeSource } from './intake.types';
import { ConfirmIntakeDto, EditIntakeRowDto } from './intake.dto';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RetailIntakeService {
  constructor(
    private db: PrismaService,
    private retail: RetailService,
    private composition: ItemCompositionService,
    private entitlements: EntitlementService,
    @Inject('StorageService') private storage: StorageService,
  ) {}
  private scope(user: any) {
    return { company_id: user.company_id, branch_id: user.branch_id };
  }
  private permit(user: any, write = false, purchase = false) {
    const owner = ['OWNER', 'ADMIN', 'TENANT_ADMIN'].includes(user.role),
      can = (p: string) => owner || user.permissions.includes(p);
    if (
      !can(write ? 'inventory.write' : 'inventory.read') ||
      (purchase && !can(write ? 'purchase.write' : 'purchase.read'))
    )
      throw new ForbiddenException(
        'Your account needs item' +
          (purchase ? ' and purchase' : '') +
          ' access for this intake.',
      );
  }
  private async features(user: any) {
    const result = await this.entitlements.resolve(
      user.organization_id,
      this.db,
      user.company_id,
    );
    return new Set(result.features.filter((f) => f.enabled).map((f) => f.code));
  }
  private async audit(user: any, event: string, count?: number) {
    await this.db.auditLog.create({
      data: {
        ...this.scope(user),
        user_id: user.id,
        action: 'INTAKE_' + event,
        details: JSON.stringify({ ...(count !== undefined ? { count } : {}) }),
      },
    });
  }
  async capabilities(user: any) {
    this.permit(user);
    return {
      ocr_enabled: process.env.INTAKE_OCR_ENABLED === 'true',
      image_formats: ['image/jpeg', 'image/png', 'image/webp'],
      spreadsheet_formats: ['csv', 'xlsx', 'xls'],
      max_mb: 5,
      max_rows: 2000,
      voice: 'BROWSER_OR_TYPED',
      document_retention_days: 7,
      draft_retention_days: 90,
      pdf_supported: false,
    };
  }
  private async rawJob(user: any, id: string) {
    this.permit(user);
    const job = await this.db.retailImportJob.findFirst({
      where: { id, ...this.scope(user), preset: 'UNIVERSAL_INTAKE' },
    });
    if (!job)
      throw new NotFoundException(
        'This intake is unavailable in the selected shop.',
      );
    this.permit(user, false, job.kind === 'INTAKE_PURCHASE');
    return job;
  }
  async history(user: any) {
    this.permit(user);
    const rows = await this.db.retailImportJob.findMany({
      where: { ...this.scope(user), preset: 'UNIVERSAL_INTAKE' },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: {
        id: true,
        kind: true,
        status: true,
        created_at: true,
        filename: true,
      },
    });
    return rows;
  }
  async job(user: any, id: string, page = 1) {
    let job = await this.rawJob(user, id),
      config: any = job.configuration;
    if (
      ['RECEIVED', 'PROCESSING'].includes(job.status) &&
      Date.now() - new Date(config.queued_at || job.created_at).getTime() >
        10 * 60000
    ) {
      job = await this.db.runAtomic(async () => {
        await this.db
          .$queryRaw`SELECT id FROM retail_import_jobs WHERE id=${id}::uuid FOR UPDATE`;
        const current = await this.rawJob(user, id),
          c: any = current.configuration;
        if (
          !['RECEIVED', 'PROCESSING'].includes(current.status) ||
          Date.now() - new Date(c.queued_at || current.created_at).getTime() <=
            10 * 60000
        )
          return current;
        return this.db.retailImportJob.update({
          where: { id },
          data: {
            status: 'FAILED',
            configuration: {
              ...c,
              error:
                'Bill reading did not finish. Your photo is kept for retry, or enter the purchase manually.',
            },
          },
        });
      });
      config = job.configuration;
    }
    const counts = await this.db.retailImportRow.groupBy({
        by: ['status'],
        where: { job_id: id },
        _count: { _all: true },
      }),
      rows = await this.db.retailImportRow.findMany({
        where: { job_id: id },
        orderBy: [{ status: 'asc' }, { number: 'asc' }],
        skip: (Math.max(1, Math.min(40, Number(page) || 1)) - 1) * 50,
        take: 50,
      });
    let purchase_preview: any = null;
    if (job.kind === 'INTAKE_PURCHASE') {
      const all = await this.db.retailImportRow.findMany({
          where: { job_id: id, status: { not: 'SKIPPED' } },
          select: { normalized: true },
          take: 201,
        }),
        catalog = await this.db.item.findMany({
          where: {
            company_id: user.company_id,
            id: {
              in: all
                .map((r) => (r.normalized as any).matched_item_id)
                .filter(Boolean),
            },
          },
          include: { tax_class: true },
        });
      let subtotal = new Prisma.Decimal(0),
        tax = new Prisma.Decimal(0),
        complete = all.length <= 200;
      for (const saved of all) {
        const row = saved.normalized as any;
        if (
          !Number.isFinite(row.quantity) ||
          !Number.isFinite(row.purchase_price)
        ) {
          complete = false;
          continue;
        }
        const item = catalog.find((i) => i.id === row.matched_item_id),
          rate = item
            ? Number(item.tax_class?.tax_rate || 0)
            : Number(row.gst_rate || 0),
          value = new Prisma.Decimal(row.quantity)
            .mul(row.purchase_price)
            .toDecimalPlaces(2);
        subtotal = subtotal.plus(value);
        tax = tax.plus(value.mul(rate).div(100).toDecimalPlaces(2));
      }
      purchase_preview = {
        subtotal: subtotal.toNumber(),
        gst: tax.toNumber(),
        total: subtotal.plus(tax).toNumber(),
        complete,
        estimated: true,
      };
    }
    const { document_key, storage_provider, ...safe } = config;
    return {
      id: job.id,
      kind: job.kind,
      status: job.status,
      created_at: job.created_at,
      configuration: safe,
      counts: Object.fromEntries(counts.map((r) => [r.status, r._count._all])),
      rows,
      page: Math.max(1, Number(page) || 1),
      has_more:
        Math.max(1, Number(page) || 1) * 50 <
        counts.reduce((sum, r) => sum + r._count._all, 0),
      has_photo: !!document_key,
      purchase_preview,
    };
  }
  private async create(
    user: any,
    source: IntakeSource,
    kind: string,
    fingerprint: string,
    configuration: any,
    candidates: IntakeRow[],
    sourceRows: any[] = [],
  ) {
    this.permit(user, true, kind === 'INTAKE_PURCHASE');
    await throttleOperation('intake-create:' + user.id, 30);
    return this.db.runAtomic(async () => {
      await this.db
        .$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${user.company_id + ':intake:' + fingerprint},0))::text`;
      const existing = await this.db.retailImportJob.findFirst({
        where: { ...this.scope(user), fingerprint },
      });
      if (existing) return this.job(user, existing.id);
      const catalog = await intakeCatalog(this.db, user.company_id),
        features = await this.features(user),
        seen = new Set<string>();
      const job = await this.db.retailImportJob.create({
        data: {
          ...this.scope(user),
          user_id: user.id,
          financial_year_id: user.financial_year_id,
          kind,
          preset: 'UNIVERSAL_INTAKE',
          filename: source,
          fingerprint,
          headers: configuration.headers || [],
          status: candidates.length ? 'NEEDS_REVIEW' : 'RECEIVED',
          configuration: JSON.parse(
            JSON.stringify({
              universal_intake: true,
              source,
              ...configuration,
            }),
          ),
        },
      });
      const rows = candidates.map((candidate, index) => {
        const row = matchIntakeRow(candidate, catalog),
          identity = normalizeName(row.name);
        row.warnings = [...(row.warnings || [])];
        if (seen.has(identity)) {
          row.warnings.push(
            'Another row has the same item name. Check whether these are separate items.',
          );
          row.confirmed = false;
        }
        seen.add(identity);
        const errors = intakeRowErrors(row, kind, catalog, features);
        return {
          job_id: job.id,
          number: index + 1,
          normalized: JSON.parse(JSON.stringify(row)),
          source: sourceRows[index] || {},
          errors,
          status: errors.length ? 'NEEDS_REVIEW' : 'READY',
        };
      });
      for (let n = 0; n < rows.length; n += 250)
        await this.db.retailImportRow.createMany({
          data: rows.slice(n, n + 250),
        });
      await this.db.retailImportJob.update({
        where: { id: job.id },
        data: {
          configuration: JSON.parse(
            JSON.stringify({
              ...(job.configuration as object),
              initial_rows: rows.length,
              initial_review_rows: rows.filter((r) => r.errors.length).length,
            }),
          ),
        },
      });
      await this.audit(user, 'DRAFT_CREATED', rows.length);
      return this.job(user, job.id);
    });
  }
  async voice(user: any, transcript: string) {
    const rows = parseSpokenItems(transcript);
    if (!rows.length)
      throw new BadRequestException('Say or type at least one item.');
    return this.create(
      user,
      'VOICE',
      'INTAKE_ITEMS',
      hash('VOICE:' + transcript),
      {
        notice:
          'Check the transcript. Quantities do not become opening stock unless you explicitly choose that for a row.',
      },
      rows,
    );
  }
  async spreadsheet(user: any, file: Express.Multer.File, body: any) {
    this.permit(user, true);
    if (
      Object.keys(body).some((k) => !['mapping', 'sheet'].includes(k)) ||
      (body.sheet && typeof body.sheet !== 'string')
    )
      throw new BadRequestException(
        'Choose the sheet and column choices only.',
      );
    if (
      !file ||
      !['csv', 'xls', 'xlsx'].includes(
        file.originalname.split('.').pop()?.toLowerCase() || '',
      )
    )
      throw new BadRequestException(
        'Choose a CSV, XLS or XLSX file up to 5 MB.',
      );
    const ext = file.originalname.split('.').pop()!.toLowerCase();
    if (
      ext !== 'csv' &&
      !(
        (file.buffer[0] === 0x50 && file.buffer[1] === 0x4b) ||
        (file.buffer[0] === 0xd0 && file.buffer[1] === 0xcf)
      )
    )
      throw new BadRequestException(
        'This is not a supported Excel file. Export a genuine CSV, XLS or XLSX file.',
      );
    const parsed = parseExport(file.buffer, file.originalname, 'ITEMS', {
      sheet: body.sheet,
      headerRow: 1,
      rejectFormulas: true,
    });
    if (parsed.rows.length > 2000)
      throw new BadRequestException('Use up to 2,000 rows in one file.');
    let mapping: Record<string, string>;
    try {
      mapping = body.mapping
        ? JSON.parse(body.mapping)
        : suggestIntakeMapping(parsed.headers);
    } catch {
      throw new BadRequestException('Check column choices.');
    }
    if (
      !mapping ||
      Array.isArray(mapping) ||
      typeof mapping !== 'object' ||
      Object.keys(mapping).some((k) => !intakeFields.includes(k as any)) ||
      Object.values(mapping).some(
        (v) => typeof v !== 'string' || !parsed.headers.includes(v),
      ) ||
      new Set(Object.values(mapping)).size !== Object.values(mapping).length
    )
      throw new BadRequestException(
        'Each selected column must be used once and belong to this file.',
      );
    const unmapped = parsed.headers.filter(
      (h) => !Object.values(mapping).includes(h),
    );
    const candidates = parsed.rows.map((source) => {
      const row = rowFromFile(source, mapping),
        unsupported = importCapabilities('ITEMS', source, {}).unsupported;
      if (unsupported.length) {
        row.warnings = [
          ...(row.warnings || []),
          'Advanced source details need review: ' + unsupported.join(', '),
        ];
        (row as any).unsupported_fields = unsupported;
      }
      row.confirmed =
        !!row.name && row.selling_price !== undefined && !unsupported.length;
      return row;
    });
    return this.create(
      user,
      file.originalname.toLowerCase().endsWith('.csv') ? 'CSV' : 'EXCEL',
      'INTAKE_ITEMS',
      hash(hash(file.buffer) + JSON.stringify(mapping)),
      {
        mapping,
        headers: parsed.headers,
        sheets: parsed.sheets,
        unmapped,
        notice:
          'Review what stock quantities mean before saving. Existing items are kept; their stock and prices are not overwritten.',
      },
      candidates,
      parsed.rows,
    );
  }
  async photo(user: any, file: Express.Multer.File, shared = false) {
    this.permit(user, true, true);
    await throttleOperation('intake-photo:' + user.id, 15);
    if (!file?.buffer?.length || file.buffer.length > 5 * 1024 * 1024)
      throw new BadRequestException(
        'Choose a bill photo up to 5 MB. PDF is not supported yet.',
      );
    const bytes = await cleanUploadedImage(file.buffer, file.mimetype),
      fingerprint = hash('BILL:' + hash(bytes)),
      prior = await this.db.retailImportJob.findFirst({
        where: { ...this.scope(user), fingerprint, preset: 'UNIVERSAL_INTAKE' },
      });
    if (prior) {
      const result = await this.job(user, prior.id);
      return { ...result, duplicate_upload: true };
    }
    if (
      (await this.db.retailImportJob.count({
        where: {
          ...this.scope(user),
          preset: 'UNIVERSAL_INTAKE',
          status: { in: ['RECEIVED', 'PROCESSING', 'NEEDS_REVIEW'] },
        },
      })) >= 20
    )
      throw new BadRequestException(
        'Review or cancel older intakes before adding another photo.',
      );
    const ext = (
        { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as any
      )[file.mimetype],
      document_key =
        user.company_id + '/INTAKE_DOCUMENT/' + randomUUID() + '.' + ext;
    await this.storage.save(document_key, bytes);
    try {
      const result = await this.create(
        user,
        shared ? 'SHARED_DOCUMENT' : 'SUPPLIER_BILL_IMAGE',
        'INTAKE_PURCHASE',
        fingerprint,
        {
          document_key,
          storage_provider: process.env.STORAGE_PROVIDER || 'local',
          queued_at: new Date().toISOString(),
          photo_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          stage: 'Waiting for the bill reader',
          ocr_enabled: process.env.INTAKE_OCR_ENABLED === 'true',
        },
        [],
      );
      const stored = await this.rawJob(user, result.id);
      if ((stored.configuration as any).document_key !== document_key)
        await this.storage.delete(document_key);
      return result;
    } catch (error) {
      await this.storage.delete(document_key).catch(() => {});
      throw error;
    }
  }
  async remap(user: any, id: string, mapping: Record<string, string>) {
    const job = await this.rawJob(user, id),
      c: any = job.configuration;
    this.permit(user, true);
    if (
      job.kind !== 'INTAKE_ITEMS' ||
      !c.headers?.length ||
      ['CONFIRMED', 'PARTIAL', 'CANCELLED'].includes(job.status)
    )
      throw new BadRequestException(
        'Only unsaved spreadsheet columns can be changed.',
      );
    if (
      !mapping ||
      Array.isArray(mapping) ||
      Object.keys(mapping).some((k) => !intakeFields.includes(k as any)) ||
      Object.values(mapping).some(
        (v) => typeof v !== 'string' || !c.headers.includes(v),
      ) ||
      new Set(Object.values(mapping)).size !== Object.values(mapping).length
    )
      throw new BadRequestException(
        'Choose a different source column for each field.',
      );
    const saved = await this.db.retailImportRow.findMany({
        where: { job_id: id },
        orderBy: { number: 'asc' },
      }),
      sources = saved.map((r) => r.source as Record<string, string>),
      rows = sources.map((source) => {
        const row = rowFromFile(source, mapping),
          unsupported = importCapabilities('ITEMS', source, {}).unsupported;
        (row as any).unsupported_fields = unsupported;
        row.confirmed =
          !!row.name && row.selling_price !== undefined && !unsupported.length;
        return row;
      });
    return this.create(
      user,
      c.source,
      'INTAKE_ITEMS',
      hash(job.fingerprint + JSON.stringify(mapping)),
      {
        mapping,
        headers: c.headers,
        sheets: c.sheets,
        unmapped: c.headers.filter(
          (h: string) => !Object.values(mapping).includes(h),
        ),
        notice: c.notice,
      },
      rows,
      sources,
    );
  }
  async document(user: any, id: string) {
    const job = await this.rawJob(user, id),
      c: any = job.configuration;
    if (
      job.status === 'CANCELLED' ||
      !c.document_key ||
      !Number.isFinite(Date.parse(c.photo_expires_at)) ||
      Date.now() > Date.parse(c.photo_expires_at)
    )
      throw new NotFoundException(
        'This temporary photo has expired. Your draft is still available.',
      );
    if (c.storage_provider !== (process.env.STORAGE_PROVIDER || 'local'))
      throw new BadRequestException('Private document storage is unavailable.');
    return {
      bytes: await this.storage.get(c.document_key),
      mime: c.document_key.endsWith('.jpg')
        ? 'image/jpeg'
        : c.document_key.endsWith('.png')
          ? 'image/png'
          : 'image/webp',
    };
  }
  async edit(user: any, id: string, rowId: string, dto: EditIntakeRowDto) {
    const job = await this.rawJob(user, id);
    this.permit(user, true, job.kind === 'INTAKE_PURCHASE');
    return this.db.runAtomic(async () => {
      await this.db
        .$queryRaw`SELECT id FROM retail_import_jobs WHERE id=${id}::uuid FOR UPDATE`;
      const currentJob = await this.rawJob(user, id);
      if (
        ['CONFIRMED', 'CANCELLED', 'PROCESSING', 'RECEIVED'].includes(
          currentJob.status,
        )
      )
        throw new BadRequestException('This draft cannot be edited right now.');
      if (dto.ignore && currentJob.kind === 'INTAKE_PURCHASE')
        throw new BadRequestException(
          'A supplier bill saves as a complete purchase. Correct the row or use the manual purchase form.',
        );
      const saved = await this.db.retailImportRow.findFirst({
        where: { id: rowId, job_id: id },
      });
      if (!saved || ['IMPORTED', 'SKIPPED'].includes(saved.status))
        throw new BadRequestException(
          'This row is already saved or unavailable.',
        );
      const { create_new, clear_fields, ...changes } = Object.fromEntries(
          Object.entries(dto).filter(([, v]) => v !== undefined && v !== null),
        ) as EditIntakeRowDto,
        row: any = { ...(saved.normalized as object), ...changes };
      for (const field of clear_fields || []) delete row[field];
      if (create_new) {
        delete row.matched_item_id;
        row.match_status = 'NEW';
        row.candidates = [];
      } else
        Object.assign(
          row,
          matchIntakeRow(row, await intakeCatalog(this.db, user.company_id)),
        );
      row.provenance = {
        ...row.provenance,
        ...Object.fromEntries(
          Object.keys(changes).map((k) => [
            k,
            (saved.normalized as any)[k] === (changes as any)[k]
              ? 'USER_CONFIRMED'
              : 'USER_EDITED',
          ]),
        ),
        ...Object.fromEntries(
          (clear_fields || []).map((k) => [k, 'USER_EDITED']),
        ),
      };
      const errors = intakeRowErrors(
        row,
        job.kind,
        await intakeCatalog(this.db, user.company_id),
        await this.features(user),
      );
      await this.db.retailImportRow.update({
        where: { id: rowId },
        data: {
          normalized: row,
          errors,
          status: row.ignore
            ? 'SKIPPED'
            : errors.length
              ? 'NEEDS_REVIEW'
              : 'READY',
        },
      });
      await this.audit(user, 'ROW_CORRECTED');
      return this.job(user, id);
    });
  }
  async confirmRows(user: any, id: string, rowIds: string[]) {
    for (const rowId of rowIds)
      await this.edit(user, id, rowId, { confirmed: true });
    return this.job(user, id);
  }
  private async itemFor(user: any, job: any, row: IntakeRow) {
    const catalog = await intakeCatalog(this.db, user.company_id);
    const item = catalog.find((i) => i.id === row.matched_item_id);
    if (item) return item;
    if (
      catalog.some(
        (i) =>
          normalizeName(i.name) === normalizeName(row.name) ||
          (row.sku && i.sku?.toLowerCase() === row.sku.toLowerCase()) ||
          (row.barcode && i.barcodes.some((b) => b.barcode === row.barcode)),
      )
    )
      throw new BadRequestException(
        'This item now exists. Choose it in the review to avoid a duplicate.',
      );
    const sale = normalizeUnit(row.sale_unit || row.unit_code || '');
    return this.retail.createItem(
      user.company_id,
      user.id,
      job.financial_year_id,
      user.branch_id,
      {
        name: row.name.trim(),
        selling_price: row.selling_price!,
        unit_code: sale,
        selling_mode: unitMode(sale),
        inventory_tracking: !!row.use_quantity_as_stock || !!row.batch_number,
        sku: row.sku,
        barcode: row.barcode,
        gst_rate: row.gst_rate,
        hsn_sac: row.hsn_sac,
        mrp: row.mrp,
        track_batch: !!row.batch_number,
        ...(job.kind === 'INTAKE_ITEMS' &&
        row.use_quantity_as_stock &&
        row.quantity !== undefined
          ? {
              opening_stock: row.quantity,
              ...(row.purchase_price !== undefined
                ? { opening_cost: row.purchase_price }
                : { skip_opening_cost: true }),
            }
          : {}),
      },
    );
  }
  async confirm(user: any, id: string, dto: ConfirmIntakeDto) {
    const job = await this.rawJob(user, id);
    this.permit(user, true, job.kind === 'INTAKE_PURCHASE');
    if (!dto.acknowledge_effects)
      throw new BadRequestException(
        'Review the stock and money effect before saving.',
      );
    await throttleOperation('intake-confirm:' + user.id, 180);
    return this.db.runAtomic(async () => {
      await this.db
        .$queryRaw`SELECT id FROM retail_import_jobs WHERE id=${id}::uuid FOR UPDATE`;
      await this.db
        .$queryRaw`SELECT id FROM companies WHERE id=${user.company_id}::uuid FOR UPDATE`;
      const current = await this.rawJob(user, id),
        config: any = current.configuration;
      if (current.status === 'CONFIRMED') return this.job(user, id);
      if (!['NEEDS_REVIEW', 'READY', 'PARTIAL'].includes(current.status))
        throw new BadRequestException('This draft is not ready to save.');
      if (config.unmapped?.length && !dto.accept_unmapped)
        throw new BadRequestException(
          'Review unrecognized columns before saving. They remain in this draft.',
        );
      const catalog = await intakeCatalog(this.db, user.company_id),
        features = await this.features(user),
        all = await this.db.retailImportRow.findMany({
          where: { job_id: id, status: { notIn: ['IMPORTED', 'SKIPPED'] } },
          orderBy: { number: 'asc' },
        });
      const ready = all.filter((r) => r.status === 'READY');
      if (!ready.length)
        throw new BadRequestException(
          'No ready items yet. Correct or confirm a row first.',
        );
      if (current.kind === 'INTAKE_PURCHASE') {
        if (
          !Number.isFinite(dto.invoice_total ?? config.header?.detected_total)
        ) {
          throw new BadRequestException(
            'Enter the supplier bill total so it can be checked against every received row.',
          );
        }
        await this.entitlements.require(
          user.organization_id,
          ['INVENTORY', 'PURCHASING'],
          user.company_id,
        );
        if (ready.length !== all.length)
          throw new BadRequestException(
            'Check every purchase row before confirming. A supplier bill saves as one complete purchase.',
          );
        if (ready.length > 200)
          throw new BadRequestException(
            'Split supplier bills above 200 rows into reviewed purchases.',
          );
        if (
          !dto.supplier_id ||
          !(await this.db.party.findFirst({
            where: {
              id: dto.supplier_id,
              company_id: user.company_id,
              party_type: 'SUPPLIER',
              is_active: true,
            },
          }))
        )
          throw new BadRequestException('Select a supplier from this shop.');
        if (
          !dto.invoice_number?.trim() ||
          !dto.invoice_date ||
          !dto.payment_status
        )
          throw new BadRequestException(
            'Confirm the supplier invoice number, date and payment status.',
          );
        const invoiceDate = new Date(dto.invoice_date);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.invoice_date) ||
            !Number.isFinite(invoiceDate.getTime()) ||
            invoiceDate.toISOString().slice(0, 10) !== dto.invoice_date) {
          throw new BadRequestException('Choose a valid calendar date for the supplier invoice.');
        }
        const duplicate = await this.db.purchaseInvoice.findFirst({
          where: {
            company_id: user.company_id,
            party_id: dto.supplier_id,
            supplier_invoice_number: {
              equals: dto.invoice_number.trim(),
              mode: 'insensitive',
            },
            status: 'POSTED',
          },
          select: { id: true },
        });
        if (duplicate)
          throw new BadRequestException({
            message:
              'This supplier bill is already saved. Open the existing purchase.',
            existing_purchase_id: duplicate.id,
          });
        const lines: any[] = [];
        for (const saved of ready) {
          const row = saved.normalized as unknown as IntakeRow,
            errors = intakeRowErrors(row, current.kind, catalog, features);
          if (errors.length)
            throw new BadRequestException(
              'Row ' + saved.number + ': ' + errors.join(' '),
            );
          const item = await this.itemFor(user, current, row);
          let unit_id = item.primary_unit_id;
          const code = normalizeUnit(row.unit_code!);
          if (
            code !== (item as any).unit &&
            code !== (item as any).primary_unit?.code
          ) {
            const conversion = (item as any).unit_conversions?.find(
              (c: any) => c.from_unit.code === code,
            );
            unit_id =
              conversion?.from_unit_id ||
              (
                await this.composition.addConversion(user, item.id, {
                  unit_code: code,
                  conversion_factor: row.conversion!,
                })
              ).from_unit_id;
          }
          if (row.gst_rate !== undefined) {
            const actual = await this.db.item.findUniqueOrThrow({
              where: { id: item.id },
              include: { tax_class: true },
            });
            if (Number(actual.tax_class?.tax_rate || 0) !== row.gst_rate)
              throw new BadRequestException(
                'Row ' +
                  saved.number +
                  ': GST differs from the saved item. Review its tax settings before receiving.',
              );
          }
          lines.push({
            item_id: item.id,
            quantity: row.quantity,
            purchase_rate: row.purchase_price,
            unit_id,
            batch_number: row.batch_number,
            expiry_date: row.expiry_date,
            manufacturing_date: row.manufacturing_date,
          });
        }
        const purchase = await this.retail.createPurchase(
          user.company_id,
          user.branch_id,
          current.financial_year_id,
          user.id,
          {
            supplier_id: dto.supplier_id,
            bill_number: dto.invoice_number.trim(),
            purchase_date: dto.invoice_date,
            payment_status: dto.payment_status,
            payment_method: dto.payment_method,
            paid_amount: dto.paid_amount,
            lines,
          },
        );
        const reviewedTotal =
          dto.invoice_total ?? config.header?.detected_total;
        if (
          purchase &&
          Number.isFinite(reviewedTotal) &&
          Math.abs(Number(purchase.grand_total) - reviewedTotal) > 0.02
        )
          throw new BadRequestException(
            'The purchase total differs from the total read from the photo. No purchase was saved. Check GST, quantities, discounts and extra charges; use the manual form for charges or discounts.',
          );
        if (!purchase?.id)
          throw new BadRequestException(
            'Purchase confirmation is unavailable. Your draft is still here.',
          );
        await this.db.retailImportRow.updateMany({
          where: { job_id: id, status: 'READY' },
          data: { status: 'IMPORTED', entity_id: purchase.id },
        });
        await this.db.retailImportJob.update({
          where: { id },
          data: {
            status: 'CONFIRMED',
            configuration: {
              ...config,
              purchase_id: purchase.id,
              reviewed_total: reviewedTotal ?? null,
              confirmed_at: new Date().toISOString(),
            },
          },
        });
        await this.audit(user, 'PURCHASE_CONFIRMED', ready.length);
      } else {
        await this.entitlements.require(
          user.organization_id,
          ['INVENTORY'],
          user.company_id,
        );
        for (const saved of ready.slice(0, 25)) {
          await this.db.$executeRawUnsafe('SAVEPOINT intake_row');
          try {
            const row = saved.normalized as unknown as IntakeRow,
              errors = intakeRowErrors(row, current.kind, catalog, features);
            if (errors.length) {
              await this.db.retailImportRow.update({
                where: { id: saved.id },
                data: { status: 'NEEDS_REVIEW', errors },
              });
              await this.db.$executeRawUnsafe('RELEASE SAVEPOINT intake_row');
              continue;
            }
            const item = await this.itemFor(user, current, row);
            await this.db.retailImportRow.update({
              where: { id: saved.id },
              data: {
                status: row.matched_item_id ? 'SKIPPED' : 'IMPORTED',
                entity_id: item.id,
                errors: [],
              },
            });
            await this.db.$executeRawUnsafe('RELEASE SAVEPOINT intake_row');
          } catch (error) {
            await this.db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT intake_row');
            await this.db.$executeRawUnsafe('RELEASE SAVEPOINT intake_row');
            if (!(error instanceof BadRequestException)) throw error;
            await this.db.retailImportRow.update({
              where: { id: saved.id },
              data: { status: 'NEEDS_REVIEW', errors: [error.message] },
            });
          }
        }
        const remaining = await this.db.retailImportRow.count({
          where: { job_id: id, status: { notIn: ['IMPORTED', 'SKIPPED'] } },
        });
        await this.db.retailImportJob.update({
          where: { id },
          data: {
            status: remaining ? 'PARTIAL' : 'CONFIRMED',
            configuration: {
              ...config,
              first_saved_at: config.first_saved_at || new Date().toISOString(),
              ...(!remaining ? { confirmed_at: new Date().toISOString() } : {}),
            },
          },
        });
        await this.audit(user, 'ITEMS_CONFIRMED', Math.min(25, ready.length));
      }
      return this.job(user, id);
    });
  }
  async retry(user: any, id: string) {
    await this.rawJob(user, id);
    this.permit(user, true, true);
    return this.db.runAtomic(async () => {
      await this.db
        .$queryRaw`SELECT id FROM retail_import_jobs WHERE id=${id}::uuid FOR UPDATE`;
      const job = await this.rawJob(user, id),
        c: any = job.configuration;
      if (
        job.status !== 'FAILED' ||
        !c.document_key ||
        Date.now() > Date.parse(c.photo_expires_at)
      )
        throw new BadRequestException(
          'Choose another photo or continue manually.',
        );
      await this.db.retailImportJob.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          configuration: {
            ...c,
            error: null,
            stage: 'Waiting for the bill reader',
            queued_at: new Date().toISOString(),
          },
        },
      });
      return this.job(user, id);
    });
  }
  async cancel(user: any, id: string) {
    const initial = await this.rawJob(user, id);
    this.permit(user, true, initial.kind === 'INTAKE_PURCHASE');
    await this.db.runAtomic(async () => {
      await this.db
        .$queryRaw`SELECT id FROM retail_import_jobs WHERE id=${id}::uuid FOR UPDATE`;
      const job = await this.rawJob(user, id),
        c: any = job.configuration;
      if (job.status === 'CONFIRMED')
        throw new BadRequestException(
          'This intake is already saved. Use the saved purchase or item pages.',
        );
      if (job.status === 'CANCELLED') return;
      await this.db.retailImportRow.deleteMany({
        where: { job_id: id, entity_id: null },
      });
      await this.db.retailImportJob.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          fingerprint: hash(job.fingerprint + ':CANCELLED:' + job.id),
          configuration: {
            ...c,
            error: null,
            cancelled_at: new Date().toISOString(),
          },
        },
      });
      await this.audit(user, 'CANCELLED');
    });
    return { cancelled: true };
  }
}
