import { Test } from '@nestjs/testing';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { gstChecksum } from '../src/retail/gst/gst-rules';
import { businessDate } from '../src/common/business-date';

describe('GST invoices: real HTTP, saved tax, numbering, isolation and ledger integrity', () => {
  let app: INestApplication, db: PrismaService, A: any, B: any, tokenA: string, tokenB: string;
  let item: any, bill: any, otherBill: any, issued: any;
  const drafts = new Map<string, any>();
  const suffix = randomUUID(), password = 'Disposable!Gst926';
  const gstin = (code: string) => code + 'AAPFU0939F1Z' + gstChecksum(code + 'AAPFU0939F1Z');
  const profile = (code = '27', extra: any = {}) => ({ legal_name: 'GST Test Shop', trade_name: 'GST Retail', address: '12 Market Road, Pune 411001', state_code: code,
    gstin: gstin(code), invoice_prefix: 'GST', hsn_digits: 6, electronic_reporting: 'NOT_REQUIRED', regular_registration: true, signatory: 'Test Owner', terms: 'Test-only invoice', ...extra });
  const call = (method: string, path: string, shop = A, token = tokenA) => (request(app.getHttpServer()) as any)[method]('/api/v1/retail/' + path)
    .set('Authorization', 'Bearer ' + token).set('X-Company-Id', shop.company.id).set('X-Branch-Id', shop.branch.id).set('X-Financial-Year-Id', shop.financialYear.id);
  const sale = async (product = item, quantity = 1, rate = 100, extra: any = {}, shop = A, token = tokenA) => {
    const dto = { items: [{ item_id: product.id, quantity, rate, ...extra }], payment_splits: [] };
    const quote = (await call('post', 'bills/quote', shop, token).send(dto).expect(201)).body;
    return (await call('post', 'bills', shop, token).send({ ...dto, payment_splits: [{ method: 'CASH', amount: Number(quote.grand_total) }] }).expect(201)).body;
  };
  const payload = async (id = bill.id, state = '27', shop = A, token = tokenA) => {
    const response = (await call('get', 'gst/bills/' + id, shop, token).expect(200)).body;
    if (!response.issued) drafts.set(id, response);
    const draft = response.issued ? drafts.get(id) : response;
    return { recipient: { name: 'Test Customer', address: '48 Customer Lane, India', state_code: state, delivery_address: '48 Customer Lane, India', delivery_state_code: state },
      place_of_supply: state, reverse_charge: false, lines: draft.lines.map(({ line_id, description, hsn, uqc }: any) => ({ line_id, description, hsn, uqc })), confirmed: true, no_previous_gst_invoice: true };
  };
  const facts = async (id = bill.id) => ({
    sale: await db.salesInvoice.findUniqueOrThrow({ where: { id }, include: { lines: true } }),
    stock: await db.stockMovement.count({ where: { company_id: A.company.id } }),
    balances: await db.stockBalanceProjection.findMany({ where: { company_id: A.company.id }, orderBy: { id: 'asc' } }),
    journals: await db.voucher.findMany({ where: { company_id: A.company.id }, include: { lines: true }, orderBy: { id: 'asc' } }),
    allocations: await db.billAllocation.findMany({ where: { company_id: A.company.id }, orderBy: { id: 'asc' } }),
  });
  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: [{ path: 'api/v1/{*path}', method: RequestMethod.ALL }] });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init(); db = app.get(PrismaService);
    const provision = async (name: string) => app.get(TenantProvisioningService).provisionTenant({planId:(await db.plan.findUniqueOrThrow({where:{code:'SMART'}})).id, organizationName: name, adminName: 'GST Owner', adminEmail: name + '@test.invalid', adminPassword: password });
    A = await provision('gst-a-' + suffix); B = await provision('gst-b-' + suffix);
    tokenA = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: A.user.username, password }).expect(200)).body.access_token;
    tokenB = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: B.user.username, password }).expect(200)).body.access_token;
    const features = await db.feature.findMany({ where: { code: { in: ['WEIGHT', 'AREA', 'MULTI_UNIT', 'SERVICES'] } } });
    await db.tenantEntitlement.createMany({ data: features.map(feature => ({ organization_id: A.organization.id, feature_id: feature.id, is_enabled: true })), skipDuplicates: true });
    item = (await call('post', 'items').send({ name: 'GST Shirt', selling_price: 100, opening_stock: 30, opening_cost: 40, gst_rate: 18, hsn_sac: '620520' }).expect(201)).body;
    bill = await sale(item, 2, 100, { discount_amount: 20 });
    const otherItem = (await call('post', 'items', B, tokenB).send({ name: 'Other GST Shirt', selling_price: 100, inventory_tracking: false, gst_rate: 18, hsn_sac: '620520' }).expect(201)).body;
    otherBill = await sale(otherItem, 1, 100, {}, B, tokenB);
  }, 60000);
  // These fixtures live exclusively in the disposable database protected by vitest.config.e2e.ts.
  afterAll(async () => { await app?.close(); });

  it('starts unconfigured and never invents an approved GST registration', async () => {
    const response = (await call('get', 'gst/profile').expect(200)).body;
    expect(response.profile).toBeNull(); expect(response.defaults.electronic_reporting).toBe('UNSURE');
    expect(response.registration_verification).toBe('FORMAT_AND_CHECKSUM_ONLY'); expect(response.electronic_provider).toBe('NOT_CONFIGURED');
    expect(gstin('27')).toBe('27AAPFU0939F1ZV');
    const dto = await payload();
    await call('post', 'gst/bills/' + bill.id + '/preview').send(dto).expect(400);
  });
  it('rejects invalid GSTIN, state, composition registration and mass assignment', async () => {
    for (const data of [profile('27', { gstin: '27AAPFU0939F1Z0' }), profile('27', { state_code: '29' }), profile('25'), profile('27', { regular_registration: false })])
      await call('put', 'gst/profile').send(data).expect(400);
    await call('put', 'gst/profile').send(profile('27', { company_id: B.company.id })).expect(403);
    expect((await call('get', 'gst/profile').expect(200)).body.profile).toBeNull();
  });
  it('saves and reloads business details without overwriting unrelated payment settings', async () => {
    const configuration = await db.companyConfiguration.findUnique({ where: { company_id: A.company.id } });
    const prior: any = configuration?.tax_configuration || {};
    await db.companyConfiguration.upsert({ where: { company_id: A.company.id }, create: { company_id: A.company.id, tax_configuration: { ...prior, payment_voice: { enabled: true }, primary_upi: 'private@test' } }, update: { tax_configuration: { ...prior, payment_voice: { enabled: true }, primary_upi: 'private@test' } } });
    await call('put', 'gst/profile').send(profile()).expect(200);
    expect((await call('get', 'gst/profile').expect(200)).body.profile).toEqual(profile());
    const saved: any = (await db.companyConfiguration.findUniqueOrThrow({ where: { company_id: A.company.id } })).tax_configuration;
    expect(saved.primary_upi).toBe('private@test'); expect(saved.payment_voice.enabled).toBe(true);
    await call('put', 'gst/profile', B, tokenB).send(profile('04')).expect(200);
  });
  it('lists bounded searchable past bills without exposing another tenant', async () => {
    const response = (await call('get', 'gst/bills?limit=1&search=' + encodeURIComponent(bill.document_number)).expect(200)).body;
    expect(response.data).toHaveLength(1); expect(response.data[0].id).toBe(bill.id);
    expect((await call('get', 'gst/bills?search=' + encodeURIComponent(otherBill.document_number)).expect(200)).body.data).toEqual([]);
    for (const query of ['limit=101', 'limit=1.5', 'offset=-1', 'limit=NaN', 'from=bad']) await call('get', 'gst/bills?' + query).expect(400);
  });
  it('previews saved discounts, CGST and SGST while all accounting and inventory stay unchanged', async () => {
    const before = JSON.stringify(await facts());
    const dto = await payload();
    const snapshot = (await call('post', 'gst/bills/' + bill.id + '/preview').send(dto).expect(201)).body.snapshot;
    expect(snapshot.document_number).toBeNull(); expect(snapshot.issue_date).toBe(businessDate());
    expect(snapshot.supply_kind).toBe('GOODS');
    expect(snapshot.totals).toMatchObject({ taxable: '180.00', cgst: '16.20', local: '16.20', igst: '0.00', tax: '32.40', grand_total: '212.40' });
    expect(snapshot.lines[0]).toMatchObject({ quantity: '2', net_rate: '90.000000', hsn: '620520', uqc: 'PCS', discount: '20.00' });
    expect(JSON.stringify(await facts())).toBe(before);
    expect(JSON.stringify(snapshot)).not.toMatch(/password_hash|cogs_total|cost_rate/);
  });
  it('uses IGST for interstate place of supply and checks recipient GSTIN independently', async () => {
    const dto = await payload(bill.id, '29');
    const snapshot = (await call('post', 'gst/bills/' + bill.id + '/preview').send(dto).expect(201)).body.snapshot;
    expect(snapshot.interstate).toBe(true); expect(snapshot.totals).toMatchObject({ igst: '32.40', cgst: '0.00', local: '0.00' });
    await call('post', 'gst/bills/' + bill.id + '/preview').send({ ...dto, recipient: { ...dto.recipient, gstin: gstin('27') } }).expect(400);
  });
  it('uses UTGST in a union territory with the same posted total', async () => {
    const dto = await payload(otherBill.id, '04', B, tokenB);
    const snapshot = (await call('post', 'gst/bills/' + otherBill.id + '/preview', B, tokenB).send(dto).expect(201)).body.snapshot;
    expect(snapshot.local_tax_name).toBe('UTGST'); expect(snapshot.totals.local).toBe('9.00'); expect(snapshot.totals.cgst).toBe('9.00');
  });
  it('does not use a changed current tax class to rewrite the past bill', async () => {
    const product = await db.item.findUniqueOrThrow({ where: { id: item.id } });
    await db.taxClass.update({ where: { id: product.tax_class_id! }, data: { tax_rate: 28, hsn_code: '999999' } });
    const dto = await payload();
    const snapshot = (await call('post', 'gst/bills/' + bill.id + '/preview').send(dto).expect(201)).body.snapshot;
    expect(snapshot.lines[0].rate).toBe('18'); expect(snapshot.lines[0].hsn).toBe('620520'); expect(snapshot.totals.tax).toBe('32.40');
    await db.taxClass.update({ where: { id: product.tax_class_id! }, data: { tax_rate: 18, hsn_code: '620520' } });
  });
  it('rejects missing/foreign/duplicate line IDs, malformed HSN and unrecognized UQC', async () => {
    const dto = await payload();
    for (const lines of [[], [{ ...dto.lines[0], line_id: randomUUID() }], [...dto.lines, dto.lines[0]], [{ ...dto.lines[0], hsn: '12345' }], [{ ...dto.lines[0], hsn: '1234' }], [{ ...dto.lines[0], uqc: 'BAD' }], [{ ...dto.lines[0], rate: 0 }]])
      await call('post', 'gst/bills/' + bill.id + '/preview').send({ ...dto, lines }).expect(400);
    await call('post', 'gst/bills/' + bill.id + '/preview').send({ ...dto, recipient: undefined }).expect(400);
    await call('post', 'gst/bills/' + bill.id + '/preview').send({ ...dto, recipient: { ...dto.recipient, name: '  ' } }).expect(400);
  });
  it('blocks unsupported reverse-charge and uncertain/required government reporting', async () => {
    const dto = await payload();
    await call('post', 'gst/bills/' + bill.id + '/preview').send({ ...dto, reverse_charge: true }).expect(400);
    for (const electronic_reporting of ['UNSURE', 'REQUIRED']) {
      await call('put', 'gst/profile').send(profile('27', { electronic_reporting })).expect(200);
      await call('post', 'gst/bills/' + bill.id + '/issue').send(dto).expect(400);
    }
    await call('put', 'gst/profile').send(profile()).expect(200);
    expect(await db.retailGstSequence.count({ where: { company_id: A.company.id } })).toBe(0);
  });
  it('refuses missing historical tax, unposted bills and a closed issue financial year', async () => {
    const dto = await payload(), line = await db.salesInvoiceLine.findFirstOrThrow({ where: { sales_invoice_id: bill.id } });
    await db.salesInvoiceLine.update({ where: { id: line.id }, data: { tax_snapshot_json: null } });
    await call('post', 'gst/bills/' + bill.id + '/preview').send(dto).expect(400);
    await db.salesInvoiceLine.update({ where: { id: line.id }, data: { tax_snapshot_json: line.tax_snapshot_json } });
    await db.salesInvoice.update({ where: { id: bill.id }, data: { status: 'DRAFT' } });
    await call('post', 'gst/bills/' + bill.id + '/preview').send(dto).expect(400);
    await db.salesInvoice.update({ where: { id: bill.id }, data: { status: 'POSTED' } });
    await db.financialYear.update({ where: { id: A.financialYear.id }, data: { is_closed: true } });
    await call('post', 'gst/bills/' + bill.id + '/issue').send(dto).expect(400);
    await db.financialYear.update({ where: { id: A.financialYear.id }, data: { is_closed: false } });
  });
  it('never adds retrospective GST to untaxed bills or amount-only sales', async () => {
    const product = (await call('post', 'items').send({ name: 'No GST', selling_price: 100, inventory_tracking: false, hsn_sac: '620520' }).expect(201)).body;
    const untaxed = await sale(product);
    const dto = await payload(untaxed.id); dto.lines[0].hsn = '620520';
    await call('post', 'gst/bills/' + untaxed.id + '/preview').send(dto).expect(400);
    const quick = (await call('post', 'bills/amount-sale').send({ amount: 100, payment_method: 'CASH' }).expect(201)).body;
    const quickDto = await payload(quick.id); quickDto.lines[0].hsn = '998599';
    await call('post', 'gst/bills/' + quick.id + '/issue').send(quickDto).expect(400);
    expect(await db.retailGstInvoice.count({ where: { company_id: A.company.id } })).toBe(0);
  });
  it('requires explicit confirmation before allocating a statutory invoice number', async () => {
    const dto = await payload();
    for (const data of [{ ...dto, confirmed: false }, { ...dto, no_previous_gst_invoice: false }]) await call('post', 'gst/bills/' + bill.id + '/issue').send(data).expect(400);
    expect(await db.retailGstSequence.count({ where: { company_id: A.company.id } })).toBe(0);
  });
  it('allows small unregistered walk-in bills without inventing an address and requires it for registered or larger bills', async () => {
    const dto = await payload(); dto.recipient.address = ''; dto.recipient.delivery_address = '';
    const snapshot = (await call('post', 'gst/bills/' + bill.id + '/preview').send(dto).expect(201)).body.snapshot;
    expect(snapshot.recipient.address).toBe('');
    await call('post', 'gst/bills/' + bill.id + '/preview').send({ ...dto, recipient: { ...dto.recipient, gstin: gstin('27') } }).expect(400);
    const product = (await call('post', 'items').send({ name: 'Large taxed bill', selling_price: 50000, inventory_tracking: false, gst_rate: 18, hsn_sac: '620520' }).expect(201)).body;
    const sold = await sale(product, 1, 50000), largeDto = await payload(sold.id); largeDto.recipient.address = ''; largeDto.recipient.delivery_address = '';
    await call('post', 'gst/bills/' + sold.id + '/preview').send(largeDto).expect(400);
  });
  it('concurrent issue/retry creates exactly one immutable document without reposting the sale', async () => {
    const dto = await payload(), before = JSON.stringify(await facts());
    const responses = await Promise.all([1, 2, 3].map(() => call('post', 'gst/bills/' + bill.id + '/issue').send(dto)));
    expect(responses.map(response => response.status)).toEqual([201, 201, 201]);
    issued = responses[0].body; expect(responses.every(response => response.body.id === issued.id)).toBe(true);
    const date = businessDate(), start = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 4 ? 1 : 0);
    expect(issued.document_number).toBe('GST/' + String(start).slice(2) + String(start + 1).slice(2) + '/000001');
    expect(issued.document_number.length).toBeLessThanOrEqual(16);
    expect(await db.retailGstInvoice.count({ where: { sales_invoice_id: bill.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { company_id: A.company.id, action: 'GST_INVOICE_ISSUED' } })).toBe(1);
    expect(JSON.stringify(await facts())).toBe(before);
  });
  it('issued details survive later profile/item edits and a retry with changed recipient data', async () => {
    await call('put', 'gst/profile').send(profile('27', { trade_name: 'Renamed Shop', address: 'Updated Registered Address' })).expect(200);
    const saved = (await call('get', 'gst/bills/' + bill.id).expect(200)).body.issued;
    expect(saved.snapshot.supplier.trade_name).toBe('GST Retail'); expect(saved.snapshot.supplier.address).toBe('12 Market Road, Pune 411001');
    const dto = { recipient: { name: 'Different', address: 'Other Address', state_code: '29', delivery_address: 'Other Address', delivery_state_code: '29' }, place_of_supply: '29', reverse_charge: false, lines: [{ line_id: randomUUID(), hsn: '620520', description: 'Different', uqc: 'PCS' }], confirmed: true, no_previous_gst_invoice: true };
    expect((await call('post', 'gst/bills/' + bill.id + '/issue').send(dto).expect(201)).body.snapshot).toEqual(issued.snapshot);
    for (const data of [profile('29'), profile('27', { invoice_prefix: 'NEW' })]) await call('put', 'gst/profile').send(data).expect(400);
  });
  it('concurrent different bills receive consecutive unique numbers within the financial year', async () => {
    const bills = await Promise.all([1, 2].map(() => sale()));
    const dtos = await Promise.all(bills.map(b => payload(b.id)));
    const documents = await Promise.all(bills.map((b, i) => call('post', 'gst/bills/' + b.id + '/issue').send(dtos[i]).expect(201)));
    expect(documents.map(d => Number(d.body.document_number.split('/').at(-1))).sort()).toEqual([2, 3]);
    expect(new Set(documents.map(d => d.body.document_number)).size).toBe(2);
  });
  it('explicit cross-tenant GET and POST attacks cannot read or issue foreign documents', async () => {
    const dto = await payload(otherBill.id, '04', B, tokenB);
    await call('post', 'gst/bills/' + otherBill.id + '/issue', B, tokenB).send(dto).expect(201);
    for (const [path, method] of [['gst/bills/' + bill.id, 'get'], ['gst/bills/' + bill.id + '/preview', 'post'], ['gst/bills/' + bill.id + '/issue', 'post']] as const) {
      const attack = call(method, path, B, tokenB); if (method === 'post') attack.send(dto); await attack.expect(404);
    }
    await call('get', 'gst/profile', B, tokenA).expect(403);
    await call('get', 'gst/bills/' + otherBill.id).expect(404);
    expect((await call('get', 'gst/profile', B, tokenB).expect(200)).body.profile.state_code).toBe('04');
  });
  it('read-only staff can view GST invoices but cannot change settings or issue them', async () => {
    const owner = await db.user.findUniqueOrThrow({ where: { id: A.user.id } });
    const permission = await db.permission.findUniqueOrThrow({ where: { code: 'sales.read' } });
    const role = await db.role.create({ data: { organization_id: A.organization.id, name: 'GST Reader ' + suffix, role_permissions: { create: { permission_id: permission.id } } } });
    const staff = await db.user.create({ data: { organization_id: A.organization.id, username: 'gst-reader-' + suffix, display_name: 'Reader', password_hash: owner.password_hash, roles: { create: { role_id: role.id, company_id: A.company.id, branch_id: A.branch.id } } } });
    const staffToken = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: staff.username, password }).expect(200)).body.access_token;
    await call('get', 'gst/profile', A, staffToken).expect(200);
    await call('get', 'gst/bills/' + bill.id, A, staffToken).expect(200);
    await call('put', 'gst/profile', A, staffToken).send(profile()).expect(403);
    const dto = await payload(otherBill.id, '04', B, tokenB);
    await call('post', 'gst/bills/' + bill.id + '/issue', A, staffToken).send(dto).expect(403);
  });
  it('weight, area and alternate units retain the authoritative measured quantity', async () => {
    for (const [name, mode, code, quantity, dimensions, expected, uqc] of [
      ['Loose goods', 'WEIGHT', 'KG', 0.5, undefined, '0.5', 'KGS'],
      ['Sheet', 'AREA', 'SQFT', 2, { length: 2, width: 3 }, '12', 'SQF'],
    ] as const) {
      const product = (await call('post', 'items').send({ name, selling_mode: mode, unit_code: code, inventory_tracking: false, selling_price: 100, gst_rate: 18, hsn_sac: '620520' }).expect(201)).body;
      const sold = await sale(product, quantity, 100, { dimensions });
      const dto = await payload(sold.id);
      const snapshot = (await call('post', 'gst/bills/' + sold.id + '/preview').send(dto).expect(201)).body.snapshot;
      expect(snapshot.lines[0].quantity).toBe(expected); expect(snapshot.lines[0].uqc).toBe(uqc);
    }
    const box = await db.unit.create({ data: { company_id: A.company.id, code: 'GSTBOX', name: 'Box of 12' } });
    await db.itemUnitConversion.create({ data: { item_id: item.id, from_unit_id: box.id, to_unit_id: item.primary_unit_id, conversion_factor: 12 } });
    const packed = await sale(item, 1, 1200, { unit_id: box.id });
    const dto = await payload(packed.id); dto.lines[0].uqc = 'BOX';
    const snapshot = (await call('post', 'gst/bills/' + packed.id + '/preview').send(dto).expect(201)).body.snapshot;
    expect(snapshot.lines[0]).toMatchObject({ quantity: '1', unit: 'GSTBOX', uqc: 'BOX', taxable: '1200.00' });
  });
  it('mixed standard/custom tax rates remain separate HSN/rate groups without changing the total', async () => {
    const products = [];
    for (const rate of [5, 40, 3, 0.25]) products.push((await call('post', 'items').send({ name: 'GST rate ' + rate, selling_price: 100, inventory_tracking: false, gst_rate: rate, hsn_sac: '620520' }).expect(201)).body);
    const sold = (await call('post', 'bills').send({ items: products.map(product => ({ item_id: product.id, quantity: 1, rate: 100 })), payment_splits: [{ method: 'CASH', amount: 448.25 }] }).expect(201)).body;
    const dto = await payload(sold.id);
    const snapshot = (await call('post', 'gst/bills/' + sold.id + '/preview').send(dto).expect(201)).body.snapshot;
    expect(snapshot.summary).toHaveLength(4); expect(snapshot.summary.map((row: any) => Number(row.rate)).sort((a: number, b: number) => a - b)).toEqual([0.25, 3, 5, 40]);
    expect(snapshot.totals).toMatchObject({ taxable: '400.00', tax: '48.25', grand_total: '448.25' });
  });
  it('service SAC and odd-paise tax conserve the original posted total', async () => {
    const service = (await call('post', 'items').send({ name: 'Repairs', selling_mode: 'SERVICE', selling_price: 0.5, gst_rate: 18, hsn_sac: '998599' }).expect(201)).body;
    const sold = await sale(service, 1, 0.5), dto = await payload(sold.id);
    const snapshot = (await call('post', 'gst/bills/' + sold.id + '/preview').send(dto).expect(201)).body.snapshot;
    expect(snapshot.supply_kind).toBe('SERVICES');
    expect(Number(snapshot.totals.cgst) + Number(snapshot.totals.local)).toBeCloseTo(Number(snapshot.totals.tax), 2);
    expect(snapshot.totals.grand_total).toBe('0.59');
    await call('post', 'gst/bills/' + sold.id + '/preview').send({ ...dto, lines: [{ ...dto.lines[0], hsn: '99859900' }] }).expect(400);
    const journals = await db.voucher.findMany({ where: { company_id: A.company.id }, include: { lines: true } });
    for (const journal of journals) expect(journal.lines.reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0)).toBeCloseTo(0, 4);
  });
});
