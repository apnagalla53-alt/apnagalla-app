import {Test} from '@nestjs/testing';
import {INestApplication,RequestMethod,ValidationPipe} from '@nestjs/common';
import request from 'supertest';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {AppModule} from '../src/app.module';
import {PrismaService} from '../src/database/prisma.service';
import {TenantProvisioningService} from '../src/platform/provisioning/tenant-provisioning.service';

describe('Local billing revision: isolated tenant acceptance',()=>{
 let app:INestApplication,db:PrismaService,shop:any,token:string,item:any,qrA:string,qrB:string,credit:any,receipt:any;
 const suffix=randomUUID(),password='TestOnly-'+randomUUID(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const call=(method:'get'|'post',path:string)=>request(app.getHttpServer())[method]('/api/v1/'+path).set('Authorization','Bearer '+token).set('X-Company-Id',shop.company.id).set('X-Branch-Id',shop.branch.id).set('X-Financial-Year-Id',shop.financialYear.id);
 const body=(extra:any={})=>({items:[{item_id:item.id,quantity:2,rate:150,gst_rate:0}],payment_splits:[],date,...extra});
 beforeAll(async()=>{
  const url=new URL(process.env.DATABASE_URL!);if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw Error('Disposable localhost _test database required');
  app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication({logger:false});app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
  const plan=await db.plan.findUniqueOrThrow({where:{code:'SMART'}});
  shop=await app.get(TenantProvisioningService).provisionTenant({organizationName:'TEST-LOCAL BILLING '+suffix,adminName:'Local Demo Owner',adminEmail:'billing-'+suffix+'@test.invalid',adminPassword:password,businessType:'HARDWARE',planId:plan.id});
  token=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:shop.user.username,password}).expect(200)).body.access_token;
  const profile={legal_name:'TEST Local Hardware',trade_name:'Ezzy Paints',address:'TEST Local Road',state_code:'27',gstin:'27AAPFU0939F1ZV',phone:'9876543210',email:'test@test.invalid',invoice_prefix:'GST',hsn_digits:4,electronic_reporting:'NOT_REQUIRED',regular_registration:true,signatory:'Test Owner',terms:''};
  await request(app.getHttpServer()).put('/api/v1/retail/gst/profile').set('Authorization','Bearer '+token).set('X-Company-Id',shop.company.id).set('X-Branch-Id',shop.branch.id).set('X-Financial-Year-Id',shop.financialYear.id).send(profile).expect(200);
  item=(await call('post','retail/items').send({name:'Paint roller',selling_price:150,unit_code:'PCS',inventory_tracking:false,gst_rate:18,hsn_sac:'9603'}).expect(201)).body;
  for(const [label,address] of [['Shop account','shop@bank'],['Personal account','personal@bank']]){const saved=(await call('post','retail/payments/upi').send({label,upi_id:address,payee_name:'TEST Local Owner',show_on_invoice:true,add_new:true}).expect(201)).body;const id=saved.profiles.find((p:any)=>p.upi_id===address).id;if(!qrA)qrA=id;else qrB=id;}
 },90000);
 afterAll(async()=>{await app?.close();});
 it('zero GST is explicit; an entered rate and percentage discount reconcile in quote',async()=>{
  expect((await call('post','retail/bills/quote').send(body()).expect(201)).body.grand_total).toBe(300);
  const quote=(await call('post','retail/bills/quote').send(body({items:[{item_id:item.id,quantity:2,rate:150,gst_rate:18}],bill_discount_percent:10})).expect(201)).body;
  expect(quote.taxable_amount).toBe(270);expect(quote.tax_amount).toBe(48.6);expect(quote.discount_amount).toBe(30);expect(quote.grand_total).toBe(318.6);
 });
 it('quotes never persist service charges or typed customers; failed posts roll both back',async()=>{
  const before=await db.item.count({where:{company_id:shop.company.id}}),parties=await db.party.count({where:{company_id:shop.company.id}});
  const extra={customer_name:'Test uncommitted customer',service_charge:{name:'Packing',amount:20,gst_rate:0}};
  expect((await call('post','retail/bills/quote').send(body(extra)).expect(201)).body.grand_total).toBe(320);
  expect(await db.item.count({where:{company_id:shop.company.id}})).toBe(before);expect(await db.party.count({where:{company_id:shop.company.id}})).toBe(parties);
  await call('post','retail/bills').send(body({...extra,payment_splits:[{method:'CASH',amount:999}]})).expect(400);
  expect(await db.item.count({where:{company_id:shop.company.id}})).toBe(before);expect(await db.party.count({where:{company_id:shop.company.id}})).toBe(parties);
 });
 it('saves named customers only with successful bills; service fee uses no stock',async()=>{
  credit=(await call('post','retail/bills').send(body({customer_name:'Rahul Test',service_charge:{name:'Packing',amount:20,gst_rate:0}})).expect(201)).body;
  expect(Number(credit.grand_total)).toBe(320);const saved=await db.salesInvoice.findUniqueOrThrow({where:{id:credit.id},include:{party:true,lines:{include:{item:true}}}});expect(saved.party.name).toBe('Rahul Test');const fee=saved.lines.find(l=>l.item.sku.startsWith('RETAIL-SERVICE-'))!;expect(fee.item.item_type).toBe('SERVICE');expect(fee.item.inventory_tracking).toBe(false);expect(await db.stockMovement.count({where:{source_document_id:credit.id}})).toBe(0);
 });
 it('walk-in stays internal and never appears in customer suggestions',async()=>{
  await call('post','retail/bills').send(body({payment_splits:[{method:'CASH',amount:300}]})).expect(201);
  const customers=(await call('get','retail/customers').expect(200)).body;expect(customers.every((p:any)=>!p.is_walkin)).toBe(true);expect(await db.party.count({where:{company_id:shop.company.id,is_walkin:true}})).toBe(1);
 });
 it('receiving account snapshots reconcile checkout and later customer collections without double counting',async()=>{
  receipt=(await call('post','retail/bills').send(body({payment_splits:[{method:'UPI',amount:300,receiving_profile_id:qrA,receipt_confirmed:true}]})).expect(201)).body;
  const collected=(await call('post','retail/customers/'+credit.party_id+'/payments').send({amount:50,payment_method:'UPI',receiving_profile_id:qrB,receipt_confirmed:true,date}).expect(201)).body;
  expect((await db.voucher.findUniqueOrThrow({where:{id:collected.payment_id}})).receiving_snapshot).toMatchObject({receiving_profile_id:qrB});
  const report=(await call('get',`retail/reports/dashboard?from=${date}&to=${date}`).expect(200)).body;
  expect(report.upi_accounts.find((r:any)=>r.profile_id===qrA).sales_received).toBe(300);expect(report.upi_accounts.find((r:any)=>r.profile_id===qrB).dues_received).toBe(50);expect(report.upi_accounts.reduce((s:number,r:any)=>s+r.total_received,0)).toBe(report.upi_received);
 });
 it('saved charge preferences preserve other shop settings and are reusable',async()=>{
  await call('post','retail/account/service-charge-preference').send({name:'Packing',amount:20,gst_rate:0,auto_apply:false}).expect(201);
  expect((await call('get','retail/account/service-charge-preference').expect(200)).body.charge).toMatchObject({name:'Packing',amount:20,auto_apply:false});
  const dir=resolve(process.cwd(),'../output/local-billing-20261017');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,'private-fixtures.json'),JSON.stringify({username:shop.user.username,password,company:shop.company.id,branch:shop.branch.id,year:shop.financialYear.id,item,qrA,qrB,credit,receipt,date},null,2));
 });
 it('keeps standalone amount-only sales visible separately from named service charges',async()=>{
  await call('post','retail/bills/amount-sale').send({amount:50,payment_method:'CASH',date}).expect(201);
  const report=(await call('get',`retail/reports/dashboard?from=${date}&to=${date}`).expect(200)).body;
  expect(report.amount_only_sales).toBe(50);expect(report.service_charges).toBe(20);
 });
 it('GST service charge and percentage discount post the quoted total with a usable GST invoice snapshot',async()=>{
  const input=body({items:[{item_id:item.id,quantity:2,rate:150,gst_rate:18}],bill_discount_percent:10,service_charge:{name:'TEST service',amount:30,gst_rate:18,sac:'998599'}});
  const quote=(await call('post','retail/bills/quote').send(input).expect(201)).body;expect(quote.grand_total).toBe(350.46);
  const saved=(await call('post','retail/bills').send({...input,payment_splits:[{method:'CASH',amount:350.46}]}).expect(201)).body;
  const draft=(await call('get','retail/gst/bills/'+saved.id).expect(200)).body;
  const preview=(await call('post','retail/gst/bills/'+saved.id+'/preview').send({recipient:draft.recipient,place_of_supply:draft.place_of_supply,reverse_charge:false,lines:draft.lines.map((l:any)=>({line_id:l.line_id,description:l.description,hsn:l.hsn,uqc:l.uqc}))}).expect(201)).body;
  expect(Number(preview.snapshot.totals.grand_total)).toBe(350.46);expect(Number(preview.snapshot.totals.tax)).toBe(53.46);expect(preview.snapshot.lines).toHaveLength(2);
 });
 it('refuses a service-charge SKU collision instead of treating an ordinary product as a fee',async()=>{
  const name='TEST collision',sku='RETAIL-SERVICE-'+createHash('sha256').update(name+'|').digest('hex').slice(0,24);
  await call('post','retail/items').send({name:'Ordinary test product',sku,selling_price:10,unit_code:'PCS',inventory_tracking:false}).expect(201);
  await call('post','retail/bills/quote').send(body({service_charge:{name,amount:20,gst_rate:0}})).expect(400);
 });
});
