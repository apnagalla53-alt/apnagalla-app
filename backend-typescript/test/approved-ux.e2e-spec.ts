import { Test } from '@nestjs/testing';
import { RequestMethod,ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { ShopFreshStartService } from '../src/platform/shop-fresh-start.service';
import { businessDate } from '../src/common/business-date';
import { gstChecksum } from '../src/retail/gst/gst-rules';
describe('Approved shopkeeper UX: isolated financial and session acceptance',()=>{
 let app:any,db:PrismaService,A:any,B:any,token:string,otherToken:string,admin:any;
 const password='12345678',adminPassword='SyntheticAdmin!'+randomUUID();
 const call=(method:string,path:string,shop=A,bearer=token)=>(request(app.getHttpServer()) as any)[method]('/api/v1/retail/'+path).set('Authorization','Bearer '+bearer).set('X-Company-Id',shop.company.id).set('X-Branch-Id',shop.branch.id).set('X-Financial-Year-Id',shop.financialYear.id);
 const candidate=(price=100)=>({items:[{new_item:{client_id:randomUUID(),name:'Test item '+randomUUID(),unit_code:'PCS',selling_mode:'PIECE'},quantity:1,rate:price}],payment_splits:[{method:'CASH',amount:price}],date:businessDate()});
 const post=(body:any)=>call('post','bills').set('Idempotency-Key',randomUUID()).send(body).expect(201);
 beforeAll(async()=>{
  const url=new URL(process.env.DATABASE_URL!);if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw Error('Disposable local _test database required');
  app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication({logger:false});app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
  const provision=app.get(TenantProvisioningService),planId=(await db.plan.findUniqueOrThrow({where:{code:'PRO'}})).id;
  A=await provision.provisionTenant({planId,organizationName:'Ezzy paints and sanitary',adminName:'Disposable Owner',adminEmail:randomUUID()+'@test.invalid',adminPassword:password});
  B=await provision.provisionTenant({planId,organizationName:'Second Shop',adminName:'Other Owner',adminEmail:randomUUID()+'@test.invalid',adminPassword:'abcdefgh'});
  token=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:A.user.username,password}).expect(200)).body.access_token;
  otherToken=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:B.user.username,password:'abcdefgh'}).expect(200)).body.access_token;
  admin=await db.platformUser.create({data:{username:'ux-admin-'+randomUUID(),display_name:'Disposable Platform Admin',email:randomUUID()+'@test.invalid',password_hash:await bcrypt.hash(adminPassword,10)}});
 },90000);
 afterAll(async()=>{await app?.close();});
 it('starts EPS-001 and does not consume a number for failed posting',async()=>{
  expect((await post(candidate())).body.document_number).toBe('EPS-001');
  await call('post','bills').send({...candidate(),customer_id:randomUUID()}).expect(400);
  expect((await post(candidate())).body.document_number).toBe('EPS-002');
 });
 it('assigns distinct continuous numbers to concurrent independent sales',async()=>{
  const replies=await Promise.all([1,2,3,4].map(()=>post(candidate())));expect(replies.map(r=>r.body.document_number).sort()).toEqual(['EPS-003','EPS-004','EPS-005','EPS-006']);
 });
 it('keeps owner sessions on the device, renews the same session and respects revocation',async()=>{
  const {JwtService}=await import('@nestjs/jwt'),jwt=app.get(JwtService),payload=jwt.decode(token) as any;
  expect(payload.exp-payload.iat).toBe(365*86400);
  const before=await db.session.count({where:{user_id:A.user.id}});
  const response=await request(app.getHttpServer()).get('/api/v1/auth/session').set('Authorization','Bearer '+token).set('X-Requested-With','XMLHttpRequest').expect(200);
  expect(response.body.user.id).toBe(A.user.id);expect(response.body.access_token).toBeUndefined();expect(response.headers['set-cookie'].join(';')).toContain('HttpOnly');expect(response.headers['set-cookie'].join(';')).toContain('Max-Age=3153');expect(await db.session.count({where:{user_id:A.user.id}})).toBe(before);
  const revoked=await db.session.create({data:{user_id:A.user.id,expires_at:new Date(Date.now()+86400000),revoked_at:new Date()}}),revokedToken=jwt.sign({sub:A.user.id,sid:revoked.id,is_platform:false});
  await request(app.getHttpServer()).get('/api/v1/auth/session').set('Authorization','Bearer '+revokedToken).expect(401);
 });
 it('saves two receiving QRs and snapshots the selected receiver without bank verification claims',async()=>{
  const primary=(await call('post','payments/upi').send({upi_id:'shop@bank',payee_name:'Shop Owner',label:'Current',add_new:true,make_default:true,show_on_invoice:true}).expect(201)).body;
  const second=(await call('post','payments/upi').send({upi_id:'personal@upi',payee_name:'Personal Name',label:'Savings',add_new:true,show_on_invoice:true}).expect(201)).body;
  expect(second.profiles).toHaveLength(2);expect(second.default_profile_id).toBe(primary.default_profile_id);
  const receiver=second.profiles.find((p:any)=>p.upi_id==='personal@upi'),body=candidate();body.payment_splits=[{method:'UPI',amount:100,receiving_profile_id:receiver.id,receipt_confirmed:true} as any];
  const invoice=(await post(body)).body,detail=(await call('get','bills/'+invoice.id).expect(200)).body;
  expect(detail.payments[0]).toMatchObject({receiving_upi_id:'personal@upi',receiving_payee_name:'Personal Name',bank_verified:false});
  await call('post','bills').send({...candidate(),payment_splits:[{method:'UPI',amount:100,receiving_profile_id:randomUUID(),receipt_confirmed:true}]}).expect(400);
  await call('post','bills').send({...candidate(),payment_splits:[{method:'UPI',amount:100,received_on_mobile:'9876543210',receipt_confirmed:false}]}).expect(400);
  const alternate=(await post({...candidate(),payment_splits:[{method:'UPI',amount:100,received_on_mobile:'9876543210',receipt_confirmed:true}]})).body;
  expect(alternate.payment_snapshot[0].received_on_mobile).toBe('9876543210');
  const amount=(await call('post','bills/amount-sale').send({amount:55,payment_method:'UPI',received_on_mobile:'9876543210',receipt_confirmed:true}).expect(201)).body;expect(amount.payment_snapshot[0].received_on_mobile).toBe('9876543210');
 });
 it('cancels a tracked paid bill and restores stock, cash, cost and customer balance together',async()=>{
  const item=(await call('post','items').send({name:'Tracked test',selling_price:50,opening_stock:10,opening_cost:25}).expect(201)).body;
  const before=(await call('get','galla?date='+businessDate()).expect(200)).body;
  const bill=(await post({items:[{item_id:item.id,quantity:2,rate:50}],payment_splits:[{method:'CASH',amount:100}]})).body;
  await call('post','bills/'+bill.id+'/cancel').send({editor_name:'Demo Operator',reason:'Remove demonstration entries'}).expect(201);
  expect((await db.salesInvoice.findUniqueOrThrow({where:{id:bill.id}})).status).toBe('CANCELLED');
  const balances=await db.stockBalanceProjection.findMany({where:{company_id:A.company.id,item_id:item.id}});expect(balances.reduce((n,b)=>n+Number(b.quantity),0)).toBe(10);
  const cost=await db.inventoryCostState.findFirstOrThrow({where:{company_id:A.company.id,item_id:item.id}});expect(Number(cost.known_value)).toBe(250);expect(Number(cost.unknown_quantity)).toBe(0);
  const after=(await call('get','galla?date='+businessDate()).expect(200)).body;expect(after.expected_cash).toBe(before.expected_cash);expect(after.total_sales).toBe(before.total_sales);expect(after.cash_sales).toBe(before.cash_sales);
  const journals=await db.voucher.findMany({where:{company_id:A.company.id,source_document_id:bill.id,status:'POSTED'},include:{lines:true}});const sums=new Map<string,number>();for(const line of journals.flatMap(j=>j.lines))sums.set(line.ledger_account_id,(sums.get(line.ledger_account_id)||0)+Number(line.debit)-Number(line.credit));for(const sum of sums.values())expect(sum).toBeCloseTo(0,5);
  const allocations=await db.billAllocation.findMany({where:{company_id:A.company.id,reference_document_id:bill.id}});expect(allocations.reduce((n,a)=>n+(a.allocation_type==='NEW_REFERENCE'?1:-1)*Number(a.amount),0)).toBeCloseTo(0,5);
  await call('post','bills/'+bill.id+'/cancel').send({editor_name:'Demo Operator',reason:'Duplicate click'}).expect(400);
  expect(await db.auditLog.count({where:{source_document_id:bill.id,action:'BILL_CANCELLED'}})).toBe(1);
 });
 it('edits atomically with an auditable replacement and rolls back failed edits',async()=>{
  const bill=(await post(candidate())).body,body={items:bill.lines.map((l:any)=>({item_id:l.item_id,quantity:1,rate:75})),payment_splits:[{method:'CASH',amount:75}],editor_name:'Demo Editor',reason:'Correct entered price'};
  await call('post','bills/'+bill.id+'/edit').send({...body,payment_splits:[{method:'CASH',amount:1000}]}).expect(400);
  expect((await db.salesInvoice.findUniqueOrThrow({where:{id:bill.id}})).status).toBe('POSTED');
  const result=(await call('post','bills/'+bill.id+'/edit').send(body).expect(201)).body;expect(Number(result.replacement.grand_total)).toBe(75);expect(result.replacement.document_number).not.toBe(bill.document_number);
  await call('post','bills/'+result.replacement.id+'/cancel',B,otherToken).send({editor_name:'Other',reason:'Must not cross tenant'}).expect(400);
 });
 it('cancels a split cash/UPI/Udhar bill without leaving a balance or moving real money',async()=>{
  const customer=(await call('post','customers').send({name:'Split correction',credit_allowed:true}).expect(201)).body,before=(await call('get','galla?date='+businessDate()).expect(200)).body;
  const body={...candidate(),customer_id:customer.id,payment_splits:[{method:'CASH',amount:30},{method:'UPI',amount:40}]},bill=(await post(body)).body;
  expect(Number(bill.outstanding_amount)).toBe(30);await call('post','bills/'+bill.id+'/cancel').send({editor_name:'Demo Operator',reason:'Clear split demo bill'}).expect(201);
  const timeline=(await call('get','customers/'+customer.id+'/khata').expect(200)).body;expect(Number(timeline.balance)).toBe(0);
  const after=(await call('get','galla?date='+businessDate()).expect(200)).body;expect(after.expected_cash).toBe(before.expected_cash);expect(after.upi_sales).toBe(before.upi_sales);expect(after.udhar_sales).toBe(before.udhar_sales);
 });
 it('explains invalid GST input, preserves genuine validation and saves a valid profile',async()=>{
  const prefix='23AAPFU0939F1Z',profile={legal_name:'Registered Shop',address:'12 Market Road Indore',state_code:'23',gstin:prefix+gstChecksum(prefix),invoice_prefix:'GST',hsn_digits:6,electronic_reporting:'NOT_REQUIRED',regular_registration:true,signatory:'Owner Name'};
  const invalid=await call('put','gst/profile').send({...profile,gstin:'07AAECR2971C1Z'}).expect(400);expect(invalid.body.message.join(' ')).toContain('15-character');expect(JSON.stringify(invalid.body)).not.toContain('regular expression');
  await call('put','gst/profile').send({...profile,state_code:'27'}).expect(400);
  expect((await call('put','gst/profile').send(profile).expect(200)).body.profile.gstin).toBe(profile.gstin);
 });
 it('records a correction identity plus signed-in user and before/after state',async()=>{
  const customer=(await call('post','customers').send({name:'Before name',credit_allowed:true}).expect(201)).body;
  await call('patch','customers/'+customer.id).set('X-Correction-Name','Entered Editor').set('X-Correction-Reason','Correct spelling').send({name:'After name'}).expect(200);
  const audit=(await call('get','audit?source_id='+customer.id).expect(200)).body.rows.find((r:any)=>r.action==='CUSTOMERS_CORRECTED');expect(audit.user_id).toBe(A.user.id);expect(JSON.parse(audit.details)).toMatchObject({editor_name:'Entered Editor',reason:'Correct spelling',before:{name:'Before name'},after:{name:'After name'}});
  const item=await db.item.findFirstOrThrow({where:{company_id:A.company.id,is_system:false}});await call('post','items/'+item.id).set('X-Correction-Name','Item Editor').set('X-Correction-Reason','Correct product name').send({name:'Corrected item'}).expect(201);
  expect(await db.auditLog.count({where:{company_id:A.company.id,source_document_id:item.id,action:'ITEMS_CORRECTED'}})).toBe(1);
 });
 it('opens a fresh shop with password confirmation, preserves credentials and can restore the complete original',async()=>{
  await request(app.getHttpServer()).post('/api/v1/platform/admin/tenants/'+A.organization.id+'/fresh-start').send({}).expect(401);
  const service=app.get(ShopFreshStartService),before=await db.user.findUniqueOrThrow({where:{id:A.user.id}}),other=await db.company.findUniqueOrThrow({where:{id:B.company.id}}),preview=await service.preview(A.organization.id),sales=await db.salesInvoice.count({where:{company_id:A.company.id}});
  await expect(service.start(A.organization.id,A.company.id,preview.confirmation,'wrong password','Demo completed',admin.id)).rejects.toThrow('password');
  const fresh=await service.start(A.organization.id,A.company.id,preview.confirmation,adminPassword,'Demo completed',admin.id);
  expect(await db.salesInvoice.count({where:{company_id:fresh.company_id}})).toBe(0);expect(await db.salesInvoice.count({where:{company_id:A.company.id}})).toBe(sales);expect((await db.user.findUniqueOrThrow({where:{id:A.user.id}})).password_hash).toBe(before.password_hash);expect((await db.company.findUniqueOrThrow({where:{id:B.company.id}})).is_active).toBe(other.is_active);
  const login=await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:A.user.username,password}).expect(200);expect(login.body.tenant_context.company_id).toBe(fresh.company_id);
  await service.restore(A.organization.id,fresh.company_id,adminPassword,'Restore test archive',admin.id);expect((await db.company.findUniqueOrThrow({where:{id:A.company.id}})).is_active).toBe(true);expect(await db.salesInvoice.count({where:{company_id:A.company.id}})).toBe(sales);
  expect((await db.platformUser.findUniqueOrThrow({where:{id:admin.id}})).password_hash).toBe(admin.password_hash);
 });
});

