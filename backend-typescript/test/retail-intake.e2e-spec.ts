import { Test } from '@nestjs/testing';
import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import * as XLSX from 'xlsx';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { processNextIntakeDocument } from '../src/retail/intake/intake-ocr-queue';
import { matchIntakeRow } from '../src/retail/intake/intake-matching';
import type { StorageService } from '../src/attachments/storage/storage.interface';
import { businessDate } from '../src/common/business-date';
import {
  normalizeName,
  parseInvoiceText,
  parseSpokenItems,
} from '../src/retail/intake/intake-parser';

describe('Universal intake: drafts, tenant boundaries and authoritative commits', () => {
  let app: INestApplication,
    db: PrismaService,
    A: any,
    B: any,
    token: string,
    other: string,
    soap: any,
    supplier: any;
  const date = businessDate(),
    password = 'DisposableIntake!' + randomUUID();
  const call = (method: string, path: string, shop = A, t = token) =>
    (request(app.getHttpServer()) as any)
      [method]('/api/v1/' + path)
      .set('Authorization', 'Bearer ' + t)
      .set('X-Company-Id', shop.company.id)
      .set('X-Branch-Id', shop.branch.id)
      .set('X-Financial-Year-Id', shop.financialYear.id);
  const api = (method: string, path: string, shop = A, t = token) =>
    call(method, 'retail/account/intake' + path, shop, t);
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw Error('Dedicated local _test database required');
    app = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'api/v1/{*path}', method: RequestMethod.ALL }],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    db = app.get(PrismaService);
    const provision = app.get(TenantProvisioningService),
      planId = (await db.plan.findUniqueOrThrow({ where: { code: 'PRO' } })).id;
    A = await provision.provisionTenant({
      planId,
      organizationName: 'Intake A ' + randomUUID(),
      adminName: 'Disposable Owner',
      adminEmail: randomUUID() + '@test.invalid',
      adminPassword: password,
      businessType: 'GROCERY',
    });
    B = await provision.provisionTenant({
      planId,
      organizationName: 'Intake B ' + randomUUID(),
      adminName: 'Disposable Owner',
      adminEmail: randomUUID() + '@test.invalid',
      adminPassword: password,
      businessType: 'HARDWARE',
    });
    token = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: A.user.username, password })
        .expect(200)
    ).body.access_token;
    other = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: B.user.username, password })
        .expect(200)
    ).body.access_token;
    soap = (
      await call('post', 'retail/items/inline')
        .send({
          name: 'Soap bar',
          unit_code: 'PCS',
          selling_price: 20,
          inventory_tracking: false,
        })
        .expect(201)
    ).body;
    supplier = (
      await call('post', 'retail/suppliers')
        .send({ name: 'Intake Supplier' })
        .expect(201)
    ).body;
  }, 60000);
  afterAll(async () => {
    await app?.close();
  });
  it('parses controlled English and Hindi digits without inventing missing numbers', () => {
    expect(normalizeName('दही')).not.toBe(normalizeName('दहा'));
    const conflict = matchIntakeRow(
      { name: 'One', barcode: '111', sku: 'TWO', confirmed: false },
      [
        {
          id: 'one',
          name: 'One',
          sku: 'ONE',
          primary_unit: { code: 'PCS' },
          barcodes: [{ barcode: '111' }],
        },
        {
          id: 'two',
          name: 'Two',
          sku: 'TWO',
          primary_unit: { code: 'PCS' },
          barcodes: [],
        },
      ] as any,
    );
    expect(conflict.match_status).toBe('POSSIBLE');
    expect(conflict.matched_item_id).toBeUndefined();
    expect(
      parseSpokenItems('Biscuit 20 packet price 14 rupees')[0],
    ).toMatchObject({
      name: 'Biscuit',
      quantity: 20,
      unit_code: 'PKT',
      selling_price: 14,
      confirmed: false,
    });
    expect(parseSpokenItems('साबुन २० पीस कीमत १४ रुपये')[0]).toMatchObject({
      quantity: 20,
      unit_code: 'PCS',
      selling_price: 14,
    });
    expect(parseSpokenItems('a vague product')[0].quantity).toBeUndefined();
    expect(parseInvoiceText('blurred and unreadable', 10).rows).toEqual([]);
  });
  it('voice drafts never change stock or items until a reviewed confirmation', async () => {
    const before = await db.item.count({ where: { company_id: A.company.id } }),
      job = (
        await api('post', '/voice')
          .send({ transcript: 'Notebook 20 packet price 14 rupees' })
          .expect(201)
      ).body;
    expect(job.rows[0].status).toBe('NEEDS_REVIEW');
    expect(await db.item.count({ where: { company_id: A.company.id } })).toBe(
      before,
    );
    await api('post', '/' + job.id + '/confirm')
      .send({ acknowledge_effects: true })
      .expect(400);
    await api('patch', '/' + job.id + '/rows/' + job.rows[0].id)
      .send({ confirmed: true })
      .expect(200);
    const key = randomUUID(),
      first = (
        await api('post', '/' + job.id + '/confirm')
          .set('Idempotency-Key', key)
          .send({ acknowledge_effects: true })
          .expect((r) => expect(r.status, JSON.stringify(r.body)).toBe(201))
      ).body;
    expect(first.status).toBe('CONFIRMED');
    await api('post', '/' + job.id + '/confirm')
      .set('Idempotency-Key', key)
      .send({ acknowledge_effects: true })
      .expect(201);
    const rows = await db.item.findMany({
      where: { company_id: A.company.id, name: 'Notebook' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].inventory_tracking).toBe(false);
    expect(
      await db.stockMovement.count({
        where: { company_id: A.company.id, item_id: rows[0].id },
      }),
    ).toBe(0);
  });
  it('auto-maps familiar CSV columns and imports valid rows without discarding invalid rows', async () => {
    const csv =
      'Product,Selling Price,Stock Qty,Unit\nTea,12,5,PCS\nInvalid price,not-a-number,3,PCS\nSoap bar,20,,PCS';
    const job = (
      await api('post', '/spreadsheet')
        .attach('file', Buffer.from(csv), {
          filename: 'items.csv',
          contentType: 'text/csv',
        })
        .expect(201)
    ).body;
    expect(job.configuration.mapping).toMatchObject({
      name: 'Product',
      quantity: 'Stock Qty',
      selling_price: 'Selling Price',
    });
    expect(job.counts.READY).toBe(2);
    expect(job.counts.NEEDS_REVIEW).toBe(1);
    const first = (
      await api('post', '/' + job.id + '/confirm')
        .send({ acknowledge_effects: true })
        .expect((r) => expect(r.status, JSON.stringify(r.body)).toBe(201))
    ).body;
    expect(first.counts.IMPORTED).toBe(1);
    expect(first.counts.SKIPPED).toBe(1);
    expect(first.counts.NEEDS_REVIEW).toBe(1);
    const tea = await db.item.findFirstOrThrow({
      where: { company_id: A.company.id, name: 'Tea' },
    });
    expect(tea.inventory_tracking).toBe(false);
    expect(
      await db.stockMovement.count({
        where: { company_id: A.company.id, item_id: tea.id },
      }),
    ).toBe(0);
    const bad = first.rows.find((r: any) => r.status === 'NEEDS_REVIEW');
    await api('patch', '/' + job.id + '/rows/' + bad.id)
      .send({ selling_price: 9, confirmed: true, use_quantity_as_stock: true })
      .expect(200);
    const final = (
      await api('post', '/' + job.id + '/confirm')
        .send({ acknowledge_effects: true })
        .expect((r) => expect(r.status, JSON.stringify(r.body)).toBe(201))
    ).body;
    expect(final.status).toBe('CONFIRMED');
    const stocked = await db.item.findFirstOrThrow({
      where: { company_id: A.company.id, name: 'Invalid price' },
    });
    expect(stocked.inventory_tracking).toBe(true);
    const cost = await db.inventoryCostState.findFirstOrThrow({
      where: { company_id: A.company.id, item_id: stocked.id },
    });
    expect(Number(cost.unknown_quantity)).toBe(3);
  });
  it('requires ambiguous mappings and does not discard advanced source fields', async () => {
    const job = (
      await api('post', '/spreadsheet')
        .attach('file', Buffer.from('Name,RATE2,Batch\nMedicine,15,LOT-A'), {
          filename: 'odd.csv',
        })
        .expect(201)
    ).body;
    expect(job.configuration.mapping.selling_price).toBeUndefined();
    const mapped = (
      await api('post', '/' + job.id + '/mapping')
        .send({
          mapping: {
            name: 'Name',
            selling_price: 'RATE2',
            batch_number: 'Batch',
          },
        })
        .expect(201)
    ).body;
    expect(mapped.counts.READY || 0).toBe(0);
    await api('post', '/' + mapped.id + '/confirm')
      .send({ acknowledge_effects: true })
      .expect(400);
  });
  it('protects other-tenant jobs, rows, files and supplier references', async () => {
    const job = (
      await api('post', '/voice')
        .send({ transcript: 'Private item 1 piece price 20' })
        .expect(201)
    ).body;
    await api('get', '/' + job.id, B, other).expect(404);
    await api('patch', '/' + job.id + '/rows/' + job.rows[0].id, B, other)
      .send({ confirmed: true })
      .expect(404);
    await api('get', '/' + job.id + '/photo', B, other).expect(404);
    await api('post', '/' + job.id + '/confirm', B, other)
      .send({ acknowledge_effects: true })
      .expect(404);
    await call('post', 'retail/imports/' + job.id + '/commit')
      .send({ accept_unmapped: true })
      .expect(404);
  });
  it('queues a photo, processes a draft without posting, then confirms one purchase safely', async () => {
    const bytes = await sharp({
      create: { width: 100, height: 100, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    const job = (
      await api('post', '/photo')
        .attach('file', bytes, {
          filename: 'invoice.png',
          contentType: 'image/png',
        })
        .expect(201)
    ).body;
    expect(job.status).toBe('RECEIVED');
    const before = await db.purchaseInvoice.count({
      where: { company_id: A.company.id },
    });
    await processNextIntakeDocument(
      db,
      app.get<StorageService>('StorageService'),
      {
        extractDocument: async () => ({
          text:
            'Invoice No: INTAKE-001\nDate: ' +
            date +
            '\nSoap bar 24 PCS 10.00 240.00\nGrand Total 240.00',
          confidence: 95,
        }),
      },
    );
    const review = (await api('get', '/' + job.id).expect(200)).body;
    expect(review.status).toBe('NEEDS_REVIEW');
    expect(review.rows[0].normalized.matched_item_id).toBe(soap.id);
    expect(
      await db.purchaseInvoice.count({ where: { company_id: A.company.id } }),
    ).toBe(before);
    await api('patch', '/' + job.id + '/rows/' + review.rows[0].id)
      .send({ confirmed: true })
      .expect(200);
    const body = {
        acknowledge_effects: true,
        supplier_id: supplier.id,
        invoice_number: 'INTAKE-001',
        invoice_date: date,
        payment_status: 'CREDIT',
      },
      key = randomUUID();
    const saved = (
      await api('post', '/' + job.id + '/confirm')
        .set('Idempotency-Key', key)
        .send(body)
        .expect((r) => expect(r.status, JSON.stringify(r.body)).toBe(201))
    ).body;
    expect(saved.status).toBe('CONFIRMED');
    expect(saved.configuration.purchase_id).toBeTruthy();
    await api('post', '/' + job.id + '/confirm')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);
    expect(
      await db.purchaseInvoice.count({ where: { company_id: A.company.id } }),
    ).toBe(before + 1);
    const quantity = await db.stockBalanceProjection.aggregate({
      where: { company_id: A.company.id, item_id: soap.id },
      _sum: { quantity: true },
    });
    expect(Number(quantity._sum.quantity)).toBe(24);
    const pool = await db.inventoryCostState.findFirstOrThrow({
      where: { company_id: A.company.id, item_id: soap.id },
    });
    expect(Number(pool.known_value)).toBe(240);
    const due = (
      await call('get', 'retail/suppliers/' + supplier.id + '/khata').expect(
        200,
      )
    ).body;
    expect(Number(due.balance)).toBe(240);
    const duplicate = (
      await api('post', '/photo')
        .attach('file', bytes, {
          filename: 'same.png',
          contentType: 'image/png',
        })
        .expect(201)
    ).body;
    expect(duplicate.id).toBe(job.id);
    expect(duplicate.duplicate_upload).toBe(true);
  });
  it('retains failed OCR as an honest failure with a manual fallback and no ledger mutation', async () => {
    const bytes = await sharp({
        create: { width: 101, height: 100, channels: 3, background: 'white' },
      })
        .png()
        .toBuffer(),
      job = (
        await api('post', '/photo')
          .attach('file', bytes, {
            filename: 'blurred.png',
            contentType: 'image/png',
          })
          .expect(201)
      ).body,
      before = await db.purchaseInvoice.count({
        where: { company_id: A.company.id },
      });
    await processNextIntakeDocument(
      db,
      app.get<StorageService>('StorageService'),
      { extractDocument: async () => ({ text: '??? blurred', confidence: 5 }) },
    );
    const failed = (await api('get', '/' + job.id).expect(200)).body;
    expect(failed.status).toBe('FAILED');
    expect(failed.configuration.error).toContain('No purchase was saved');
    expect(
      await db.purchaseInvoice.count({ where: { company_id: A.company.id } }),
    ).toBe(before);
  });

  it('validates real Excel files and rejects formulas and disguised workbooks', async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ['Name', 'Selling Price', 'Stock Qty', 'Unit'],
        ['Excel single row', 7, 4, 'PCS'],
      ]),
      'Items',
    );
    const data = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
    const job = (
      await api('post', '/spreadsheet')
        .attach('file', data, { filename: 'stock.xlsx' })
        .expect(201)
    ).body;
    expect(job.counts.READY).toBe(1);
    await api('post', '/' + job.id + '/confirm')
      .send({ acknowledge_effects: true })
      .expect(201);
    const item = await db.item.findFirstOrThrow({
      where: { company_id: A.company.id, name: 'Excel single row' },
    });
    expect(item.inventory_tracking).toBe(false);
    book.Sheets.Items.B2 = { t: 'n', v: 7, f: '3+4' };
    const formula = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
    const rejected = await api('post', '/spreadsheet')
      .attach('file', formula, { filename: 'formula.xlsx' })
      .expect(400);
    expect(JSON.stringify(rejected.body)).toContain('formulas');
    await api('post', '/spreadsheet')
      .attach('file', Buffer.from('Name,Price\nFake,10'), {
        filename: 'not-excel.xlsx',
      })
      .expect(400);
    await api('post', '/photo')
      .attach('file', Buffer.from('not an image'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })
      .expect(400);
  });
  it('cancels a leased OCR job without a late result resurrecting its rows', async () => {
    const bytes = await sharp({
      create: { width: 107, height: 100, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    const job = (
      await api('post', '/photo')
        .attach('file', bytes, {
          filename: 'cancel.png',
          contentType: 'image/png',
        })
        .expect(201)
    ).body;
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((r) => (entered = r)),
      blocked = new Promise<void>((r) => (release = r));
    const processing = processNextIntakeDocument(
      db,
      app.get<StorageService>('StorageService'),
      {
        extractDocument: async () => {
          entered();
          await blocked;
          return { text: 'Soap bar 1 PCS 10.00 10.00', confidence: 95 };
        },
      },
    );
    await started;
    await api('post', '/' + job.id + '/cancel').expect(201);
    release();
    await processing;
    const current = (await api('get', '/' + job.id).expect(200)).body;
    expect(current.status).toBe('CANCELLED');
    expect(current.rows).toHaveLength(0);
    await api('get', '/' + job.id + '/photo').expect(404);
    await api('post', '/' + job.id + '/retry').expect(400);
    const again = (
      await api('post', '/photo')
        .attach('file', bytes, {
          filename: 'retry.png',
          contentType: 'image/png',
        })
        .expect(201)
    ).body;
    expect(again.id).not.toBe(job.id);
    await api('post', '/' + again.id + '/cancel').expect(201);
  });
  it('skips an explicitly unwanted spreadsheet row without posting its stock', async () => {
    const job = (
      await api('post', '/spreadsheet')
        .attach(
          'file',
          Buffer.from(
            'Name,Selling Price,Unit\nSkip me,wrong,PCS\nKeep me,11,PCS',
          ),
          { filename: 'skip.csv' },
        )
        .expect(201)
    ).body;
    const row = job.rows.find((r: any) => r.normalized.name === 'Skip me');
    await api('patch', '/' + job.id + '/rows/' + row.id)
      .send({ ignore: true, confirmed: true })
      .expect(200);
    const saved = (
      await api('post', '/' + job.id + '/confirm')
        .send({ acknowledge_effects: true })
        .expect(201)
    ).body;
    expect(saved.status).toBe('CONFIRMED');
    expect(saved.counts.SKIPPED).toBe(1);
    expect(
      await db.item.count({
        where: { company_id: A.company.id, name: 'Skip me' },
      }),
    ).toBe(0);
  });
  it('reviews possible matches and GST, rolls back a wrong total, and posts one whole purchase', async () => {
    const bytes = await sharp({
        create: { width: 108, height: 100, channels: 3, background: 'white' },
      })
        .png()
        .toBuffer(),
      job = (
        await api('post', '/photo')
          .attach('file', bytes, {
            filename: 'gst.png',
            contentType: 'image/png',
          })
          .expect(201)
      ).body;
    await processNextIntakeDocument(
      db,
      app.get<StorageService>('StorageService'),
      {
        extractDocument: async () => ({
          text:
            'Invoice No: GST-INTAKE-2\nDate: ' +
            date +
            '\nSoap bar 1 PCS 10.00 10.00\nSoap bars 1 PCS 11.00 11.00\nNew sugar 2 PKT 20.00 40.00 5%\nGrand Total 63.00',
          confidence: 95,
        }),
      },
    );
    const review = (await api('get', '/' + job.id).expect(200)).body;
    expect(review.rows).toHaveLength(3);
    const possible = review.rows.find(
      (r: any) => r.normalized.name === 'Soap bars',
    );
    expect(possible.normalized.match_status).toBe('POSSIBLE');
    for (const row of review.rows)
      await api('patch', '/' + job.id + '/rows/' + row.id)
        .send({
          confirmed: true,
          ...(row.id === possible.id ? { matched_item_id: soap.id } : {}),
          ...(row.normalized.name === 'New sugar' ? { selling_price: 30 } : {}),
        })
        .expect(200);
    const checked = (await api('get', '/' + job.id).expect(200)).body;
    expect(checked.counts.READY).toBe(3);
    expect(checked.purchase_preview).toMatchObject({
      subtotal: 61,
      gst: 2,
      total: 63,
      complete: true,
    });
    const before = await db.purchaseInvoice.count({
        where: { company_id: A.company.id },
      }),
      otherSupplier = (
        await call('post', 'retail/suppliers', B, other)
          .send({ name: 'Other supplier' })
          .expect(201)
      ).body;
    const body = {
      acknowledge_effects: true,
      supplier_id: supplier.id,
      invoice_number: 'GST-INTAKE-2',
      invoice_date: date,
      payment_status: 'CREDIT',
    };
    await api('post', '/' + job.id + '/confirm')
      .send({ ...body, supplier_id: otherSupplier.id })
      .expect(400);
    await api('post', '/' + job.id + '/confirm')
      .send({ ...body, invoice_date: '2026-02-31' })
      .expect(400);
    await api('post', '/' + job.id + '/confirm')
      .send({ ...body, invoice_total: 999 })
      .expect(400);
    expect(
      await db.item.count({
        where: { company_id: A.company.id, name: 'New sugar' },
      }),
    ).toBe(0);
    expect(
      await db.purchaseInvoice.count({ where: { company_id: A.company.id } }),
    ).toBe(before);
    const attempts = await Promise.all(
      [1, 2].map(() =>
        api('post', '/' + job.id + '/confirm')
          .set('Idempotency-Key', randomUUID())
          .send(body)
          .expect(201),
      ),
    );
    expect(attempts[0].body.configuration.purchase_id).toBe(
      attempts[1].body.configuration.purchase_id,
    );
    const purchase = await db.purchaseInvoice.findUniqueOrThrow({
      where: { id: attempts[0].body.configuration.purchase_id },
    });
    expect(Number(purchase.grand_total)).toBe(63);
    expect(Number(purchase.tax_amount)).toBe(2);
    expect(
      await db.purchaseInvoice.count({ where: { company_id: A.company.id } }),
    ).toBe(before + 1);
    expect(
      await db.item.count({
        where: { company_id: A.company.id, name: 'Soap bars' },
      }),
    ).toBe(0);
    const due = (
      await call('get', 'retail/suppliers/' + supplier.id + '/khata').expect(
        200,
      )
    ).body;
    expect(Number(due.balance)).toBe(303);
    const vouchers = await db.voucher.findMany({
      where: {
        company_id: A.company.id,
        source_document_id: purchase.id,
        status: 'POSTED',
      },
      include: { lines: true },
    });
    expect(vouchers.length).toBeGreaterThan(0);
    for (const v of vouchers)
      expect(
        v.lines.reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0),
      ).toBeCloseTo(0, 6);
  });

  it('rejects the same supplier invoice from a different photo, including case changes', async () => {
    const bytes = await sharp({
      create: { width: 110, height: 100, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    const job = (
      await api('post', '/photo')
        .attach('file', bytes, {
          filename: 'duplicate-invoice.png',
          contentType: 'image/png',
        })
        .expect(201)
    ).body;
    await processNextIntakeDocument(
      db,
      app.get<StorageService>('StorageService'),
      {
        extractDocument: async () => ({
          text:
            'Invoice No: gst-intake-2\nDate: ' +
            date +
            '\nSoap bar 1 PCS 10.00 10.00\nGrand Total 10.00',
          confidence: 95,
        }),
      },
    );
    const review = (await api('get', '/' + job.id).expect(200)).body;
    await api('patch', '/' + job.id + '/rows/' + review.rows[0].id)
      .send({ confirmed: true })
      .expect(200);
    const before = await db.purchaseInvoice.count({
      where: { company_id: A.company.id },
    });
    const blocked = await api('post', '/' + job.id + '/confirm')
      .send({
        acknowledge_effects: true,
        supplier_id: supplier.id,
        invoice_number: 'gst-intake-2',
        invoice_date: date,
        payment_status: 'CREDIT',
      })
      .expect(400);
    expect(blocked.body.existing_purchase_id).toBeTruthy();
    expect(
      await db.purchaseInvoice.count({ where: { company_id: A.company.id } }),
    ).toBe(before);
    await api('post', '/' + job.id + '/cancel').expect(201);
  });
  it('requires a known pack conversion and rechecks Shop Features at final confirmation', async () => {
    const bytes = await sharp({
        create: { width: 109, height: 100, channels: 3, background: 'white' },
      })
        .png()
        .toBuffer(),
      job = (
        await api('post', '/photo')
          .attach('file', bytes, {
            filename: 'packs.png',
            contentType: 'image/png',
          })
          .expect(201)
      ).body;
    await processNextIntakeDocument(
      db,
      app.get<StorageService>('StorageService'),
      {
        extractDocument: async () => ({
          text:
            'Invoice No: PACK-3\nDate: ' +
            date +
            '\nSoap bar 2 BOX 100.00 200.00\nGrand Total 200.00',
          confidence: 95,
        }),
      },
    );
    const review = (await api('get', '/' + job.id).expect(200)).body;
    const missing = (
      await api('patch', '/' + job.id + '/rows/' + review.rows[0].id)
        .send({ confirmed: true })
        .expect(200)
    ).body;
    expect(missing.counts.NEEDS_REVIEW).toBe(1);
    expect(missing.rows[0].errors.join(' ')).toContain(
      'how many selling units',
    );
    const ready = (
      await api('patch', '/' + job.id + '/rows/' + review.rows[0].id)
        .send({ conversion: 12, confirmed: true })
        .expect(200)
    ).body;
    expect(ready.counts.READY).toBe(1);
    const config = await db.companyConfiguration.findUniqueOrThrow({
        where: { company_id: A.company.id },
      }),
      before = await db.purchaseInvoice.count({
        where: { company_id: A.company.id },
      });
    try {
      await db.companyConfiguration.update({
        where: { company_id: A.company.id },
        data: {
          shop_feature_settings: {
            ...(config.shop_feature_settings as object),
            MULTI_UNIT: false,
          },
        },
      });
      await api('post', '/' + job.id + '/confirm')
        .send({
          acknowledge_effects: true,
          supplier_id: supplier.id,
          invoice_number: 'PACK-3',
          invoice_date: date,
          payment_status: 'CREDIT',
        })
        .expect(400);
      expect(
        await db.purchaseInvoice.count({ where: { company_id: A.company.id } }),
      ).toBe(before);
    } finally {
      await db.companyConfiguration.update({
        where: { company_id: A.company.id },
        data: { shop_feature_settings: config.shop_feature_settings as any },
      });
    }
    await api('post', '/' + job.id + '/cancel').expect(201);
  });

  it('imports more than 500 rows in resumable batches with no repeated new items', async () => {
    const csv =
      'Name,Selling Price,Unit\n' +
      Array.from({ length: 501 }, (_, i) => 'Catalog ' + i + ',10,PCS').join(
        '\n',
      );
    let job = (
      await api('post', '/spreadsheet')
        .attach('file', Buffer.from(csv), { filename: 'large.csv' })
        .expect(201)
    ).body;
    expect(job.counts.READY).toBe(501);
    for (let n = 0; n < 21; n++)
      job = (
        await api('post', '/' + job.id + '/confirm')
          .set('Idempotency-Key', randomUUID())
          .send({ acknowledge_effects: true })
          .expect((r) => expect(r.status, JSON.stringify(r.body)).toBe(201))
      ).body;
    expect(job.status).toBe('CONFIRMED');
    expect(job.counts.IMPORTED).toBe(501);
    expect(
      await db.item.count({
        where: { company_id: A.company.id, name: { startsWith: 'Catalog ' } },
      }),
    ).toBe(501);
    await api('post', '/' + job.id + '/confirm')
      .send({ acknowledge_effects: true })
      .expect(201);
    expect(
      await db.item.count({
        where: { company_id: A.company.id, name: { startsWith: 'Catalog ' } },
      }),
    ).toBe(501);
  }, 120000);
});
