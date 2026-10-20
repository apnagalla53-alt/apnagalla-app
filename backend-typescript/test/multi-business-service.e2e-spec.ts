import { writeFileSync } from 'node:fs';
import { Test } from '@nestjs/testing';
import { RequestMethod,ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID,randomInt } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { businessDate } from '../src/common/business-date';

describe('Multi-business, footwear and shared automobile billing',()=>{
 let app:any,db:PrismaService,jwt:JwtService,auto:any,shoes:any,other:any,starter:any,oil:any,filter:any,brand:any,mixed:any,cashBill:any;
 const date=businessDate();
 const call=(method:'get'|'post'|'patch'|'put',route:string,row:any)=>(request(app.getHttpServer()) as any)[method]('/api/v1/'+route).set('Authorization','Bearer '+row.token).set('X-Company-Id',row.shop.company.id).set('X-Branch-Id',row.shop.branch.id).set('X-Financial-Year-Id',row.shop.financialYear.id);
 const account=(method:'get'|'post',route:string,token:string)=>(request(app.getHttpServer()) as any)[method]('/api/v1/auth/account/'+route).set('Authorization','Bearer '+token);
 const stock=async(row:any,id:string)=>(await db.stockBalanceProjection.findMany({where:{company_id:row.shop.company.id,item_id:id}})).reduce((sum,line)=>sum+Number(line.quantity),0);
 const candidate=(name:string,rate:number,item_type:'SERVICE'|'STOCK_ITEM'='SERVICE',quantity=1)=>({new_item:{client_id:randomUUID(),name,unit_code:item_type==='SERVICE'?'JOB':'PCS',selling_mode:'PIECE',item_type},quantity,rate,gst_rate:0});
 const save=(row:any,body:any,key=randomUUID())=>call('post','retail/bills',row).set('Idempotency-Key',key).send({date,...body});
 async function tenant(type:string,plan='PRO'){
  const planId=(await db.plan.findUniqueOrThrow({where:{code:plan}})).id;
  const password='Disposable!'+randomUUID();
  const shop=await app.get(TenantProvisioningService).provisionTenant({planId,organizationName:'TEST Activities '+type+' '+randomUUID(),businessType:type,adminName:'Synthetic service owner',adminEmail:randomUUID()+'@test.invalid',adminPassword:password});
  const session=await db.session.create({data:{user_id:shop.user.id,expires_at:new Date(Date.now()+3600000)}});
  return {shop,password,token:jwt.sign({sub:shop.user.id,sid:session.id,is_platform:false})};
 }
 async function newOwner(){
  const user=await db.user.create({data:{username:'multi-'+randomUUID(),email:randomUUID()+'@test.invalid',display_name:'Synthetic multi owner',google_subject:'synthetic-multi-'+randomUUID(),email_verified_at:new Date(),password_hash:'!no-password-login',password_login_enabled:false,onboarding_state:'BUSINESS_PROFILE_REQUIRED'}});
  const session=await db.session.create({data:{user_id:user.id,expires_at:new Date(Date.now()+3600000)}});
  return {user,token:jwt.sign({sub:user.id,sid:session.id,is_platform:false})};
 }
 const profile=(type:string,extras:string[]=[])=>({owner_name:'Synthetic multi owner',name:'TEST onboarding '+randomUUID(),mobile:'+91'+randomInt(6000000000,9999999999),address:'Disposable fixture address',business_type:type,additional_business_types:extras});
 beforeAll(async()=>{
  const target=new URL(process.env.DATABASE_URL!);if(!['localhost','127.0.0.1'].includes(target.hostname)||!target.pathname.endsWith('_test'))throw Error('Disposable localhost _test database required');
  app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication({logger:false});app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);jwt=app.get(JwtService);
  auto=await tenant('AUTOMOTIVE');shoes=await tenant('FOOTWEAR');other=await tenant('GROCERY');starter=await tenant('FOOTWEAR','STARTER');
  writeFileSync('../output/multi-business-20261020/browser-fixtures.private.json',JSON.stringify({auto,shoes,other,starter}));
  const oldItem=(await call('post','retail/items',auto).send({name:'Legacy repair stock item',selling_price:10,unit_code:'PCS',opening_stock:5,opening_cost:7,inventory_tracking:true}).expect(201)).body;
  await save(auto,{items:[{item_id:oldItem.id,quantity:1,rate:10}],payment_splits:[{method:'CASH',amount:10}]}).expect(201);
 },90000);
 afterAll(async()=>{await app?.close();});

 it('saves multiple activities, one primary and resumes onboarding without duplicate businesses',async()=>{
  const owner=await newOwner(),body=profile('FOOTWEAR',['CLOTHING','FOOTWEAR','CLOTHING']);
  const first=(await account('post','onboarding/profile',owner.token).send(body).expect((res:any)=>{if(res.status!==201)throw Error('Onboarding result: '+JSON.stringify(res.body));}).expect(201)).body;
  expect(first.business.business_type).toBe('FOOTWEAR');expect(first.business.additional_business_types).toEqual(['CLOTHING']);expect(first.state).toBe('ACCESS_PENDING');
  const again=(await account('post','onboarding/profile',owner.token).send(body).expect(201)).body;expect(again.business.id).toBe(first.business.id);
  expect(await db.company.count({where:{organization_id:first.business.id}})).toBe(1);
  const saved=await db.organization.findUniqueOrThrow({where:{id:first.business.id}});expect(saved.additional_business_types).toEqual(['CLOTHING']);
 });
 it('accepts a legacy single-business payload with no additional activity field',async()=>{
  const owner=await newOwner(),{additional_business_types,...body}=profile('GROCERY');
  const result=(await account('post','onboarding/profile',owner.token).send(body).expect((res:any)=>{if(res.status!==201)throw Error('Legacy onboarding result: '+JSON.stringify(res.body));}).expect(201)).body;
  expect(result.business.business_type).toBe('GROCERY');expect(result.business.additional_business_types).toEqual([]);
  await account('post','onboarding/profile',owner.token).send({...body,additional_business_types:['UNSUPPORTED']}).expect(400);
 });
 it('keeps footwear dominant while adding garment recommendations',async()=>{
  await db.organization.update({where:{id:shoes.shop.organization.id},data:{additional_business_types:['CLOTHING']}});
  const result=(await call('get','retail/account/subscription',shoes).expect(200)).body;
  expect(result.business_preset.family).toBe('FOOTWEAR');expect(result.business_preset.recommendedUnits[0]).toBe('PAIR');expect(result.business_preset.additionalBusinessTypes).toEqual(['CLOTHING']);expect(result.business_preset.serviceCalculator).toBe(false);
 });
 it('automatically personalizes an existing repair tenant without changing its history or onboarding state',async()=>{
  const before=await db.organization.findUniqueOrThrow({where:{id:auto.shop.organization.id}}),userBefore=await db.user.findUniqueOrThrow({where:{id:auto.shop.user.id}});
  const scope={company_id:auto.shop.company.id},counts=await Promise.all([db.item.count({where:scope}),db.salesInvoice.count({where:scope}),db.stockMovement.count({where:scope})]);
  expect(counts.every(count=>count>0)).toBe(true);
  const historyBefore=JSON.stringify(await Promise.all([db.item.findMany({where:scope}),db.salesInvoice.findMany({where:scope,include:{lines:true}}),db.stockBalanceProjection.findMany({where:scope})]));
  const accountResult=(await call('get','retail/account/subscription',auto).expect(200)).body;
  expect(accountResult.business_preset.serviceCalculator).toBe(true);expect(accountResult.business_preset.family).toBe('AUTOMOTIVE');
  await call('get','retail/account/experience',auto).expect(200);
  expect(await Promise.all([db.item.count({where:scope}),db.salesInvoice.count({where:scope}),db.stockMovement.count({where:scope})])).toEqual(counts);
  expect(JSON.stringify(await Promise.all([db.item.findMany({where:scope}),db.salesInvoice.findMany({where:scope,include:{lines:true}}),db.stockBalanceProjection.findMany({where:scope})]))).toBe(historyBefore);
  expect(await db.organization.findUniqueOrThrow({where:{id:auto.shop.organization.id}})).toEqual(before);
  expect((await db.user.findUniqueOrThrow({where:{id:auto.shop.user.id}})).onboarding_state).toBe(userBefore.onboarding_state);
 });
 it.each(['AUTOMOBILE_REPAIR','Automobile Repair','Auto / Two-Wheeler Repair'])('recognizes stored legacy repair value %s',async value=>{
  await db.organization.update({where:{id:auto.shop.organization.id},data:{business_type:value}});
  expect((await call('get','retail/account/subscription',auto).expect(200)).body.business_preset.serviceCalculator).toBe(true);
  await db.organization.update({where:{id:auto.shop.organization.id},data:{business_type:'AUTOMOTIVE'}});
 });
 it('creates a reusable optional brand once and keeps Category separate',async()=>{
  brand=(await call('post','retail/item-brands',shoes).send({name:' Test Brand '}).expect(201)).body;
  expect((await call('post','retail/item-brands',shoes).send({name:'test brand'}).expect(201)).body.id).toBe(brand.id);
  const result=(await call('post','retail/items/inline',shoes).send({name:'Air Runner',selling_price:1299,unit_code:'PAIR',brand_id:brand.id,category:'Sports Shoes',has_variants:true,variants:['UK 8','EU 42'].flatMap(Size=>['Black','White'].map(Colour=>({attributes:{Size,Colour}})))}).expect(201)).body;
  const item=await db.item.findUniqueOrThrow({where:{id:result.id},include:{brand:true,variants:true}});
  expect(item.brand?.id).toBe(brand.id);expect(item.category).toBe('Sports Shoes');expect(item.variants).toHaveLength(4);expect(item.variants.every(v=>v.default_sale_rate==null||Number(v.default_sale_rate)===1299)).toBe(true);
  const unbranded=(await call('post','retail/items/inline',shoes).send({name:'Local Slipper',selling_price:99,unit_code:'PAIR',inventory_tracking:false}).expect(201)).body;expect(unbranded.brand_id).toBeNull();
 });
 it('rejects foreign brands and preserves per-variant stock using normal purchases and sales',async()=>{
  await call('post','retail/items/inline',other).send({name:'Foreign brand attack',selling_price:50,brand_id:brand.id}).expect(400);
  expect((await call('get','retail/item-brands',other).expect(200)).body).toEqual([]);
  const item=await db.item.findFirstOrThrow({where:{company_id:shoes.shop.company.id,name:'Air Runner'},include:{variants:true}}),variant=item.variants[0];
  const supplier=(await call('post','retail/suppliers',shoes).send({name:'TEST Footwear supplier'}).expect(201)).body;
  await call('post','retail/purchases',shoes).set('Idempotency-Key',randomUUID()).send({supplier_id:supplier.id,payment_status:'CREDIT',purchase_date:date,lines:[{item_id:item.id,variant_id:variant.id,unit_id:item.primary_unit_id,quantity:3,purchase_rate:700}]}).expect(201);
  await save(shoes,{items:[{item_id:item.id,variant_id:variant.id,quantity:1,rate:1299}],payment_splits:[{method:'CASH',amount:1299}]}).expect(201);expect(await stock(shoes,item.id)).toBe(2);
  expect(Number((await call('get','retail/suppliers/'+supplier.id+'/khata',shoes).expect(200)).body.balance)).toBe(2100);
 });
 it('does not unlock Variants or advanced inventory through business activities',async()=>{
  await db.organization.update({where:{id:starter.shop.organization.id},data:{additional_business_types:['CLOTHING','AUTOMOTIVE']}});
  const access=(await call('get','retail/account/subscription',starter).expect(200)).body;
  expect(access.entitlements.features.find((f:any)=>f.code==='VARIANTS').enabled).toBe(false);
  await call('post','retail/items/inline',starter).send({name:'Not entitled shoe',selling_price:50,unit_code:'PAIR',has_variants:true,variants:[{attributes:{Size:'8'}}]}).expect(403);
  expect(await db.item.count({where:{company_id:starter.shop.company.id,name:'Not entitled shoe'}})).toBe(0);
 });
 it('creates parts with genuine counted stock and known cost for the shared service scenarios',async()=>{
  oil=(await call('post','retail/items',auto).send({name:'Engine Oil',selling_price:1000,unit_code:'BOTTLE',opening_stock:10,opening_cost:500,inventory_tracking:true}).expect(201)).body;
  filter=(await call('post','retail/items',auto).send({name:'Oil Filter',selling_price:220,unit_code:'PCS',opening_stock:5,opening_cost:100,inventory_tracking:true}).expect(201)).body;
  expect(await stock(auto,oil.id)).toBe(10);expect(await stock(auto,filter.id)).toBe(5);
 });
 it('quotes service 750 + parts 1220 − discount 100 = 1870 without saving candidates',async()=>{
  mixed={items:[candidate('General Service',500),candidate('Oil Change Labour',250),{item_id:oil.id,quantity:1,rate:1000},{item_id:filter.id,quantity:1,rate:220}],bill_discount:100,payment_splits:[{method:'CASH',amount:1870}],note:'Vehicle: TEST BIKE 01'};
  const quote=(await call('post','retail/bills/quote',auto).send(mixed).expect(201)).body;
  expect(quote.grand_total).toBe(1870);expect(quote.lines.reduce((s:number,l:any)=>s+l.before_bill_discount,0)).toBe(1970);
  expect(await db.item.count({where:{company_id:auto.shop.company.id,item_type:'SERVICE',is_system:false}})).toBe(0);
  expect(await stock(auto,oil.id)).toBe(10);
 });
 it('posts mixed Cash once, reduces only spare parts, and reconciles Galla and vouchers',async()=>{
  const before=(await call('get','retail/galla?date='+date,auto).expect(200)).body,key=randomUUID();
  const results=await Promise.all([1,2,3].map(()=>save(auto,mixed,key).expect(201)));expect(new Set(results.map(r=>r.body.id)).size).toBe(1);cashBill=results[0].body;
  expect(Number(cashBill.grand_total)).toBe(1870);expect(await stock(auto,oil.id)).toBe(9);expect(await stock(auto,filter.id)).toBe(4);
  const services=await db.item.findMany({where:{company_id:auto.shop.company.id,item_type:'SERVICE',is_system:false}});expect(services).toHaveLength(2);expect(services.every(s=>s.inventory_tracking===false)).toBe(true);
  expect(await db.stockMovement.count({where:{company_id:auto.shop.company.id,item_id:{in:services.map(s=>s.id)}}})).toBe(0);
  const after=(await call('get','retail/galla?date='+date,auto).expect(200)).body;expect(Number(after.expected_cash)-Number(before.expected_cash)).toBe(1870);
  const vouchers=await db.voucher.findMany({where:{company_id:auto.shop.company.id,source_document_id:cashBill.id,status:'POSTED'},include:{lines:true}});expect(vouchers.length).toBeGreaterThan(0);for(const v of vouchers)expect(v.lines.reduce((s,l)=>s+Number(l.debit)-Number(l.credit),0)).toBeCloseTo(0,6);
  expect(cashBill.lines.filter((l:any)=>services.some(s=>s.id===l.item_id)).every((l:any)=>l.inventory_tracked===false)).toBe(true);
 });
 it('reuses an existing service, supports fractional labour and keeps UPI outside physical cash',async()=>{
  const service=await db.item.findFirstOrThrow({where:{company_id:auto.shop.company.id,item_type:'SERVICE',is_system:false}}),before=(await call('get','retail/galla?date='+date,auto).expect(200)).body;
  const bill=(await save(auto,{items:[{item_id:service.id,quantity:.5,rate:200}],payment_splits:[{method:'UPI',amount:100,receipt_confirmed:true}]}).expect(201)).body;
  expect(Number(bill.paid_amount)).toBe(100);const after=(await call('get','retail/galla?date='+date,auto).expect(200)).body;expect(Number(after.expected_cash)).toBe(Number(before.expected_cash));
  const receipts=await db.voucher.findMany({where:{company_id:auto.shop.company.id,source_document_id:bill.id,source_document_type:'POS_RECEIPT'},include:{lines:{include:{ledger_account:true}}}});expect(receipts.flatMap(v=>v.lines).filter(l=>l.ledger_account.code==='DEFAULT_BANK').reduce((s,l)=>s+Number(l.debit),0)).toBe(100);
 });
 it('posts service Udhar to the existing customer Khata and enforces the customer requirement',async()=>{
  const customer=(await call('post','retail/customers',auto).send({name:'TEST Service customer'}).expect(201)).body,line=candidate('Brake Work',300);
  const bill=(await save(auto,{items:[line],customer_id:customer.id,payment_splits:[]}).expect(201)).body;expect(Number(bill.outstanding_amount)).toBe(300);
  expect(Number((await call('get','retail/customers/'+customer.id+'/khata',auto).expect(200)).body.balance)).toBe(300);
  await save(auto,{items:[candidate('Unassigned due',100)],payment_splits:[]}).expect(400);
 });
 it('quick-creates a new part only on successful save with unknown stock and cost',async()=>{
  const line=candidate('Custom Lever',300,'STOCK_ITEM'),body={items:[line],payment_splits:[{method:'CASH',amount:300}]};
  await call('post','retail/bills/quote',auto).send(body).expect(201);expect(await db.item.count({where:{company_id:auto.shop.company.id,name:'Custom Lever'}})).toBe(0);
  const bill=(await save(auto,body).expect(201)).body,item=await db.item.findFirstOrThrow({where:{company_id:auto.shop.company.id,name:'Custom Lever'}});
  expect(item.inventory_tracking).toBe(false);expect(await db.stockBalanceProjection.count({where:{item_id:item.id}})).toBe(0);expect(await db.stockMovement.count({where:{item_id:item.id}})).toBe(0);expect(bill.lines[0].cost_status).not.toBe('KNOWN');
  expect((await call('get','retail/items?search=Custom%20Lever&item_type=PART',auto).expect(200)).body.map((i:any)=>i.id)).toContain(item.id);
 });
 it('rolls back a failed mixed bill and retries safely with no corrupt stock or duplicate part',async()=>{
  const body={items:[candidate('Retry Service',200),candidate('Retry Part',50,'STOCK_ITEM'),{item_id:oil.id,quantity:1,rate:1000}],payment_splits:[{method:'CASH',amount:1250}]},before=await stock(auto,oil.id);
  await save(auto,{...body,customer_id:randomUUID()}).expect(400);expect(await stock(auto,oil.id)).toBe(before);expect(await db.item.count({where:{company_id:auto.shop.company.id,name:{in:['Retry Service','Retry Part']}}})).toBe(0);
  const key=randomUUID(),result=(await save(auto,body,key).expect(201)).body;expect((await save(auto,body,key).expect(201)).body.id).toBe(result.id);expect(await stock(auto,oil.id)).toBe(before-1);expect(await db.item.count({where:{company_id:auto.shop.company.id,name:'Retry Part'}})).toBe(1);
 });
 it('applies existing percentage discount and tax engine to mixed service/parts without changing item rates',async()=>{
  const profile={legal_name:'TEST Auto Service',address:'TEST road',state_code:'27',gstin:'27AAPFU0939F1ZV',invoice_prefix:'GST',hsn_digits:4,electronic_reporting:'NOT_REQUIRED',regular_registration:true,signatory:'Synthetic Owner'};
  await call('put','retail/gst/profile',auto).send(profile).expect(200);
  const body={items:[{...candidate('Taxed Service',500),gst_rate:18},{item_id:filter.id,quantity:1,rate:220,gst_rate:5}],bill_discount_percent:10,payment_splits:[]};
  const quote=(await call('post','retail/bills/quote',auto).send(body).expect(201)).body;expect(quote.discount_amount).toBe(72);expect(quote.taxable_amount).toBe(648);expect(quote.tax_amount).toBe(90.9);expect(quote.grand_total).toBe(738.9);
  expect(Number((await db.item.findUniqueOrThrow({where:{id:filter.id}})).default_sale_rate)).toBe(220);
 });
 it('rejects a foreign item, keeps service search separate and preserves a zero-setup footwear bill',async()=>{
  await save(other,{items:[{item_id:oil.id,quantity:1,rate:1000}],payment_splits:[{method:'CASH',amount:1000}]}).expect(400);
  const services=(await call('get','retail/items?item_type=SERVICE',auto).expect(200)).body;expect(services.length).toBeGreaterThan(0);expect(services.every((i:any)=>i.item_type==='SERVICE')).toBe(true);
  const bill=(await save(shoes,{items:[{...candidate('Zero-setup Sports Shoe',1299,'STOCK_ITEM'),new_item:{...candidate('ignored',1,'STOCK_ITEM').new_item,name:'Zero-setup Sports Shoe',unit_code:'PAIR'}}],payment_splits:[{method:'CASH',amount:1299}]}).expect(201)).body;
  expect(Number(bill.grand_total)).toBe(1299);const item=await db.item.findFirstOrThrow({where:{company_id:shoes.shop.company.id,name:'Zero-setup Sports Shoe'}});expect(item.has_variants).toBe(false);expect(item.inventory_tracking).toBe(false);
 });
 it('enforces company isolation on the new brand table under a restricted database role',async()=>{
  const role='brand_scope_'+randomUUID().replaceAll('-','')+'_test';
  await db.$executeRawUnsafe('CREATE ROLE "'+role+'" NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE');
  try{
   await db.$executeRawUnsafe('GRANT "'+role+'" TO CURRENT_USER WITH INHERIT TRUE');
   await db.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO "'+role+'"');
   await db.$executeRawUnsafe('GRANT SELECT ON item_brands TO "'+role+'"');
   const rows=await db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET LOCAL ROLE "'+role+'"');
    await tx.$executeRaw`SELECT set_config('app.security_scope','tenant',true),set_config('app.company_id',${shoes.shop.company.id},true)`;
    return tx.$queryRaw<{company_id:string}[]>`SELECT company_id FROM item_brands`;
   });
   expect(rows.length).toBeGreaterThan(0);expect(rows.every(row=>row.company_id===shoes.shop.company.id)).toBe(true);
  }finally{await db.$executeRawUnsafe('DROP OWNED BY "'+role+'"');await db.$executeRawUnsafe('DROP ROLE "'+role+'"');}
 });
});
