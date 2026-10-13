import { Test } from '@nestjs/testing';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { DEFAULT_EXPENSE_CATEGORIES } from '../src/retail/expenses/categories/default-expense-categories';
import { businessDate } from '../src/common/business-date';

describe('Shopkeeper QA: returns, export, defaults and unchanged accounting on real PostgreSQL', () => {
  let app: INestApplication, db: PrismaService, A: any, B: any, token: string, other: string, supplier: any, biscuit: any, single: any, quick: any;
  const date = businessDate(), password = 'DisposableQa!'+randomUUID(), suffix = randomUUID();
  const call = (method: string, path: string, shop = A, credential = token) => (request(app.getHttpServer()) as any)[method]('/api/v1/retail/'+path)
    .set('Authorization', 'Bearer '+credential).set('X-Company-Id', shop.company.id).set('X-Branch-Id', shop.branch.id).set('X-Financial-Year-Id', shop.financialYear.id);
  const period = '?from='+date+'&to='+date;
  const reconcile = async (shop = A, credential = token, query = period) => {
    const report = (await call('get','reports/returns'+query,shop,credential).expect(200)).body;
    const csv = (await call('get','account/exports/RETURNS'+query,shop,credential).expect(200)).body;
    const amount = csv.headers.indexOf('grand_total');
    expect(report.summary.total_returns).toBe(report.returns.reduce((sum: number, r: any) => sum+r.grand_total,0));
    expect(csv.rows.reduce((sum: number, r: string[]) => sum+Number(r[amount]),0)).toBe(report.summary.total_returns);
    expect(report.summary.returns_count).toBe(csv.rows.length);
    return report;
  };
  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
    await app.init(); db=app.get(PrismaService);
    const plan = await db.plan.findUniqueOrThrow({where:{code:'PRO'}});
    const provision = (name: string) => app.get(TenantProvisioningService).provisionTenant({organizationName:name+suffix,adminName:'Disposable QA Owner',adminEmail:name+suffix+'@test.invalid',adminPassword:password,planId:plan.id});
    A=await provision('QA regression A '); B=await provision('QA regression B ');
    token=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:A.user.username,password}).expect(200)).body.access_token;
    other=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:B.user.username,password}).expect(200)).body.access_token;
  },60000);
  afterAll(async()=>{await app?.close();});
  it('fresh shops have the ten requested expense categories with tenant-owned expense ledgers',async()=>{
    for(const shop of [A,B]){
      const categories=await db.expenseCategory.findMany({where:{company_id:shop.company.id},include:{ledger_account:true}});
      expect(categories.map(c=>c.name).sort()).toEqual([...DEFAULT_EXPENSE_CATEGORIES].sort());
      for(const category of categories){expect(category.organization_id).toBe(shop.organization.id);expect(category.ledger_account?.company_id).toBe(shop.company.id);expect(category.ledger_account?.account_type).toBe('EXPENSE');}
    }
  });
  it('reproduces gross sales 445 and the single cash return of 10',async()=>{
    supplier=(await call('post','suppliers').send({name:'QA supplier'}).expect(201)).body;
    biscuit=(await call('post','items').send({name:'QA biscuit',selling_price:10}).expect(201)).body;
    const goods=(await call('post','items').send({name:'QA known goods',selling_price:315}).expect(201)).body;
    const spare=(await call('post','items').send({name:'QA unsold stock',selling_price:700}).expect(201)).body;
    const purchase=(await call('post','purchases').send({supplier_id:supplier.id,purchase_date:date,payment_status:'CREDIT',lines:[{item_id:biscuit.id,quantity:1,purchase_rate:6},{item_id:goods.id,quantity:1,purchase_rate:262},{item_id:spare.id,quantity:1,purchase_rate:658}]}).expect(201)).body;
    expect(Number(purchase.grand_total)).toBe(926);
    const sale=(await call('post','bills').send({date,items:[{item_id:biscuit.id,quantity:1,rate:10},{item_id:goods.id,quantity:1,rate:315}],payment_splits:[{method:'CASH',amount:325}]}).expect(201)).body;
    quick=(await call('post','bills/amount-sale').send({amount:120,payment_method:'CASH',date}).expect(201)).body;
    single=(await call('post','bills/return').send({original_invoice_id:sale.id,refund_method:'CASH',lines:[{item_id:biscuit.id,quantity:1,rate:10}]}).expect(201)).body;
    const report=await reconcile();expect(report.summary.total_returns).toBe(10);expect(report.returns).toHaveLength(1);expect(report.returns[0].grand_total).toBe(10);
    const refund=await db.voucher.findFirstOrThrow({where:{company_id:A.company.id,source_document_type:'POS_REFUND',source_document_id:single.id},include:{lines:{include:{ledger_account:true}}}});
    expect(refund.lines.filter(l=>l.ledger_account.code==='CASH_IN_HAND').reduce((s,l)=>s+Number(l.credit),0)).toBe(10);
  });
  it('sales totals remain 445 gross, 10 returned, 435 net and 445 cash before cash out',async()=>{
    expect((await call('get','reports/sales'+period).expect(200)).body.summary).toMatchObject({gross_sales:445,returns:10,net_sales:435,cash_received:445});
  });
  it('required category validation remains authoritative and default categories can post expenses',async()=>{
    await call('post','expenses').send({type:'BUSINESS_EXPENSE',amount:100,payment_method:'CASH',date}).expect(400);
    const rent=await db.expenseCategory.findFirstOrThrow({where:{company_id:A.company.id,name:'Rent'}});
    await call('post','expenses').send({type:'BUSINESS_EXPENSE',category_id:rent.id,amount:100,payment_method:'CASH',date}).expect(201);
    await call('post','expenses').send({type:'OWNER_WITHDRAWAL',amount:50,payment_method:'CASH',date}).expect(201);
    await call('post','suppliers/'+supplier.id+'/payments').send({amount:400,payment_method:'CASH',date}).expect(201);
  });
  it('Daily Galla still reconciles 500 + 445 - 560 = 385 with the stale count shortage 210',async()=>{
    await call('post','galla/count').send({date,opening_cash:500,actual_cash:175}).expect(201);
    const galla=(await call('get','galla?date='+date).expect(200)).body;
    expect(galla).toMatchObject({opening_cash:500,cash_sales:445,cash_received:445,supplier_cash:400,cash_expenses:100,cash_owner_withdrawals:50,cash_refunds:10,cash_paid_out:560,expected_cash:385,actual_cash:175,difference:-210});
  });
  it('known-cost profit remains -47 and the amount-only sale retains unknown cost',async()=>{
    const result=(await call('get','reports/financial/summary'+period).expect(200)).body;
    expect(result).toMatchObject({net_sales:'435',cogs:'262',gross_profit:'53',business_expenses:'100',net_business_profit:'-47',complete:false});
    const line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:quick.id}});
    expect(line.cogs_total).toBeNull();expect(line.gross_profit).toBeNull();expect(line.cost_status).not.toBe('KNOWN');
    expect(await db.stockMovement.count({where:{source_document_id:quick.id}})).toBe(0);
    const journals=await db.voucher.findMany({where:{company_id:A.company.id,status:'POSTED'},include:{lines:true}});
    for(const journal of journals)expect(journal.lines.reduce((sum,l)=>sum+Number(l.debit)-Number(l.credit),0)).toBeCloseTo(0,6);
  });
  it('partial and multiple cash returns reconcile with both report rows and paginated CSV',async()=>{
    const product=(await call('post','items',B,other).send({name:'QA partial return',selling_price:10,opening_stock:4,opening_cost:6}).expect(201)).body;
    biscuit=product;
    const sale=(await call('post','bills',B,other).send({date,items:[{item_id:product.id,quantity:4,rate:10}],payment_splits:[{method:'CASH',amount:40}]}).expect(201)).body;
    for(const quantity of [1,2])await call('post','bills/return',B,other).send({original_invoice_id:sale.id,refund_method:'CASH',lines:[{item_id:product.id,quantity,rate:10}]}).expect(201);
    const report=await reconcile(B,other);expect(report.summary).toEqual({total_returns:30,returns_count:2});
    const first=(await call('get','account/exports/RETURNS'+period+'&limit=1',B,other).expect(200)).body;
    const second=(await call('get','account/exports/RETURNS'+period+'&limit=1&offset='+first.nextOffset,B,other).expect(200)).body;
    expect(first.hasMore).toBe(true);expect(second.hasMore).toBe(false);
    const column=first.headers.indexOf('grand_total');expect(Number(first.rows[0][column])+Number(second.rows[0][column])).toBe(30);
  });
  it('Udhar returns contribute invoice value without claiming a cash refund',async()=>{
    const customer=(await call('post','customers',B,other).send({name:'QA credit customer',credit_allowed:true}).expect(201)).body;
    const sale=(await call('post','bills',B,other).send({date,customer_id:customer.id,items:[{item_id:biscuit.id,quantity:1,rate:20}],payment_splits:[]}).expect(201)).body;
    const returned=(await call('post','bills/return',B,other).send({original_invoice_id:sale.id,refund_method:'KHATA',lines:[{item_id:biscuit.id,quantity:1,rate:20}]}).expect(201)).body;
    const report=await reconcile(B,other);expect(report.summary).toEqual({total_returns:50,returns_count:3});
    expect(await db.voucher.count({where:{source_document_type:'POS_REFUND',source_document_id:returned.id}})).toBe(0);
    expect((await call('get','customers?search=QA%20credit%20customer',B,other).expect(200)).body[0].outstanding_amount).toBe(0);
    expect((await call('get','galla?date='+date,B,other).expect(200)).body.cash_refunds).toBe(30);
  });
  it('date filters and tenant/branch scope match for returns summary and export',async()=>{
    expect((await reconcile()).summary.total_returns).toBe(10);
    expect((await reconcile(A,token,'?from=2020-01-01&to=2020-01-01')).summary.total_returns).toBe(0);
    const foreign='&branch_id='+B.branch.id;
    for(const path of ['reports/returns','account/exports/RETURNS'])await call('get',path+period+foreign).expect(403);
    for(const path of ['reports/returns','account/exports/RETURNS'])await call('get',path).set('X-Company-Id',B.company.id).expect(403);
  });
  it('concurrent initialization of a zero-category existing shop creates defaults just once',async()=>{
    await db.expenseCategory.deleteMany({where:{company_id:B.company.id}});
    const results=await Promise.all([1,2,3].map(()=>call('post','expense-categories/initialize-defaults',B,other).send({}).expect(201)));
    for(const result of results)expect(result.body).toHaveLength(10);
    expect(await db.expenseCategory.count({where:{company_id:B.company.id}})).toBe(10);
  });
  it('initialization preserves renamed/custom categories and blocks cross-tenant writes',async()=>{
    const rent=await db.expenseCategory.findFirstOrThrow({where:{company_id:A.company.id,name:'Rent'}});
    await call('patch','expense-categories/'+rent.id).send({name:'My custom rent'}).expect(200);
    const before=await db.expenseCategory.findMany({where:{company_id:A.company.id},orderBy:{id:'asc'}});
    await call('post','expense-categories/initialize-defaults').send({}).expect(201);
    expect(await db.expenseCategory.findMany({where:{company_id:A.company.id},orderBy:{id:'asc'}})).toEqual(before);
    await call('post','expense-categories').send({name:'My custom rent'}).expect(400);
    await call('post','expense-categories/initialize-defaults').set('X-Company-Id',B.company.id).send({}).expect(403);
    await call('post','expenses',B,other).send({type:'BUSINESS_EXPENSE',category_id:rent.id,amount:10,payment_method:'CASH',date}).expect(400);
  });
});
