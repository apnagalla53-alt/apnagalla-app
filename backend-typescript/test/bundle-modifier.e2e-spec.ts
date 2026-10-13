import {Test} from '@nestjs/testing';
import {INestApplication,RequestMethod,ValidationPipe} from '@nestjs/common';
import request from 'supertest';
import {randomUUID} from 'crypto';
import {AppModule} from '../src/app.module';
import {PrismaService} from '../src/database/prisma.service';
import {TenantProvisioningService} from '../src/platform/provisioning/tenant-provisioning.service';
import {businessDate} from '../src/common/business-date';
describe('Bundle and modifier HTTP posting, immutable returns and tenant isolation',()=>{
 let app:INestApplication,db:PrismaService,A:any,B:any,token:string,otherToken:string,component:any,second:any,service:any,bundle:any,modified:any,foreign:any,supplier:any,sold:any;
 const date=businessDate(),password='DisposableComposition!764',suffix=Date.now();
 const call=(method:string,path:string,shop=A,credential=token)=>(request(app.getHttpServer()) as any)[method]('/api/v1/retail/'+path).set('Authorization','Bearer '+credential).set('X-Company-Id',shop.company.id).set('X-Branch-Id',shop.branch.id).set('X-Financial-Year-Id',shop.financialYear.id);
 const create=async(data:any,shop=A,credential=token)=>(await call('post','items',shop,credential).send(data).expect(201)).body;
 const stock=async(id:string)=>Number((await db.stockBalanceProjection.aggregate({where:{company_id:A.company.id,item_id:id},_sum:{quantity:true}}))._sum.quantity||0);
 const sale=(id:string,quantity=1,extra:any={},price=100)=>call('post','bills').send({items:[{item_id:id,quantity,rate:price,...extra}],payment_splits:[{method:'CASH',amount:quantity*price}],date});
 beforeAll(async()=>{
  app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
  const provision=(name:string)=>app.get(TenantProvisioningService).provisionTenant({organizationName:name,adminName:'Composition Owner',adminEmail:name+'@test.invalid',adminPassword:password});
  A=await provision('composition-a-'+suffix);B=await provision('composition-b-'+suffix);
  const features=await db.feature.findMany({where:{code:{in:['BUNDLES','MODIFIERS','SERVICES','BATCH_TRACKING','SERIAL_TRACKING','VARIANTS','MULTI_UNIT']}}});
  await db.tenantEntitlement.createMany({data:[A,B].flatMap(shop=>features.map(f=>({organization_id:shop.organization.id,feature_id:f.id,is_enabled:true}))),skipDuplicates:true});
  const login=async(shop:any)=>(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:shop.user.username,password}).expect(200)).body.access_token;
  token=await login(A);otherToken=await login(B);
  component=await create({name:'Pencil',selling_price:10});second=await create({name:'Notebook',selling_price:20});service=await create({name:'Packing',selling_price:5,selling_mode:'SERVICE'});bundle=await create({name:'School Kit',selling_price:100,is_bundle:true});modified=await create({name:'Service with choices',selling_price:100,selling_mode:'SERVICE',gst_rate:18});foreign=await create({name:'Foreign component',selling_price:10,opening_stock:5},B,otherToken);
  supplier=(await call('post','suppliers').send({name:'Kit supplier'}).expect(201)).body;
 });
 afterAll(async()=>{
  if(A&&B){const scope={company_id:{in:[A.company.id,B.company.id]}};await db.posHeldBill.deleteMany({where:scope});await db.itemBundleComponent.deleteMany({where:{bundle_item:scope}});await db.requestIdempotency.deleteMany({where:scope});await db.auditLog.deleteMany({where:scope});await db.stockMovement.deleteMany({where:scope});await db.stockBalanceProjection.deleteMany({where:scope});await db.billAllocation.deleteMany({where:scope});await db.voucherLine.deleteMany({where:{voucher:scope}});await db.voucher.deleteMany({where:scope});await db.salesReturn.deleteMany({where:scope});await db.salesInvoice.deleteMany({where:scope});await db.goodsReceipt.deleteMany({where:scope});await db.purchaseInvoice.deleteMany({where:scope});await db.purchaseOrder.deleteMany({where:scope});await db.openingStock.deleteMany({where:scope});await db.pricingTrace.deleteMany({where:scope});await db.item.deleteMany({where:scope});}await app.close();
 });
 it('receives component stock through the Purchase facade and authoritative posting',async()=>{
  await call('post','purchases').send({supplier_id:supplier.id,payment_status:'CREDIT',purchase_date:date,lines:[{item_id:component.id,quantity:10,purchase_rate:5},{item_id:second.id,quantity:10,purchase_rate:10}]}).expect(201);expect(await stock(component.id)).toBe(10);expect(await stock(second.id)).toBe(10);
 });
 it('rejects missing recipe, foreign component, self/nested and serial components',async()=>{
  await sale(bundle.id).expect(400);
  for(const id of [foreign.id,bundle.id])await call('put','items/'+bundle.id+'/bundle').send({components:[{item_id:id,quantity:1}]}).expect(400);
  const serial=await create({name:'Tracked component',selling_price:100,track_serial:true});await call('put','items/'+bundle.id+'/bundle').send({components:[{item_id:serial.id,quantity:1}]}).expect(400);
 });
 it('saves a recipe with physical and service components and bills only physical movements',async()=>{
  const recipe=await call('put','items/'+bundle.id+'/bundle').send({components:[{item_id:component.id,quantity:2},{item_id:second.id,quantity:1},{item_id:service.id,quantity:1}]}).expect(200);expect(recipe.body.bundle_components).toHaveLength(3);
  sold=(await sale(bundle.id,2).expect(201)).body;expect(Number(sold.grand_total)).toBe(200);expect(await stock(component.id)).toBe(6);expect(await stock(second.id)).toBe(8);expect(await stock(bundle.id)).toBe(0);expect(await stock(service.id)).toBe(0);
  const line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:sold.id}});expect((line.bundle_snapshot as any).components).toHaveLength(3);
 });
 it('returns the original composition after the catalog recipe changes',async()=>{
  await call('put','items/'+bundle.id+'/bundle').send({components:[{item_id:second.id,quantity:3}]}).expect(200);
  const source=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:sold.id}});
  const body={original_invoice_id:sold.id,lines:[{item_id:bundle.id,quantity:2,rate:1,original_line_id:source.id}],refund_method:'CASH'};
  await call('post','bills/return').send(body).expect(201);expect(await stock(component.id)).toBe(10);expect(await stock(second.id)).toBe(10);await call('post','bills/return').send(body).expect(400);
 });
 it('prevents concurrent last-component sales and rolls back losing invoices',async()=>{
  const last=await create({name:'Last component',selling_price:5,opening_stock:1}),kit=await create({name:'Last kit',selling_price:100,is_bundle:true});await call('put','items/'+kit.id+'/bundle').send({components:[{item_id:last.id,quantity:1}]}).expect(200);
  const results=await Promise.all([sale(kit.id),sale(kit.id)]);expect(results.map(r=>r.status).sort()).toEqual([201,400]);expect(await stock(last.id)).toBe(0);expect(await db.salesInvoiceLine.count({where:{item_id:kit.id}})).toBe(1);
 });
 it('consumes batch components by FEFO and restores the actual original lot',async()=>{
  const batchItem=await create({name:'Lot component',selling_price:5,track_batch:true}),kit=await create({name:'Lot kit',selling_price:100,is_bundle:true});
  await call('post','purchases').send({supplier_id:supplier.id,payment_status:'CREDIT',lines:[{item_id:batchItem.id,quantity:2,purchase_rate:1,batch_number:'FIRST',expiry_date:'2028-01-01'},{item_id:batchItem.id,quantity:2,purchase_rate:1,batch_number:'SECOND',expiry_date:'2029-01-01'}]}).expect(201);
  await call('put','items/'+kit.id+'/bundle').send({components:[{item_id:batchItem.id,quantity:1}]}).expect(200);const invoice=(await sale(kit.id).expect(201)).body,line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:invoice.id}}),snap=line.bundle_snapshot as any;
  const first=await db.itemBatch.findFirstOrThrow({where:{item_id:batchItem.id,batch_number:'FIRST'}});expect(snap.components[0].allocations[0].batch_id).toBe(first.id);
  await call('post','bills/return').send({original_invoice_id:invoice.id,lines:[{item_id:kit.id,quantity:1,rate:100,original_line_id:line.id}],refund_method:'CASH'}).expect(201);expect(await stock(batchItem.id)).toBe(4);
 });
 it('enforces modifier choices, price/tax and immutable invoice snapshots',async()=>{
  const configured=(await call('put','items/'+modified.id+'/modifiers').send({groups:[{name:'Packing',min_select:1,max_select:1,options:[{name:'Premium',price_delta:20},{name:'Standard',price_delta:0}]}]}).expect(200)).body;
  const option=configured.modifier_groups[0].options.find((o:any)=>o.name==='Premium').id;
  await sale(modified.id).expect(400);await sale(modified.id,1,{modifier_option_ids:[randomUUID()]}).expect(400);await sale(modified.id,1,{modifier_option_ids:[option,option]}).expect(400);
  const body={items:[{item_id:modified.id,quantity:1,rate:100,modifier_option_ids:[option]}],payment_splits:[{method:'CASH',amount:141.6}]};
  const quote=await call('post','bills/quote').send(body).expect(201);expect(quote.body.grand_total).toBe(141.6);
  const invoice=(await call('post','bills').send(body).expect(201)).body,line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:invoice.id}});expect(Number(line.taxable_value)).toBe(120);expect(Number(line.tax_amount)).toBe(21.6);expect((line.modifier_snapshot as any).groups[0].options[0].name).toBe('Premium');
  await call('put','items/'+modified.id+'/modifiers').send({groups:[]}).expect(200);await call('post','bills/return').send({original_invoice_id:invoice.id,lines:[{item_id:modified.id,quantity:1,rate:1,original_line_id:line.id}],refund_method:'CASH'}).expect(201);
  expect(Number((await db.salesReturn.findFirstOrThrow({where:{original_invoice_id:invoice.id}})).grand_total)).toBe(141.6);
 });
 it('preserves modifier choices through Hold and Resume',async()=>{
  const configured=(await call('put','items/'+modified.id+'/modifiers').send({groups:[{name:'Choice',min_select:0,max_select:1,options:[{name:'Extra',price_delta:5}]}]}).expect(200)).body,option=configured.modifier_groups[0].options[0].id;
  const held=(await call('post','bills/hold').send({items:[{item_id:modified.id,quantity:1,rate:100,modifier_option_ids:[option]}]}).expect(201)).body;
  const resumed=(await call('post','bills/hold/'+held.id+'/resume').send({}).expect(201)).body;expect(resumed.lines[0].modifiers.option_ids).toEqual([option]);
 });
 it('denies foreign composition reads/writes and foreign modifier selection',async()=>{
  await call('get','items/'+foreign.id+'/composition').expect(404);await call('put','items/'+foreign.id+'/modifiers').send({groups:[]}).expect(400);
  const configured=(await call('put','items/'+foreign.id+'/modifiers',B,otherToken).send({groups:[{name:'Foreign choice',min_select:0,max_select:1,options:[{name:'Extra',price_delta:5}]}]}).expect(200)).body;await sale(modified.id,1,{modifier_option_ids:[configured.modifier_groups[0].options[0].id]}).expect(400);
 });
 it('configures variants through HTTP and enforces duplicates, SKU policy and ownership',async()=>{
  const item=await create({name:'Shirt',selling_price:100,has_variants:true});
  const variant=(await call('post','items/'+item.id+'/variants').send({attributes:{Size:'Large',Colour:'Blue'},sku:'SHIRT-L-BLUE',default_sale_rate:120}).expect(201)).body;
  await call('post','items/'+item.id+'/variants').send({attributes:{Colour:'Blue',Size:'Large'}}).expect(400);
  await call('post','items').send({name:'Duplicate variant SKU',selling_price:100,sku:'shirt-l-blue'}).expect(400);
  await call('post','items/'+component.id).send({sku:'SHIRT-L-BLUE'}).expect(400);
  await call('post','items/'+item.id+'/variants').send({attributes:{Size:'Small'},sku:component.sku}).expect(400);
  await call('post','items/'+foreign.id+'/variants').send({attributes:{Size:'Small'}}).expect(400);
  const other=await create({name:'Other shirt',selling_price:100,has_variants:true},B,otherToken);
  await call('post','items/'+other.id+'/variants',B,otherToken).send({attributes:{Size:'Large'},sku:'SHIRT-L-BLUE'}).expect(201);
  await call('post','purchases').send({supplier_id:supplier.id,payment_status:'CREDIT',lines:[{item_id:item.id,variant_id:variant.id,quantity:3,purchase_rate:50}]}).expect(201);
  await sale(item.id,1,{variant_id:variant.id}).expect(201);
  expect(Number((await db.stockBalanceProjection.aggregate({where:{item_id:item.id,variant_id:variant.id},_sum:{quantity:true}}))._sum.quantity)).toBe(2);
 });
 it('configures pack units through HTTP and preserves base quantity snapshots',async()=>{
  const item=await create({name:'Pack item',selling_price:100});
  const conversion=(await call('post','items/'+item.id+'/unit-conversions').send({unit_code:'CASE',conversion_factor:10}).expect(201)).body;
  await call('post','items/'+item.id+'/unit-conversions').send({unit_code:'CASE',conversion_factor:12}).expect(400);
  await call('post','items/'+item.id+'/unit-conversions').send({unit_code:'HALF',conversion_factor:.5}).expect(400);
  await call('post','items/'+foreign.id+'/unit-conversions').send({unit_code:'CASE',conversion_factor:10}).expect(400);
  await call('post','purchases').send({supplier_id:supplier.id,payment_status:'CREDIT',lines:[{item_id:item.id,unit_id:conversion.from_unit_id,quantity:2,purchase_rate:50}]}).expect(201);
  expect(await stock(item.id)).toBe(20);
  const invoice=(await sale(item.id,1,{unit_id:conversion.from_unit_id}).expect(201)).body;
  const line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:invoice.id}});expect(Number(line.base_quantity)).toBe(10);expect(Number(line.conversion_factor)).toBe(10);expect(await stock(item.id)).toBe(10);
 });
 it('returns newly created items even beyond the first catalog page',async()=>{
  await db.item.createMany({data:Array.from({length:105},(_,i)=>({company_id:A.company.id,name:'A pagination fixture '+i,sku:'PAGE-'+suffix+'-'+i,item_type:'STOCK_ITEM',primary_unit_id:component.primary_unit_id,default_sale_rate:1}))});
  const result=await call('post','items').send({name:'ZZZ new page item',selling_price:100}).expect(201);
  expect(result.body.name).toBe('ZZZ new page item');expect(result.body.id).toBeTruthy();
  const first=await call('get','items').expect(200);expect(first.body).toHaveLength(100);expect(first.body.some((i:any)=>i.id===result.body.id)).toBe(false);
 });
 it('enforces service, variant and unit feature removal on configuration writes',async()=>{
  const item=await create({name:'Feature shirt',selling_price:100,has_variants:true});
  for(const code of ['SERVICES','VARIANTS','MULTI_UNIT']) {
   const feature=await db.feature.findUniqueOrThrow({where:{code}});await db.tenantEntitlement.updateMany({where:{organization_id:A.organization.id,feature_id:feature.id},data:{is_enabled:false}});
  }
  await call('post','items').send({name:'Denied service',selling_price:100,selling_mode:'SERVICE'}).expect(403);
  await call('post','items/'+item.id+'/variants').send({attributes:{Size:'Large'}}).expect(403);
  await call('post','items/'+component.id+'/unit-conversions').send({unit_code:'CASE',conversion_factor:10}).expect(403);
 });
 it('enforces entitlement removal while preserving existing recipes and invoices',async()=>{
  const f=await db.feature.findUniqueOrThrow({where:{code:'BUNDLES'}});await db.tenantEntitlement.updateMany({where:{organization_id:A.organization.id,feature_id:f.id},data:{is_enabled:false}});await sale(bundle.id).expect(403);await call('put','items/'+bundle.id+'/bundle').send({components:[{item_id:component.id,quantity:1}]}).expect(403);expect(await db.salesInvoice.count({where:{id:sold.id}})).toBe(1);
 });
 it('leaves every posted voucher balanced with no bundle parent stock movements',async()=>{
  const vouchers=await db.voucher.findMany({where:{company_id:A.company.id,status:'POSTED'},include:{lines:true}});for(const v of vouchers)expect(v.lines.reduce((sum,l)=>sum+Number(l.debit)-Number(l.credit),0)).toBeCloseTo(0,6);expect(await db.stockMovement.count({where:{item_id:bundle.id}})).toBe(0);
 });
});
