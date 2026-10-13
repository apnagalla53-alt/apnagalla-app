import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, RequestMethod } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { Prisma } from '@prisma/client';

describe('Retail field coverage, posting and immutable returns (real HTTP/DB)', () => {
  let app: INestApplication, db: PrismaService, shop: any, other: any, token: string;
  let customer: any, supplier: any, item: any, paidPurchase: any, invoice: any;
  const suffix = Date.now(), password = 'TestOnly!Retail092';
  const http = (method: 'get'|'post', path: string) => request(app.getHttpServer())[method]('/api/v1/retail/' + path)
    .set('Authorization', 'Bearer ' + token).set('X-Company-Id', shop.company.id).set('X-Branch-Id', shop.branch.id).set('X-Financial-Year-Id', shop.financialYear.id);
  const due = async (party: any) => (await db.billAllocation.findMany({ where: { company_id: shop.company.id, party_id: party.id } })).reduce((sum, a) => a.allocation_type === 'NEW_REFERENCE' ? sum.plus(a.amount) : sum.minus(a.amount), new Prisma.Decimal(0)).toNumber();
  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: [{ path: 'api/v1/{*path}', method: RequestMethod.ALL }] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init(); db = app.get(PrismaService);
    const provision = async (name: string) => app.get(TenantProvisioningService).provisionTenant({ organizationName: name, adminEmail: name + '@test.invalid', adminName: 'Owner', adminPassword: password });
    shop = await provision('retail-fields-' + suffix); other = await provision('retail-foreign-' + suffix);
    const weightFeature=await db.feature.findUniqueOrThrow({where:{code:'WEIGHT'}});await db.tenantEntitlement.create({data:{organization_id:shop.organization.id,feature_id:weightFeature.id,is_enabled:true}});
    token = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: shop.user.username, password }).expect(200)).body.access_token;
  });
  afterAll(async () => {
    const companyIds = [shop?.company.id, other?.company.id].filter(Boolean);
    if (companyIds.length) {
      const where = { company_id: { in: companyIds } };
      await db.attachment.deleteMany({ where });
      await db.needList.deleteMany({ where });
      await db.auditLog.deleteMany({ where });
      await db.stockMovement.deleteMany({ where });
      await db.stockBalanceProjection.deleteMany({ where });
      await db.billAllocation.deleteMany({ where });
      await db.voucherLine.deleteMany({ where: { voucher: where } });
      await db.voucher.deleteMany({ where });
      await db.salesReturn.deleteMany({ where });
      await db.salesInvoice.deleteMany({ where });
      await db.purchaseInvoice.deleteMany({ where });
      await db.openingStock.deleteMany({ where });
      await db.pricingTrace.deleteMany({ where });
      await db.item.deleteMany({ where });
    }
    await app.close();
  });
  it('persists advanced party fields, creates ledger atomically, searches phone/code and posts opening balance', async () => {
    customer = (await http('post','customers').send({ name: 'Field Customer', mobile: '9850012345', code: 'FC-' + suffix,
      address: 'Main Road', state: 'Maharashtra', gstin: '27ABCDE1234F1Z5', pan: 'ABCDE1234F', email: 'customer@test.invalid',
      opening_balance: 200, credit_allowed: true, credit_days: 15, credit_limit: 10000 }).expect(201)).body;
    expect(customer.phone).toBe('9850012345'); expect(await due(customer)).toBe(200);
    expect((await http('get','customers?search=9850012345').expect(200)).body.some((p:any) => p.id === customer.id)).toBe(true);
    const count = await db.party.count({ where: { company_id: shop.company.id } });
    await http('post','customers').send({ name: 'Bad price list', price_list_id: other.company.id }).expect(400);
    expect(await db.party.count({ where: { company_id: shop.company.id } })).toBe(count);
    supplier = (await http('post','suppliers').send({ name: 'Field Supplier', mobile: '9860098765', nickname: 'Distributor', supplier_category: 'DISTRIBUTOR', credit_days: 20 }).expect(201)).body;
    expect(supplier.nickname).toBe('Distributor'); expect(supplier.credit_days).toBe(20);
    item = (await http('post','items').send({ name: 'Field Stock', selling_price: 100, purchase_price: 50, opening_stock: 10 }).expect(201)).body;
  });
  it('paid and partial purchases post balanced journals, allocations and stock; quick bills never change stock', async () => {
    paidPurchase = (await http('post','purchases').send({ supplier_id: supplier.id, bill_number: 'PAID-' + suffix, payment_status: 'PAID', payment_method: 'UPI',
      note: 'Paid stock receipt', purchase_category: 'ONLINE', lines: [{ item_id: item.id, quantity: 2, purchase_rate: 50 }] }).expect(201)).body;
    expect(Number(paidPurchase.paid_amount)).toBe(100); expect(Number(paidPurchase.outstanding_amount)).toBe(0); expect(await due(supplier)).toBe(0);
    const journal = await db.voucher.findFirst({ where: { source_document_type: 'PURCHASE_INVOICE', source_document_id: paidPurchase.id }, include: { lines: true } });
    expect(journal).toBeTruthy(); expect(journal!.lines.reduce((s,l) => s + Number(l.debit) - Number(l.credit), 0)).toBe(0);
    const before = await db.stockMovement.count({ where: { company_id: shop.company.id } });
    const quick = (await http('post','purchases').send({ supplier_id: supplier.id, total_amount: 300, payment_status: 'PARTIAL', paid_amount: 100, payment_method: 'CARD', bill_number: 'QUICK-' + suffix }).expect(201)).body;
    expect(Number(quick.outstanding_amount)).toBe(200); expect(await due(supplier)).toBe(200);
    expect(await db.stockMovement.count({ where: { company_id: shop.company.id } })).toBe(before);
    await http('post','purchases').send({ supplier_id: supplier.id, total_amount: 300, payment_status: 'PAID', bill_number: 'QUICK-' + suffix }).expect(400);
  });
  it('party settlement rejects overpayment and updates invoices without losing allocations', async () => {
    const before = await db.voucher.count({ where: { company_id: shop.company.id } });
    await http('post', 'suppliers/' + supplier.id + '/payments').send({ amount: 201, payment_method: 'BANK' }).expect(400);
    expect(await db.voucher.count({ where: { company_id: shop.company.id } })).toBe(before);
    await http('post', 'suppliers/' + supplier.id + '/payments').send({ amount: 200, payment_method: 'BANK', date: '2026-10-06', note: 'Settled' }).expect(201);
    expect(await due(supplier)).toBe(0);
    const result = (await http('get','suppliers/' + supplier.id + '/khata').expect(200)).body;
    expect(result.balance).toBe(0); expect(result.transactions.some((t:any) => t.payment_method === 'BANK' && t.note === 'Settled')).toBe(true);
  });
  it('amount-only quick sale and Udhar use POS journals and zero inventory movements', async () => {
    const before = await db.stockMovement.count({ where: { company_id: shop.company.id } });
    const quick = (await http('post','bills/amount-sale').send({ amount: 125, payment_method: 'UPI', note: 'Counter sale' }).expect(201)).body;
    expect(Number(quick.grand_total)).toBe(125); expect(quick.payment_snapshot[0].method).toBe('UPI');
    await http('post','bills/amount-sale').send({ amount: 100, payment_method: 'UDHAR' }).expect(400);
    const credit = (await http('post','bills/amount-sale').send({ amount: 50, payment_method: 'UDHAR', customer_id: customer.id, due_date: '2026-10-25' }).expect(201)).body;
    expect(Number(credit.outstanding_amount)).toBe(50); expect(await due(customer)).toBe(250);
    expect(await db.stockMovement.count({ where: { company_id: shop.company.id } })).toBe(before);
    expect((await http('get','items').expect(200)).body.some((i:any) => i.name === 'Quick Sale')).toBe(false);
  });
  it('tax comes from item tax class and discount snapshot; returns ignore forged rates and cannot exceed sale', async () => {
    const tax = await db.taxClass.create({ data: { company_id: shop.company.id, name: 'GST18', hsn_code: 'TEST', tax_rate: 18, cgst_rate: 9, sgst_rate: 9, igst_rate: 18 } });
    await db.item.update({ where: { id: item.id }, data: { tax_class_id: tax.id } });
    invoice = (await http('post','bills').send({ items: [{ item_id: item.id, quantity: 2, rate: 100, discount_amount: 20 }], payment_splits: [{ method: 'CASH', amount: 212.4 }] }).expect(201)).body;
    expect(Number(invoice.tax_amount)).toBe(32.4); expect(Number(invoice.grand_total)).toBe(212.4);
    const line = (await db.salesInvoiceLine.findFirst({ where: { sales_invoice_id: invoice.id } }))!;
    await db.item.update({ where: { id: item.id }, data: { default_sale_rate: 900, tax_class_id: null } });
    const ret = (await http('post','bills/return').send({ original_invoice_id: invoice.id, refund_method: 'CASH',
      lines: [{ original_line_id: line.id, item_id: item.id, quantity: 1, rate: 9999 }] }).expect(201)).body;
    expect(Number(ret.grand_total)).toBe(106.2); expect(Number(ret.tax_amount)).toBe(16.2);
    expect(await due({ id: invoice.party_id })).toBe(0);
    const before = await db.salesReturn.count({ where: { company_id: shop.company.id } });
    await http('post','bills/return').send({ original_invoice_id: invoice.id, refund_method: 'CASH',
      lines: [{ original_line_id: line.id, item_id: item.id, quantity: 2, rate: 0 }] }).expect(400);
    expect(await db.salesReturn.count({ where: { company_id: shop.company.id } })).toBe(before);
  });
  it('foreign IDs and invalid values reject without mutation; needs preserve distinct requests and fields', async () => {
    const foreign = await db.party.create({ data: { company_id: other.company.id, name: 'Foreign customer', code: 'FOREIGN', party_type: 'CUSTOMER' } });
    await http('get','customers/' + foreign.id + '/khata').expect(404);
    await http('post','bills/amount-sale').send({ amount: 1, payment_method: 'UDHAR', customer_id: foreign.id }).expect(400);
    await http('post','purchases').send({ supplier_id: foreign.id, total_amount: 100, payment_status: 'CREDIT' }).expect(400);
    await http('post','needs').send({ name: 'Foreign need', customer_id: foreign.id }).expect(400);
    await http('post','customers/' + customer.id + '/payments').send({ amount: -1, payment_method: 'CASH' }).expect(400);
    for (let i = 0; i < 2; i++) await http('post','needs').send({ name: 'Same named requests', quantity: 2, source: 'CUSTOMER', customer_id: customer.id, customer_phone: '9850012345',
      preferred_supplier_id: supplier.id, needed_by: '2026-10-15', priority: 'URGENT', expected_price: 100, note: 'Separate request ' + i }).expect(201);
    const needs = (await http('get','needs').expect(200)).body.filter((n:any) => n.name === 'Same named requests');
    expect(needs).toHaveLength(2); expect(Number(needs[0].expected_price)).toBe(100); expect(needs[0].source).toBe('CUSTOMER');
  });
  it('item details persist, invalid opening stock rolls back the item, barcode is scoped and updates are real', async () => {
    const before = await db.item.count({ where: { company_id: shop.company.id } });
    await http('post','items').send({ name:'Invalid fractional opening',selling_price:10,opening_stock:0.5 }).expect(400);
    expect(await db.item.count({ where: { company_id: shop.company.id } })).toBe(before);
    const foreignUnit = await db.unit.findFirst({ where: { company_id: other.company.id } });
    await http('post','items').send({name:'Foreign unit',selling_price:10,unit_id:foreignUnit!.id}).expect(400);
    const added = (await http('post','items').send({ name:'GST item',selling_price:100,opening_stock:2,purchase_price:50,barcode:'GATE2-'+suffix,
      gst_rate:18,hsn_sac:'TEST',category:'Hardware',low_stock_threshold:3,preferred_supplier_id:supplier.id,mrp:120 }).expect(201)).body;
    expect(added.barcode).toBe('GATE2-'+suffix);expect(added.category).toBe('Hardware');expect(added.tax_rate).toBe(18);expect(added.low_stock_threshold).toBe(3);
    const quote = (await http('post','bills/quote').send({items:[{item_id:added.id,quantity:1,rate:100}],payment_splits:[]}).expect(201)).body;
    expect(quote.grand_total).toBe(118);
    await http('post','items/'+added.id).send({selling_price:110}).expect(201);
    expect(Number((await db.item.findUnique({where:{id:added.id}}))!.default_sale_rate)).toBe(110);
    await http('post','items/'+added.id).send({selling_mode:'WEIGHT'}).expect(400);
    await http('post','items').send({name:'Duplicate barcode',selling_price:10,barcode:'GATE2-'+suffix}).expect(400);
    expect(await db.item.count({where:{company_id:shop.company.id}})).toBe(before+1);
  });
  it('unit discovery has readable standard names, keeps custom units tenant-scoped and defaults quick items to PCS', async () => {
    const catalog = (await http('get', 'units').expect(200)).body;
    expect(catalog.find((unit:any)=>unit.code==='PCS').name).toContain('Piece');
    expect(catalog.find((unit:any)=>unit.code==='KG').name).toBe('Kilograms');
    expect(catalog.find((unit:any)=>unit.code==='CBM').selling_mode).toBe('VOLUME');
    const privateUnit = await db.unit.create({data:{company_id:other.company.id,code:'PRIVATE',name:'Other business unit'}});
    expect((await http('get','units').expect(200)).body.some((unit:any)=>unit.id===privateUnit.id)).toBe(false);
    await db.unit.create({data:{company_id:shop.company.id,code:'BOX',name:'Box'}});
    const added=(await http('post','items').send({name:'Quick catalog pieces',selling_price:20,inventory_tracking:false}).expect(201)).body;
    expect(added.unit).toBe('PCS');
    await http('post','items/'+added.id).send({unit_id:privateUnit.id}).expect(400);
    await http('post','items/'+added.id).send({unit_code:'CARTON',unit_name:'Carton'}).expect(201);
    const saved=(await http('get','items/'+added.id+'/options').expect(200)).body;
    expect(saved.primary_unit.name).toBe('Carton');expect(saved.base_unit_editable).toBe(true);
    expect((await http('get','units').expect(200)).body.some((unit:any)=>unit.code==='CARTON'&&unit.name==='Carton')).toBe(true);
  });
  it('price-only decimal billing records the chosen unit, creates no invented stock or COGS and locks history afterward', async () => {
    const added=(await http('post','items').send({name:'Quick loose produce',selling_price:80,inventory_tracking:false}).expect(201)).body;
    await http('post','items/'+added.id).send({unit_code:'KG',selling_mode:'WEIGHT'}).expect(201);
    const options=(await http('get','items/'+added.id+'/options').expect(200)).body;
    expect(options.primary_unit.name).toBe('Kilograms');expect(options.base_unit_editable).toBe(true);
    const before=await db.stockMovement.count({where:{company_id:shop.company.id}});
    const bill=(await http('post','bills').send({items:[{item_id:added.id,unit_id:options.primary_unit_id,quantity:.5,rate:80}],payment_splits:[{method:'CASH',amount:40}]}).expect(201)).body;
    expect(Number(bill.grand_total)).toBe(40);
    const line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:bill.id}});
    expect(line.inventory_tracked).toBe(false);expect(Number(line.entered_quantity)).toBe(.5);expect(line.unit_id).toBe(options.primary_unit_id);
    expect(await db.stockMovement.count({where:{company_id:shop.company.id}})).toBe(before);
    expect(await db.inventoryCostState.count({where:{item_id:added.id}})).toBe(0);
    expect((await http('get','items/'+added.id+'/options').expect(200)).body.base_unit_editable).toBe(false);
    await http('post','items/'+added.id).send({unit_code:'GM'}).expect(400);
    await http('post','items/'+added.id).send({selling_mode:'PIECE'}).expect(400);
    await http('post','items/'+added.id).send({selling_price:90}).expect(201);
    expect((await db.salesInvoiceLine.findUniqueOrThrow({where:{id:line.id}})).unit_id).toBe(options.primary_unit_id);
  });
  it('configured packs and held documents protect the base unit, and dimensional units reject incompatible modes', async () => {
    for(const code of ['LENGTH','AREA','VOLUME']) {
      const feature=await db.feature.findUniqueOrThrow({where:{code}});
      await db.tenantEntitlement.upsert({where:{uix_tenant_entitlements:{organization_id:shop.organization.id,feature_id:feature.id}},create:{organization_id:shop.organization.id,feature_id:feature.id,is_enabled:true},update:{is_enabled:true}});
    }
    await http('post','items').send({name:'Invalid dimensional unit',selling_price:10,unit_code:'KG',selling_mode:'AREA'}).expect(400);
    await http('post','items').send({name:'Invalid litre cube',selling_price:10,unit_code:'LTR',selling_mode:'VOLUME'}).expect(400);
    const cube=(await http('post','items').send({name:'Quick cubic measure',selling_price:10,unit_code:'CBM',selling_mode:'VOLUME',inventory_tracking:false}).expect(201)).body;
    const quoted=(await http('post','bills/quote').send({items:[{item_id:cube.id,quantity:2,rate:10,dimensions:{length:1,width:2,height:3}}],payment_splits:[]}).expect(201)).body;
    expect(Number(quoted.grand_total)).toBe(120);
    const packed=(await http('post','items').send({name:'Configured unused pack',selling_price:20,inventory_tracking:false}).expect(201)).body;
    const box=await db.unit.findFirstOrThrow({where:{company_id:shop.company.id,code:'BOX'}});
    await db.itemUnitConversion.create({data:{item_id:packed.id,from_unit_id:box.id,to_unit_id:packed.primary_unit_id,conversion_factor:12}});
    await http('post','items/'+packed.id).send({unit_code:'KG'}).expect(400);
    const heldItem=(await http('post','items').send({name:'Held unit history',selling_price:20,inventory_tracking:false}).expect(201)).body;
    const held=(await http('post','bills/hold').send({items:[{item_id:heldItem.id,quantity:1,rate:20}]}).expect(201)).body;
    await http('post','items/'+heldItem.id).send({unit_code:'PKT'}).expect(400);
    await db.posHeldBill.delete({where:{id:held.id}});
  });
});
