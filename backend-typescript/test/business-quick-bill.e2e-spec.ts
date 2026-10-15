import { Test } from '@nestjs/testing';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { businessDate } from '../src/common/business-date';

describe('Business-aware Quick Bill: isolated authoritative acceptance',()=>{
 let app:any,db:PrismaService,shops:any[]=[];
 const cases=[['GROCERY','Local Chips','PKT','PIECE',2,20],['PHARMACY','Crocin tablet','PCS','PIECE',2,12],['HARDWARE','PVC Pipe','MTR','LENGTH',2,80],['CLOTHING','Cotton Kurta','PCS','PIECE',1,650],['FOOTWEAR','Sports Shoe','PAIR','PIECE',1,1299],['STATIONERY','Blue Pen','PCS','PIECE',3,10],['ELECTRONICS','USB Charger','PCS','PIECE',1,499],['RESTAURANT','Masala Tea','CUP','PIECE',2,20]] as const;
 const call=(method:string,path:string,row:any)=>(request(app.getHttpServer()) as any)[method]('/api/v1/'+path).set('Authorization','Bearer '+row.token).set('X-Company-Id',row.shop.company.id).set('X-Branch-Id',row.shop.branch.id).set('X-Financial-Year-Id',row.shop.financialYear.id);
 const draft=(name:string,unit:string,mode:string,qty:number,rate:number)=>({items:[{new_item:{client_id:randomUUID(),name,unit_code:unit,selling_mode:mode},quantity:qty,rate}],payment_splits:[{method:'CASH',amount:qty*rate}],date:businessDate()});
 beforeAll(async()=>{
  const url=new URL(process.env.DATABASE_URL!);if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw Error('Dedicated local _test database required');
  app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication({logger:false});
  app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
  const planId=(await db.plan.findUniqueOrThrow({where:{code:'PRO'}})).id;
  for(const [type]of cases){const password='DisposableQuick!'+randomUUID(),shop=await app.get(TenantProvisioningService).provisionTenant({planId,organizationName:'Quick acceptance '+type+' '+randomUUID(),businessType:type,adminName:'Synthetic Owner',adminEmail:randomUUID()+'@test.invalid',adminPassword:password});
   const token=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:shop.user.username,password}).expect(200)).body.access_token;shops.push({shop,token,type});
  }
 },90000);
 afterAll(async()=>{await app?.close();});
 it.each(cases)('%s: drafts and quotes create nothing; concurrent retry commits exactly one item and sale',async(type,name,unit,mode,quantity,rate)=>{
  const row=shops.find(s=>s.type===type),body=draft(name,unit,mode,quantity,rate),scope={company_id:row.shop.company.id};
  expect(await db.item.count({where:{...scope,is_system:false}})).toBe(0);
  const quote=(await call('post','retail/bills/quote',row).send(body).expect(201)).body;
  expect(Number(quote.grand_total)).toBe(quantity*rate);
  expect(await db.item.count({where:{...scope,is_system:false}})).toBe(0);
  const key=randomUUID(),responses=await Promise.all([1,2,3].map(()=>call('post','retail/bills',row).set('Idempotency-Key',key).send(body).expect(201)));
  expect(new Set(responses.map(r=>r.body.id)).size).toBe(1);
  const recovered=(await call('post','retail/bills/quote',row).send(body).expect(201)).body;expect(Number(recovered.grand_total)).toBe(quantity*rate);
  expect((await call('post','retail/bills',row).set('Idempotency-Key',key).send(body).expect(201)).body.id).toBe(responses[0].body.id);
  const invoice=responses[0].body;expect(Number(invoice.grand_total)).toBe(quantity*rate);expect(Number(invoice.paid_amount)).toBe(quantity*rate);
  const item=await db.item.findFirstOrThrow({where:{...scope,name},include:{primary_unit:true}});
  expect(item.inventory_tracking).toBe(false);expect(item.primary_unit.code).toBe(unit);expect(Number(item.default_sale_rate)).toBe(rate);
  expect(await db.stockMovement.count({where:{...scope,item_id:item.id}})).toBe(0);
  expect(await db.stockBalanceProjection.count({where:{...scope,item_id:item.id}})).toBe(0);
  expect(await db.salesInvoice.count({where:scope})).toBe(1);
  expect(await db.item.count({where:{...scope,is_system:false}})).toBe(1);
  expect(invoice.lines.every((l:any)=>l.cost_status!=='KNOWN')).toBe(true);
  const found=(await call('get','retail/items?search='+encodeURIComponent(name),row).expect(200)).body;expect(found.map((i:any)=>i.id)).toContain(item.id);
  const galla=(await call('get','retail/galla?date='+businessDate(),row).expect(200)).body;expect(Number(galla.expected_cash)).toBe(quantity*rate);
  const entries=await db.voucher.findMany({where:{...scope,source_document_id:invoice.id,status:'POSTED'},include:{lines:true}});
  expect(entries.length).toBeGreaterThan(0);for(const e of entries)expect(e.lines.reduce((n,l)=>n+Number(l.debit)-Number(l.credit),0)).toBeCloseTo(0,6);
 });
 it('rolls the new item back when posting fails and accepts a safe retry',async()=>{
  const row=shops[0],body=draft('Failed then recovered','PKT','PIECE',1,15),before=await db.item.count({where:{company_id:row.shop.company.id}});
  await call('post','retail/bills',row).set('Idempotency-Key',randomUUID()).send({...body,customer_id:randomUUID()}).expect(400);
  expect(await db.item.count({where:{company_id:row.shop.company.id}})).toBe(before);
  await call('post','retail/bills',row).set('Idempotency-Key',randomUUID()).send(body).expect(201);
 });
 it('keeps the same name isolated across tenants and rejects foreign item IDs',async()=>{
  const a=shops[0],b=shops[1],name='Shared local name';
  for(const [row,rate]of [[a,11],[b,23]] as any[])await call('post','retail/bills',row).set('Idempotency-Key',randomUUID()).send(draft(name,'PCS','PIECE',1,rate)).expect(201);
  const ia=await db.item.findFirstOrThrow({where:{company_id:a.shop.company.id,name}}),ib=await db.item.findFirstOrThrow({where:{company_id:b.shop.company.id,name}});
  expect(ia.id).not.toBe(ib.id);expect(Number(ia.default_sale_rate)).toBe(11);expect(Number(ib.default_sale_rate)).toBe(23);
  await call('post','retail/bills',b).set('Idempotency-Key',randomUUID()).send({items:[{item_id:ia.id,quantity:1,rate:11}],payment_splits:[{method:'CASH',amount:11}]}).expect(400);
 });
 it('rejects draft-only item candidates on returns and server-held bills without catalog writes',async()=>{
  const row=shops[0],scope={company_id:row.shop.company.id},body=draft('Unsaved return candidate','PCS','PIECE',1,10);
  const original=await db.salesInvoice.findFirstOrThrow({where:scope});
  const count=await db.item.count({where:scope});
  await call('post','retail/bills/return',row).send({original_invoice_id:original.id,lines:body.items,refund_method:'CASH'}).expect(400);
  await call('post','retail/bills/hold',row).send({items:body.items}).expect(400);
  expect(await db.item.count({where:scope})).toBe(count);
 });
 it.each(['UPI','SPLIT'])('%s: candidate bills reconcile bank, cash and customer due through canonical posting',async mode=>{
  const row=shops[0],split=mode==='SPLIT';
  const customer=split?(await call('post','retail/customers',row).send({name:'Quick split customer',credit_allowed:true}).expect(201)).body:null;
  const before=(await call('get','retail/galla?date='+businessDate(),row).expect(200)).body;
  const body={...draft(mode+' new item','PCS','PIECE',1,100),...(customer?{customer_id:customer.id}:{}),payment_splits:split?[{method:'CASH',amount:30},{method:'UPI',amount:40}]:[{method:'UPI',amount:100}]};
  const bill=(await call('post','retail/bills',row).set('Idempotency-Key',randomUUID()).send(body).expect(201)).body;
  expect(Number(bill.paid_amount)).toBe(split?70:100);expect(Number(bill.outstanding_amount)).toBe(split?30:0);
  const receipts=await db.voucher.findMany({where:{company_id:row.shop.company.id,source_document_type:'POS_RECEIPT',source_document_id:bill.id,status:'POSTED'},include:{lines:{include:{ledger_account:true}}}});
  const debit=(code:string)=>receipts.flatMap(r=>r.lines).filter(l=>l.ledger_account.code===code).reduce((n,l)=>n+Number(l.debit),0);
  expect(debit('CASH_IN_HAND')).toBe(split?30:0);expect(debit('DEFAULT_BANK')).toBe(split?40:100);
  const after=(await call('get','retail/galla?date='+businessDate(),row).expect(200)).body;expect(Number(after.expected_cash)-Number(before.expected_cash)).toBe(split?30:0);
  if(customer){const khata=(await call('get','retail/customers/'+customer.id+'/khata',row).expect(200)).body;expect(Number(khata.balance)).toBe(30);}
 });
 it.each(['CLOTHING','FOOTWEAR'])('%s: contextual size setup reuses variants and posts size stock safely',async type=>{
  const row=shops.find(s=>s.type===type),name=type==='CLOTHING'?'Cotton Kurta':'Sports Shoe';
  let item=await db.item.findFirst({where:{company_id:row.shop.company.id,name}});
  if(!item){await call('post','retail/bills',row).set('Idempotency-Key',randomUUID()).send(draft(name,type==='CLOTHING'?'PCS':'PAIR','PIECE',1,650)).expect(201);item=await db.item.findFirstOrThrow({where:{company_id:row.shop.company.id,name}});}
  const variants=type==='CLOTHING'?['M','L'].flatMap(Size=>['Black','White'].map(Colour=>({attributes:{Size,Colour}}))):['UK 6','UK 7','UK 8'].map(Size=>({attributes:{Size}}));
  const first=(await call('post','retail/items/'+item!.id+'/variants/setup',row).send({variants}).expect(201)).body;
  expect(first.variants.length).toBe(type==='CLOTHING'?4:3);
  const retry=(await call('post','retail/items/'+item!.id+'/variants/setup',row).send({variants}).expect(201)).body;expect(retry.created).toBe(0);
  const supplier=(await call('post','retail/suppliers',row).send({name:'Size supplier'}).expect(201)).body;
  await call('post','retail/purchases',row).set('Idempotency-Key',randomUUID()).send({supplier_id:supplier.id,payment_status:'CREDIT',purchase_date:businessDate(),lines:[{item_id:item!.id,variant_id:first.variants[0].id,unit_id:item!.primary_unit_id,quantity:3,purchase_rate:100}]}).expect(201);
  await call('post','retail/bills',row).set('Idempotency-Key',randomUUID()).send({items:[{item_id:item!.id,variant_id:first.variants[0].id,quantity:1,rate:650}],payment_splits:[{method:'CASH',amount:650}],date:businessDate()}).expect(201);
  const stock=await db.stockBalanceProjection.findMany({where:{company_id:row.shop.company.id,item_id:item!.id,variant_id:first.variants[0].id}});expect(stock.reduce((n,r)=>n+Number(r.quantity),0)).toBe(2);
  await call('post','retail/items/'+item!.id+'/variants/setup',row).send({variants:[{attributes:variants[0].attributes,default_sale_rate:701}]}).expect(201);
  await call('post','retail/items/'+item!.id+'/variants/setup',row).send({variants:[variants[0]]}).expect(201);
  const quote=(await call('post','retail/bills/quote',row).send({items:[{item_id:item!.id,variant_id:first.variants[0].id,quantity:1,rate:0}],payment_splits:[]}).expect(201)).body;
  expect(Number(quote.grand_total)).toBe(701);
 });
 it('PHARMACY: buys five strips, prices tablets and strips separately, and reverses exact stock and cost on return',async()=>{
  const row=shops.find(s=>s.type==='PHARMACY'),scope={company_id:row.shop.company.id};
  const item=(await call('post','retail/items/inline',row).send({name:'Crocin 500mg configured',unit_code:'TABLET',selling_mode:'PIECE',selling_price:12,inventory_tracking:false,purchase_unit_code:'STRIP',purchase_unit_factor:10,purchase_unit_selling_price:110}).expect(201)).body;
  const options=(await call('get','retail/items/'+item.id+'/options',row).expect(200)).body,strip=options.unit_conversions[0].from_unit_id;
  await call('put','retail/items/'+item.id+'/unit-prices',row).send({prices:[{unit_id:item.primary_unit_id,selling_price:12},{unit_id:strip,selling_price:110}]}).expect(200);
  const supplier=(await call('post','retail/suppliers',row).send({name:'Medicine supplier'}).expect(201)).body;
  const purchase=(await call('post','retail/purchases',row).set('Idempotency-Key',randomUUID()).send({supplier_id:supplier.id,payment_status:'CREDIT',purchase_date:businessDate(),lines:[{item_id:item.id,unit_id:strip,quantity:5,purchase_rate:80}]}).expect(201)).body;
  expect(Number(purchase.grand_total)).toBe(400);
  const stock=async()=>Number((await db.stockBalanceProjection.findMany({where:{...scope,item_id:item.id}})).reduce((n,r)=>n+Number(r.quantity),0));expect(await stock()).toBe(50);
  const sell=async(unit_id:string,quantity:number,total:number)=>(await call('post','retail/bills',row).set('Idempotency-Key',randomUUID()).send({items:[{item_id:item.id,unit_id,quantity,rate:0}],payment_splits:[{method:'CASH',amount:total}],date:businessDate()}).expect(201)).body;
  const tablets=await sell(item.primary_unit_id,2,24);expect(Number(tablets.grand_total)).toBe(24);expect(await stock()).toBe(48);
  const pack=await sell(strip,1,110);expect(Number(pack.grand_total)).toBe(110);expect(Number(pack.lines[0].base_quantity)).toBe(10);expect(await stock()).toBe(38);
  const original=tablets.lines[0];
  const returned=(await call('post','retail/bills/return',row).set('Idempotency-Key',randomUUID()).send({original_invoice_id:tablets.id,refund_method:'CASH',lines:[{item_id:item.id,original_line_id:original.id,unit_id:item.primary_unit_id,quantity:1,rate:12}]}).expect(201)).body;
  expect(Number(returned.grand_total)).toBe(12);expect(await stock()).toBe(39);
  const cost=await db.inventoryCostState.findFirstOrThrow({where:{...scope,item_id:item.id}});expect(Number(cost.known_value)).toBe(312);expect(Number(cost.quantity)).toBe(39);
  const payable=(await call('get','retail/suppliers/'+supplier.id+'/khata',row).expect(200)).body;expect(Number(payable.balance)).toBe(400);
 });
 it.each([['HARDWARE','PVC Pipe','MTR','LENGTH','ROLL',50,2,5],['GROCERY','Boxed Chips','PKT','PIECE','BOX',10,2,3],['STATIONERY','Packed Pen','PCS','PIECE','PACK',10,2,3]] as const)('%s: purchase and sale packs use one stock balance',async(type,name,unit,mode,pack,factor,bought,sold)=>{
  const row=shops.find(s=>s.type===type),scope={company_id:row.shop.company.id};
  const item=(await call('post','retail/items/inline',row).send({name,unit_code:unit,selling_mode:mode,selling_price:80,inventory_tracking:false,purchase_unit_code:pack,purchase_unit_factor:factor}).expect(201)).body;
  const supplier=(await call('post','retail/suppliers',row).send({name:type+' pack supplier'}).expect(201)).body;
  await call('post','retail/purchases',row).set('Idempotency-Key',randomUUID()).send({supplier_id:supplier.id,payment_status:'CREDIT',purchase_date:businessDate(),lines:[{item_id:item.id,unit_id:item.purchase_unit_id,quantity:bought,purchase_rate:100}]}).expect(201);
  await call('post','retail/bills',row).set('Idempotency-Key',randomUUID()).send({items:[{item_id:item.id,quantity:sold,rate:80}],payment_splits:[{method:'CASH',amount:sold*80}],date:businessDate()}).expect(201);
  const stock=await db.stockBalanceProjection.findMany({where:{...scope,item_id:item.id}});expect(stock.reduce((n,r)=>n+Number(r.quantity),0)).toBe(bought*factor-sold);
 });
 it('RESTAURANT: existing optional add-ons price correctly without physical stock',async()=>{
  const row=shops.find(s=>s.type==='RESTAURANT');
  const item=(await call('post','retail/items/inline',row).send({name:'Configured Masala Tea',unit_code:'CUP',selling_price:20,inventory_tracking:false}).expect(201)).body;
  const configuration=(await call('put','retail/items/'+item.id+'/modifiers',row).send({groups:[{name:'Sugar',min_select:0,max_select:1,options:[{name:'Less sugar',price_delta:0},{name:'Extra milk',price_delta:5}]}]}).expect(200)).body;
  const option=configuration.modifier_groups[0].options.find((o:any)=>o.name==='Extra milk');
  const invoice=(await call('post','retail/bills',row).set('Idempotency-Key',randomUUID()).send({items:[{item_id:item.id,quantity:2,rate:20,modifier_option_ids:[option.id]}],payment_splits:[{method:'CASH',amount:50}],date:businessDate()}).expect(201)).body;
  expect(Number(invoice.grand_total)).toBe(50);expect(await db.stockMovement.count({where:{company_id:row.shop.company.id,item_id:item.id}})).toBe(0);
 });
 it('suggests contextual enrichment only after repeated actual bills, with snooze and a maximum of three',async()=>{
  const row=shops.find(s=>s.type==='CLOTHING'),name='Repeated simple dress';
  const saved=(await call('post','retail/bills',row).set('Idempotency-Key',randomUUID()).send(draft(name,'PCS','PIECE',1,200)).expect(201)).body;
  const itemId=saved.lines[0].item_id;
  const before=(await call('get','retail/account/experience',row).expect(200)).body;expect(before.suggestions.some((r:any)=>r.id==='enrich:'+itemId)).toBe(false);
  await call('post','retail/bills',row).set('Idempotency-Key',randomUUID()).send({items:[{item_id:itemId,quantity:1,rate:200}],payment_splits:[{method:'CASH',amount:200}],date:businessDate()}).expect(201);
  const after=(await call('get','retail/account/experience',row).expect(200)).body;expect(after.suggestions.length).toBeLessThanOrEqual(3);
  const suggestion=after.suggestions.find((r:any)=>r.id==='enrich:'+itemId);expect(suggestion.kind).toBe('REPEATED_MINIMAL_ITEM');expect(suggestion.facts.sales_count).toBe(2);expect(suggestion.action.path).toContain('#item-size-setup');
  const snoozed=(await call('get','retail/account/experience?dismissed='+encodeURIComponent(suggestion.id),row).expect(200)).body;expect(snoozed.suggestions.some((r:any)=>r.id===suggestion.id)).toBe(false);
 });
 it('preserves Starter restrictions for pharmacy packs, batches, serials, variants and measured candidates',async()=>{
  const password='SyntheticStarter!'+randomUUID(),shop=await app.get(TenantProvisioningService).provisionTenant({planId:(await db.plan.findUniqueOrThrow({where:{code:'STARTER'}})).id,organizationName:'Quick Starter '+randomUUID(),businessType:'PHARMACY',adminName:'Synthetic starter',adminEmail:randomUUID()+'@test.invalid',adminPassword:password});
  const row={shop,token:(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:shop.user.username,password}).expect(200)).body.access_token};
  const simple=(await call('post','retail/bills',row).set('Idempotency-Key',randomUUID()).send(draft('Starter simple','TABLET','PIECE',1,12)).expect(201)).body,itemId=simple.lines[0].item_id;
  await call('post','retail/items/'+itemId+'/unit-conversions',row).send({unit_code:'STRIP',conversion_factor:10,selling_price:110}).expect(403);
  await call('post','retail/items/'+itemId+'/variants/setup',row).send({variants:[{attributes:{Size:'M'}}]}).expect(403);
  for(const field of ['track_serial','track_batch'])await call('post','retail/items/'+itemId,row).send({[field]:true,inventory_tracking:true}).expect(403);
  await call('post','retail/bills',row).set('Idempotency-Key',randomUUID()).send(draft('Forbidden measured','MTR','LENGTH',2,10)).expect(403);
  expect(await db.item.count({where:{company_id:shop.company.id,name:'Forbidden measured'}})).toBe(0);
 });
});
