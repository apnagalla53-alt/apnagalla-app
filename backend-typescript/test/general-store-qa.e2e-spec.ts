import { Test } from '@nestjs/testing';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { ReportsService } from '../src/retail/reports/reports.service';
import { businessDate } from '../src/common/business-date';
import { throttleOperation } from '../src/common/operation-throttle';
const scenario=require('./fixtures/general-store-scenario.cjs');

describe('General store report: exact one lakh scenario on fresh PostgreSQL',()=>{
 let app:INestApplication,db:PrismaService,A:any,B:any,token:string,other:string,data:any;
 const date=businessDate(),period='?from='+date+'&to='+date,password='Disposable!'+randomUUID();
 const call=(method:string,path:string,shop=A,credential=token)=>(request(app.getHttpServer()) as any)[method]('/api/v1/retail/'+path).set('Authorization','Bearer '+credential).set('X-Company-Id',shop.company.id).set('X-Branch-Id',shop.branch.id).set('X-Financial-Year-Id',shop.financialYear.id);
 beforeAll(async()=>{
  app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();
  app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
  const plan=await db.plan.findUniqueOrThrow({where:{code:'PRO'}}),provision=app.get(TenantProvisioningService);
  const create=(name:string)=>provision.provisionTenant({organizationName:name,adminName:'Disposable owner',adminEmail:randomUUID()+'@test.invalid',adminPassword:password,planId:plan.id});
  A=await create('General store one lakh '+randomUUID());B=await create('General store isolation '+randomUUID());
  token=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:A.user.username,password}).expect(200)).body.access_token;
  other=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:B.user.username,password}).expect(200)).body.access_token;
  data=await scenario(async(path:string,body:any)=>{
    if(path==='$rent')return db.expenseCategory.findFirstOrThrow({where:{company_id:A.company.id,name:'Rent'}});
    const response=await call('post',path).send(body);
    if(response.status!==201)throw Error('Synthetic seed '+path+' '+(body.name||'')+' failed '+response.status+': '+JSON.stringify(response.body));return response.body;
  },date);
 },90000);
 afterAll(async()=>{await app?.close();});
 it('fresh shop defaults, eight bills and total purchases reproduce the report',async()=>{
  expect(await db.expenseCategory.count({where:{company_id:A.company.id}})).toBe(10);
  expect((await call('get','reports/sales'+period).expect(200)).body.summary).toMatchObject({gross_sales:100000,returns:370,net_sales:99630});
  expect(await db.salesInvoice.count({where:{company_id:A.company.id,status:'POSTED'}})).toBe(8);
  expect(Number((await db.purchaseInvoice.aggregate({where:{company_id:A.company.id,status:'POSTED'},_sum:{grand_total:true}}))._sum.grand_total)).toBe(80354);
 });
 it('returns report and CSV reconcile 370 with items, date and actual cash refunds',async()=>{
  const report=(await call('get','reports/returns'+period).expect(200)).body;
  expect(report.summary).toEqual({total_returns:370,returns_count:2});
  const returned=report.returns.find((r:any)=>r.id===data.returned.id);
  expect(returned).toMatchObject({original_invoice_id:data.cash.id,grand_total:360,refund_method:'CASH',cash_refunded:360,credit_adjusted:0});
  expect(returned.document_date.slice(0,10)).toBe(date);expect(returned.refunds[0]).toMatchObject({method:'CASH',amount:360});
  expect(returned.lines[0]).toMatchObject({item_id:data.rice.id,item_name:'QA 1L Rice 5kg bag',quantity:1,unit:'PKT',batch_number:'QA-1L-RICE'});
  const csv=(await call('get','account/exports/RETURNS'+period).expect(200)).body;
  const column=csv.headers.indexOf('grand_total');expect(csv.rows.reduce((sum:number,row:string[])=>sum+Number(row[column]),0)).toBe(370);
 });
 it('original cash bill stays 30350 and shows returned one of thirty bags and settled 29990',async()=>{
  const bill=(await call('get','bills/'+data.cash.id).expect(200)).body;
  expect(Number(bill.grand_total)).toBe(30350);expect(Number(bill.paid_amount)).toBe(30350);expect(bill.status).toBe('POSTED');expect(bill.return_status).toBe('PARTIAL');
  expect(bill.sales_invoice_line.find((l:any)=>l.item_id===data.rice.id)).toMatchObject({sold_entered_quantity:30,returned_quantity:1,remaining_quantity:29});
  expect(bill.settlement).toEqual({original_total:30350,return_value:360,net_total:29990,received_total:30350,cash_refunded:360,net_received:29990,due:0,customer_credit:0});
  expect(bill.returns[0].id).toBe(data.returned.id);
 });
 it('inventory restores the original rice batch and reports eleven items, nine out and ten low',async()=>{
  const items=(await call('get','items?limit=100').expect(200)).body;
  const rows=Array.isArray(items)?items:items.data;
  expect(rows.filter((i:any)=>i.item_type!=='SERVICE')).toHaveLength(11);
  // Independent authoritative projection check, including batch stock and known cost.
  const balances=await db.stockBalanceProjection.findMany({where:{company_id:A.company.id}});
  const quantity=(id:string)=>balances.filter(b=>b.item_id===id).reduce((sum,b)=>sum+Number(b.quantity),0);
  expect(quantity(data.rice.id)).toBe(1);expect(quantity(data.biscuit.id)).toBe(17);
  expect([data.soap,data.looseRice,data.tea,data.flour,data.sugar,data.dal,data.oil,data.detergent,data.water].every(i=>quantity(i.id)===0)).toBe(true);
  const batch=await db.itemBatch.findFirstOrThrow({where:{item_id:data.rice.id,batch_number:'QA-1L-RICE'}});
  const returned=await db.salesReturnLine.findFirstOrThrow({where:{sales_return_id:data.returned.id,item_id:data.rice.id}});
  expect(returned.batch_id).toBe(batch.id);expect(Number(returned.cogs_total)).toBe(295);
  const all=[data.biscuit,data.soap,data.looseRice,data.rice,data.tea,data.flour,data.sugar,data.dal,data.oil,data.detergent,data.water];
  expect(all.filter(i=>quantity(i.id)<=Number(i.low_stock_threshold)).length).toBe(10);
  expect((await call('get','reports/stock').expect(200)).body.summary).toMatchObject({total_items:11,low_stock_count:10,out_of_stock_count:9});
 });
 it('cash drawer and customer/supplier dues match actual payments, not total sales',async()=>{
  expect((await call('get','galla?date='+date).expect(200)).body).toMatchObject({total_sales:100000,bill_count:8,cash_received:58300,cash_paid_out:36920,opening_cash:500,expected_cash:21880,actual_cash:21880,difference:0,status:'MATCHED',cash_refunds:370,old_dues_cash:5115,supplier_cash:30400,cash_expenses:4100,cash_owner_withdrawals:2050,upi_sales:30500,udhar_sales:16315,accounting_modified_by_count:false});
  const customer=(await call('get','customers?search=QA%201L%20Neha').expect(200)).body[0];expect(customer.outstanding_amount).toBe(11200);
  const suppliers=(await call('get','suppliers').expect(200)).body;expect(suppliers.reduce((sum:number,s:any)=>sum+s.outstanding_amount,0)).toBe(29954);
 });
 it('known-cost profit remains 15720, unknown quick-sale cost stays unknown and journals balance',async()=>{
  expect((await call('get','reports/financial/summary'+period).expect(200)).body).toMatchObject({net_sales:'99630',cogs:'79690',gross_profit:'19820',business_expenses:'4100',net_business_profit:'15720',complete:false});
  const quick=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:data.quick.id}});expect(quick.cogs_total).toBeNull();expect(quick.gross_profit).toBeNull();
  const journals=await db.voucher.findMany({where:{company_id:A.company.id,status:'POSTED'},include:{lines:true}});
  for(const journal of journals)expect(journal.lines.reduce((s,l)=>s+Number(l.debit)-Number(l.credit),0)).toBeCloseTo(0,6);
 });
 it('unconfigured UPI cannot initiate QR or claim bank verification; recorded manual UPI remains separate',async()=>{
  expect((await call('get','payments/upi').expect(200)).body).toMatchObject({configured:false,bank_verified:false,automatic_confirmation:false});
  await call('get','payments/upi/qr?amount=30500').expect(404);
  const bill=(await call('get','bills/'+data.upi.id).expect(200)).body;expect(bill.payments).toEqual([{method:'UPI',amount:30500}]);
  expect((await call('get','account').expect(200)).body.backup.configured).toBe(false);
 });
 it('dates and explicit cross-tenant and branch attacks cannot expose returns or bill details',async()=>{
  expect((await call('get','reports/returns?from=2020-01-01&to=2020-01-01').expect(200)).body.summary.total_returns).toBe(0);
  expect((await call('get','reports/returns'+period,B,other).expect(200)).body.summary.total_returns).toBe(0);
  await call('get','bills/'+data.cash.id,B,other).expect(404);
  await call('get','reports/returns'+period).set('X-Company-Id',B.company.id).expect(403);
  await call('get','reports/returns'+period+'&branch_id='+B.branch.id).expect(403);
 });
 it('server failures expose a safe traceable request ID and recover without leaking error details',async()=>{
  const spy=vi.spyOn(app.get(ReportsService),'getReturnsReport').mockRejectedValueOnce(Object.assign(new Error('private database detail'),{code:'P2022'}));
  try{const error=await call('get','reports/returns'+period).expect(500);expect(error.body.request_id).toMatch(/^[a-f0-9-]{36}$/);expect(error.headers['x-request-id']).toBe(error.body.request_id);expect(JSON.stringify(error.body)).not.toContain('private database detail');}finally{spy.mockRestore();}
  expect((await call('get','reports/returns'+period).expect(200)).body.summary.total_returns).toBe(370);
 });
 it('full credit return displays Khata settlement without a fabricated cash refund',async()=>{
  const item=(await call('post','items',B,other).send({name:'Isolated credit goods',selling_price:10,opening_stock:1,opening_cost:6}).expect(201)).body;
  const customer=(await call('post','customers',B,other).send({name:'Isolated credit customer',credit_allowed:true}).expect(201)).body;
  const sale=(await call('post','bills',B,other).send({date,customer_id:customer.id,items:[{item_id:item.id,quantity:1,rate:10}],payment_splits:[]}).expect(201)).body;
  await call('post','bills/return',B,other).send({original_invoice_id:sale.id,refund_method:'KHATA',lines:[{item_id:item.id,quantity:1,rate:10}]}).expect(201);
  const bill=(await call('get','bills/'+sale.id,B,other).expect(200)).body;
  expect(bill.return_status).toBe('FULL');expect(bill.status).toBe('POSTED');expect(bill.returns[0]).toMatchObject({refund_method:'KHATA',cash_refunded:0,credit_adjusted:10,refunds:[]});expect(bill.settlement).toMatchObject({net_total:0,cash_refunded:0,due:0});
 });
 it('developer scenario discounted 90 sale and 90 refund changes gross/returns to 100090/460 without changing cash or profit',async()=>{
  const item=(await call('post','items').send({name:'QA DEV Screw Box 10mm',selling_price:100,opening_stock:3,opening_cost:60}).expect(201)).body;
  const sale=(await call('post','bills').send({date,bill_discount:10,items:[{item_id:item.id,quantity:1,rate:100}],payment_splits:[{method:'CASH',amount:90}]}).expect(201)).body;
  expect(Number(sale.grand_total)).toBe(90);
  const line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:sale.id}});expect(Number(line.cogs_total)).toBe(60);expect(Number(line.gross_profit)).toBe(30);
  const body={original_invoice_id:sale.id,refund_method:'CASH',lines:[{item_id:item.id,original_line_id:line.id,quantity:1,rate:100}]},key=randomUUID();
  const returns=await Promise.all([1,2,3].map(()=>call('post','bills/return').set('Idempotency-Key',key).send(body).expect(201)));
  expect(new Set(returns.map(r=>r.body.id)).size).toBe(1);expect(Number(returns[0].body.grand_total)).toBe(90);
  expect(await db.salesReturn.count({where:{original_invoice_id:sale.id}})).toBe(1);expect(await db.voucher.count({where:{source_document_type:'POS_REFUND',source_document_id:returns[0].body.id}})).toBe(1);
  await call('post','bills/return').set('Idempotency-Key',randomUUID()).send(body).expect(400);
  expect((await call('get','reports/sales'+period).expect(200)).body.summary).toMatchObject({gross_sales:100090,returns:460,net_sales:99630,bills_count:9});
  expect((await call('get','reports/returns'+period).expect(200)).body.summary).toEqual({total_returns:460,returns_count:3});
  expect((await call('get','galla?date='+date).expect(200)).body).toMatchObject({expected_cash:21880,difference:0,cash_refunds:460});
  const bill=(await call('get','bills/'+sale.id).expect(200)).body;expect(bill.return_status).toBe('FULL');expect(bill.sales_invoice_line[0].remaining_quantity).toBe(0);expect(bill.settlement).toMatchObject({original_total:90,net_total:0,received_total:90,cash_refunded:90,net_received:0,due:0});
  const stock=(await call('get','reports/financial/valuation?item_id='+item.id).expect(200)).body.rows[0];expect(Number(stock.quantity)).toBe(3);expect(Number(stock.inventory_value)).toBe(180);
 });
 it('product coverage 100 remains separate from 120 unknown service revenue and incomplete overall profit',async()=>{
  expect((await call('get','reports/financial/summary'+period).expect(200)).body).toMatchObject({cost_coverage:'100',service_revenue:'120',unknown_service_revenue:'120',complete:false,net_business_profit:'15720'});
 });
 it('report limits give Retry-After, spare other tenants and POS, and reopen after the bounded window',async()=>{
  // Exhaust only this synthetic user's real guard bucket without 120 expensive DB queries.
  for(let i=0;i<121;i++){try{await throttleOperation('report:'+A.user.id,120);}catch{}}
  const response=await call('get','reports/sales'+period).expect(429);expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);expect(response.body.retry_after_seconds).toBe(Number(response.headers['retry-after']));
  await call('get','reports/sales'+period,B,other).expect(200);await call('get','items').expect(200);
  const now=Date.now(),clock=vi.spyOn(Date,'now').mockReturnValue(now+61000);
  try{await call('get','reports/sales'+period).expect(200);}finally{clock.mockRestore();}
 });
});
