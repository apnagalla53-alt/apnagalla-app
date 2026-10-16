import { Test } from '@nestjs/testing';
import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { businessDate } from '../src/common/business-date';

describe('Zero-setup simplicity: actual HTTP and authoritative journals', () => {
  let app: INestApplication,
    db: PrismaService,
    A: any,
    B: any,
    token: string,
    other: string,
    item: any,
    customer: any,
    bill: any;
  let maintenance: PrismaClient, originalUrl: string, runtimeRole: string;
  const password = 'DisposableSimplicity!' + randomUUID(),
    date = businessDate();
  const call = (method: string, path: string, shop = A, t = token) =>
    (request(app.getHttpServer()) as any)
      [method]('/api/v1/' + path)
      .set('Authorization', 'Bearer ' + t)
      .set('X-Company-Id', shop.company.id)
      .set('X-Branch-Id', shop.branch.id)
      .set('X-Financial-Year-Id', shop.financialYear.id);
  beforeAll(async () => {
    originalUrl = process.env.DATABASE_URL!;
    const url = new URL(originalUrl);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw Error('Dedicated disposable database required');
    // Exercise the same tenant policies as the real API, rather than bypassing
    // row security with the disposable migration owner's privileges.
    maintenance = new PrismaClient({ datasources: { db: { url: originalUrl } } });
    runtimeRole = 'evx_bulk_' + randomUUID().replace(/-/g, '');
    const runtimePassword = randomBytes(32).toString('hex');
    await maintenance.$executeRawUnsafe(`CREATE ROLE "${runtimeRole}" LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
    await maintenance.$executeRawUnsafe(`GRANT "${runtimeRole}" TO CURRENT_USER WITH INHERIT TRUE`);
    await maintenance.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${runtimeRole}"`);
    await maintenance.$executeRawUnsafe(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO "${runtimeRole}"`);
    await maintenance.$executeRawUnsafe(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO "${runtimeRole}"`);
    url.username = runtimeRole;
    url.password = runtimePassword;
    process.env.DATABASE_URL = url.toString();
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
      organizationName: 'Simplicity A ' + randomUUID(),
      adminName: 'Disposable Owner',
      adminEmail: randomUUID() + '@test.invalid',
      adminPassword: password,
      businessType: 'GROCERY',
    });
    B = await provision.provisionTenant({
      planId,
      organizationName: 'Simplicity B ' + randomUUID(),
      adminName: 'Disposable Owner',
      adminEmail: randomUUID() + '@test.invalid',
      adminPassword: password,
      businessType: 'PHARMACY',
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
  }, 60000);
  afterAll(async () => {
    await app?.close();
    process.env.DATABASE_URL = originalUrl;
    if (maintenance) {
      if (runtimeRole) {
        await maintenance.$executeRawUnsafe(`DROP OWNED BY "${runtimeRole}"`);
        await maintenance.$executeRawUnsafe(`DROP ROLE "${runtimeRole}"`);
      }
      await maintenance.$disconnect();
    }
  });
  it('starts with no ordinary items or parties and returns the saved business preset', async () => {
    expect((await call('get', 'retail/items').expect(200)).body).toEqual([]);
    expect(
      await db.party.count({
        where: { company_id: A.company.id, is_walkin: false },
      }),
    ).toBe(0);
    const data = (await call('get', 'retail/account/subscription').expect(200))
      .body;
    const home = (await call('get', 'retail/account/experience').expect(200))
      .body;
    expect(home.maturity).toBe('NEW');
    expect(home.activity.sales).toBe(0);
    expect(home.suggestions).toEqual([]);
    expect(data.business_preset.key).toBe('GROCERY');
    expect(data.business_preset.recommendedUnits).toContain('PKT');
  });
  it('creates an inline item once even when simultaneous network retries use the same key', async () => {
    const key = randomUUID(),
      body = {
        name: 'Parle-G',
        selling_price: 10,
        inventory_tracking: false,
        unit_code: 'PKT',
      };
    const rows = await Promise.all(
      [1, 2, 3].map(() =>
        call('post', 'retail/items/inline')
          .set('Idempotency-Key', key)
          .send(body)
          .expect(201),
      ),
    );
    item = rows[0].body;
    expect(new Set(rows.map((r) => r.body.id)).size).toBe(1);
    expect(item.inventory_tracking).toBe(false);
    expect(
      await db.item.count({
        where: { company_id: A.company.id, name: 'Parle-G' },
      }),
    ).toBe(1);
    await call('post', 'retail/items/inline')
      .set('Idempotency-Key', key)
      .send({ ...body, selling_price: 12 })
      .expect(409);
  });
  it('makes a valid first cash bill of two packets without invented stock or cost', async () => {
    const key = randomUUID(),
      body = {
        items: [{ item_id: item.id, quantity: 2, rate: 10 }],
        payment_splits: [{ method: 'CASH', amount: 20 }],
        date,
      };
    const first = await call('post', 'retail/bills')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);
    bill = first.body;
    const repeated = await call('post', 'retail/bills')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);
    expect(repeated.body.id).toBe(bill.id);
    expect(Number(bill.grand_total)).toBe(20);
    expect(Number(bill.outstanding_amount)).toBe(0);
    expect(
      await db.stockMovement.count({
        where: { company_id: A.company.id, item_id: item.id },
      }),
    ).toBe(0);
    const journal = await db.voucher.findMany({
      where: {
        company_id: A.company.id,
        source_document_id: bill.id,
        status: 'POSTED',
      },
      include: { lines: true },
    });
    expect(journal.length).toBeGreaterThan(0);
    for (const entry of journal)
      expect(
        entry.lines.reduce(
          (sum, l) => sum + Number(l.debit) - Number(l.credit),
          0,
        ),
      ).toBeCloseTo(0, 6);
    const report = (
      await call(
        'get',
        'retail/reports/financial/summary?from=' + date + '&to=' + date,
      ).expect(200)
    ).body;
    expect(Number(report.cost_coverage)).toBe(0);
    const low = (await call('get', 'retail/items?stock_status=out').expect(200))
      .body;
    expect(low.some((r: any) => r.id === item.id)).toBe(false);
  });
  it('creates a customer in the transaction and records actual Udhar in Khata', async () => {
    customer = (
      await call('post', 'retail/customers')
        .set('Idempotency-Key', randomUUID())
        .send({ name: 'New credit customer', credit_allowed: true })
        .expect(201)
    ).body;
    const credit = (
      await call('post', 'retail/bills')
        .set('Idempotency-Key', randomUUID())
        .send({
          items: [{ item_id: item.id, quantity: 1, rate: 10 }],
          customer_id: customer.id,
          payment_splits: [],
          date,
        })
        .expect(201)
    ).body;
    expect(Number(credit.outstanding_amount)).toBe(10);
    const khata = (
      await call('get', 'retail/customers/' + customer.id + '/khata').expect(
        200,
      )
    ).body;
    expect(Number(khata.balance)).toBe(10);
  });
  it('ranks real suggestions, limits them to three, and isolates an empty second shop', async () => {
    const home = (await call('get', 'retail/account/experience').expect(200))
      .body;
    expect(home.maturity).toBe('LEARNING');
    expect(home.suggestions.length).toBeLessThanOrEqual(3);
    expect(
      home.suggestions.some(
        (r: any) => r.kind === 'CUSTOMER_DUE' && r.facts.amount === 10,
      ),
    ).toBe(true);
    expect(
      home.suggestions.some(
        (r: any) =>
          r.kind === 'UNKNOWN_COST_FREQUENT_ITEM' ||
          r.kind === 'UNKNOWN_STOCK_FREQUENT_ITEM',
      ),
    ).toBe(true);
    const hidden = home.suggestions.find((r: any) => !r.critical);
    if (hidden) {
      const snoozed = (
        await call(
          'get',
          'retail/account/experience?dismissed=' +
            encodeURIComponent(hidden.id),
        ).expect(200)
      ).body;
      expect(snoozed.suggestions.some((r: any) => r.id === hidden.id)).toBe(
        false,
      );
    }
    const isolated = (
      await call('get', 'retail/account/experience', B, other).expect(200)
    ).body;
    expect(isolated.maturity).toBe('NEW');
    expect(isolated.suggestions).toEqual([]);
  });
  it('keeps bulk rows atomic on a duplicate SKU and makes successful retries safe', async () => {
    const before = await db.item.count({ where: { company_id: A.company.id } }),
      sku = 'BULK-' + randomUUID();
    const rows = [
      { name: 'Bulk first', sku, selling_price: 12, inventory_tracking: false },
      {
        name: 'Bulk duplicate',
        sku,
        selling_price: 15,
        inventory_tracking: false,
      },
    ];
    const failure = await call('post', 'retail/items/bulk')
      .set('Idempotency-Key', randomUUID())
      .send({ items: rows })
      .expect(400);
    expect(failure.body.row_index).toBe(1);
    expect(await db.item.count({ where: { company_id: A.company.id } })).toBe(
      before,
    );
    rows[1].sku += '-2';
    const key = randomUUID(),
      first = (
        await call('post', 'retail/items/bulk')
          .set('Idempotency-Key', key)
          .send({ items: rows })
          .expect(201)
      ).body;
    const repeated = (
      await call('post', 'retail/items/bulk')
        .set('Idempotency-Key', key)
        .send({ items: rows })
        .expect(201)
    ).body;
    expect(repeated).toEqual(first);
    expect(first.count).toBe(2);
  });
  it('saves the bulk editor payload with price-only items and unknown-cost opening stock', async () => {
    const response = await call('post', 'retail/items/bulk')
      .set('Idempotency-Key', randomUUID())
      .send({ items: [
        { name: 'Bulk uncounted item', selling_price: 12, unit_code: 'PCS', unit_name: 'Pieces', selling_mode: 'PIECE', inventory_tracking: false },
        { name: 'Bulk counted item', selling_price: 25, unit_code: 'PCS', unit_name: 'Pieces', selling_mode: 'PIECE', inventory_tracking: true, opening_stock: 4, skip_opening_cost: true },
      ] })
      .expect(201);
    expect(response.body.count).toBe(2);
    const [uncounted, counted] = response.body.items;
    expect(uncounted.inventory_tracking).toBe(false);
    expect(counted.current_stock).toBe(4);
    const cost = await db.inventoryCostState.findFirstOrThrow({ where: { company_id: A.company.id, item_id: counted.id } });
    expect(Number(cost.unknown_quantity)).toBe(4);
    expect(Number(cost.known_value)).toBe(0);
    const options = (await call('get', 'retail/items/' + counted.id + '/options').expect(200)).body;
    expect(options.primary_unit.code).toBe('PCS');
  });
  it('rejects overflowing bulk numbers as helpful validation errors without saving any rows', async () => {
    const before = await db.item.count({ where: { company_id: A.company.id } });
    for (const field of ['opening_stock', 'selling_price', 'opening_cost', 'purchase_price', 'mrp', 'low_stock_threshold']) {
      const response = await call('post', 'retail/items/bulk')
        .set('Idempotency-Key', randomUUID())
        .send({ items: [
          { name: 'Must not be partially saved', selling_price: 10, inventory_tracking: false },
          { name: 'Correct the large number', selling_price: 20, opening_stock: 1, [field]: 1_000_000_000 },
        ] })
        .expect(400);
      expect(response.body.message.join(' ')).toContain('too large');
      expect(await db.item.count({ where: { company_id: A.company.id } })).toBe(before);
    }
  });
  it('creates purchase packs explicitly and posts their actual cost and supplier due', async () => {
    await call('post', 'retail/account/features/MULTI_UNIT')
      .send({ enabled: true })
      .expect(201);
    const packed = (
      await call('post', 'retail/items/inline')
        .set('Idempotency-Key', randomUUID())
        .send({
          name: 'Purchase soap',
          selling_price: 20,
          inventory_tracking: false,
          unit_code: 'PCS',
          purchase_unit_code: 'BOX',
          purchase_unit_factor: 24,
        })
        .expect(201)
    ).body;
    const supplier = (
      await call('post', 'retail/suppliers')
        .set('Idempotency-Key', randomUUID())
        .send({ name: 'Inline purchase supplier' })
        .expect(201)
    ).body;
    const purchase = (
      await call('post', 'retail/purchases')
        .set('Idempotency-Key', randomUUID())
        .send({
          supplier_id: supplier.id,
          payment_status: 'CREDIT',
          purchase_date: date,
          lines: [
            {
              item_id: packed.id,
              unit_id: packed.purchase_unit_id,
              quantity: 1,
              purchase_rate: 240,
            },
          ],
        })
        .expect(201)
    ).body;
    expect(Number(purchase.grand_total)).toBe(240);
    const stock = await db.stockBalanceProjection.findMany({
      where: { company_id: A.company.id, item_id: packed.id },
    });
    expect(stock.reduce((sum, r) => sum + Number(r.quantity), 0)).toBe(24);
    const pool = await db.inventoryCostState.findFirstOrThrow({
      where: { company_id: A.company.id, item_id: packed.id },
    });
    expect(Number(pool.known_value)).toBe(240);
    expect(Number(pool.unknown_quantity)).toBe(0);
    expect(
      (await db.item.findUniqueOrThrow({ where: { id: packed.id } }))
        .inventory_tracking,
    ).toBe(true);
    const sale = (
      await call('post', 'retail/bills')
        .set('Idempotency-Key', randomUUID())
        .send({
          items: [{ item_id: packed.id, quantity: 2, rate: 20 }],
          payment_splits: [{ method: 'CASH', amount: 40 }],
          date,
        })
        .expect(201)
    ).body;
    expect(Number(sale.grand_total)).toBe(40);
    const after = await db.inventoryCostState.findFirstOrThrow({
      where: { company_id: A.company.id, item_id: packed.id },
    });
    expect(Number(after.quantity)).toBe(22);
    expect(Number(after.known_value)).toBe(220);
    const historical = await db.salesInvoiceLine.findMany({
      where: { sales_invoice_id: bill.id },
    });
    expect(historical.every((l) => l.cost_status !== 'KNOWN')).toBe(true);
    const khata = (
      await call('get', 'retail/suppliers/' + supplier.id + '/khata').expect(
        200,
      )
    ).body;
    expect(Number(khata.balance)).toBe(240);
  });
  it('does not grant paid pack conversions through a preset or an inline write', async () => {
    const starter = await app.get(TenantProvisioningService).provisionTenant({
      planId: (await db.plan.findUniqueOrThrow({ where: { code: 'STARTER' } }))
        .id,
      organizationName: 'Simplicity Starter ' + randomUUID(),
      adminName: 'Disposable Owner',
      adminEmail: randomUUID() + '@test.invalid',
      adminPassword: password,
      businessType: 'PHARMACY',
    });
    const login = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: starter.user.username, password })
        .expect(200)
    ).body;
    const before = await db.item.count({
      where: { company_id: starter.company.id },
    });
    await call('post', 'retail/items/inline', starter, login.access_token)
      .set('Idempotency-Key', randomUUID())
      .send({
        name: 'Restricted pack',
        selling_price: 10,
        inventory_tracking: false,
        unit_code: 'PCS',
        purchase_unit_code: 'BOX',
        purchase_unit_factor: 10,
      })
      .expect(403);
    expect(
      await db.item.count({ where: { company_id: starter.company.id } }),
    ).toBe(before);
  });
  it('accepts only numeric experience measurements, deduplicates events and scopes metrics', async () => {
    const event = {
      event_id: randomUUID(),
      event: 'inline_item_created',
      workflow: 'BILL',
      count: 1,
    };
    await call('post', 'retail/account/experience/events')
      .send(event)
      .expect(201);
    await call('post', 'retail/account/experience/events')
      .send(event)
      .expect(201);
    await call('post', 'retail/account/experience/events')
      .send({ ...event, event_id: randomUUID(), customer_name: 'Not allowed' })
      .expect(400);
    const metrics = (
      await call('get', 'retail/account/experience/metrics').expect(200)
    ).body;
    expect(metrics.events.inline_item_created).toBe(1);
    expect(metrics.intake).toEqual([]);
    expect(metrics.time_to_first_item_ms).toBeGreaterThanOrEqual(0);
    expect(metrics.time_to_first_bill_ms).toBeGreaterThanOrEqual(0);
    const otherMetrics = (
      await call('get', 'retail/account/experience/metrics', B, other).expect(
        200,
      )
    ).body;
    expect(otherMetrics.events.inline_item_created).toBeUndefined();
    expect(otherMetrics.time_to_first_bill_ms).toBeNull();
  });
  it('rejects a foreign inline item/customer in another shop without posting', async () => {
    const before = await db.salesInvoice.count({
      where: { company_id: B.company.id },
    });
    await call('post', 'retail/bills', B, other)
      .set('Idempotency-Key', randomUUID())
      .send({
        items: [{ item_id: item.id, quantity: 1, rate: 10 }],
        customer_id: customer.id,
        payment_splits: [],
        date,
      })
      .expect(400);
    expect(
      await db.salesInvoice.count({ where: { company_id: B.company.id } }),
    ).toBe(before);
  });
});
