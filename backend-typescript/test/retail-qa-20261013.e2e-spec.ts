import {Test} from '@nestjs/testing';
import {INestApplication,RequestMethod,ValidationPipe} from '@nestjs/common';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {AppModule} from '../src/app.module';
import {PrismaService} from '../src/database/prisma.service';
import {TenantProvisioningService} from '../src/platform/provisioning/tenant-provisioning.service';
import {businessTypeCatalog} from '../src/auth/business-types';

describe('Retail QA: protected removal, stock posting and four shop workflows',()=>{
  let app:INestApplication,db:PrismaService,pipe:any,fresh:any,purchased:any,supplier:any,variant:any,medicine:any;
  const shops:Record<string,any>={},tokens:Record<string,string>={},suffix=randomUUID(),password='Disposable!'+randomUUID();
  const call=(method:'get'|'post'|'delete',path:string,type='HARDWARE')=>request(app.getHttpServer())[method]('/api/v1/'+path)
    .set('Authorization','Bearer '+tokens[type]).set('X-Company-Id',shops[type].company.id).set('X-Branch-Id',shops[type].branch.id).set('X-Financial-Year-Id',shops[type].financialYear.id);
  const create=async(name:string,extra:any={},type='HARDWARE')=>(await call('post','retail/items',type).send({name:'TEST-QA '+name+' '+suffix,selling_price:180,...extra}).expect(201)).body;
  const bill=(item:any,quantity:number)=>({items:[{item_id:item.id,quantity,rate:180}],payment_splits:[{method:'CASH',amount:quantity*180}],date:new Date().toISOString()});
  beforeAll(async()=>{
    app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication({logger:false});
    app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
    const smart=await db.plan.findUniqueOrThrow({where:{code:'SMART'}}),starter=await db.plan.findUniqueOrThrow({where:{code:'STARTER'}});
    for(const type of ['HARDWARE','CLOTHING','PHARMACY','FOOTWEAR','PHARMACY_STARTER']){
      const shop=await app.get(TenantProvisioningService).provisionTenant({organizationName:'TEST-QA '+type+' '+suffix,adminName:'Test Owner',adminEmail:type.toLowerCase()+'-'+suffix+'@test.invalid',adminPassword:password,businessType:type==='PHARMACY_STARTER'?'PHARMACY':type,planId:type==='PHARMACY_STARTER'?starter.id:smart.id});
      shops[type]=shop;tokens[type]=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:shop.user.username,password}).expect(200)).body.access_token;
    }
    supplier=(await call('post','retail/suppliers').send({name:'TEST-QA Hardware Supplier '+suffix}).expect(201)).body;
    pipe=await create('PVC Pipe',{unit_code:'MTR',selling_mode:'LENGTH',opening_stock:20,opening_cost:100,gst_rate:18});
    fresh=await create('Unused Zero Stock');purchased=await create('Purchased Item');
    await call('post','retail/purchases').send({supplier_id:supplier.id,payment_status:'CREDIT',lines:[{item_id:purchased.id,quantity:2,purchase_rate:100}]}).expect(201);
  },60000);
  afterAll(async()=>{await app?.close();});

  it('unused zero-stock item requires explicit permanent-delete confirmation',async()=>{
    await call('get','retail/items/not-a-uuid/removal').expect(400);
    await call('post','retail/items/removal').send({ids:['not-a-uuid'],action:'ARCHIVE'}).expect(400);
    const item=await create('Delete Eligible',{barcode:'DELETE-'+suffix});expect((await call('get','retail/items/'+item.id+'/removal').expect(200)).body.can_permanently_delete).toBe(true);
    await call('post','retail/items/removal').send({ids:[item.id],action:'DELETE'}).expect(400);
    await call('post','retail/items/removal').send({ids:[item.id],action:'DELETE',confirmation:'DELETE PERMANENTLY'}).expect(201);
    expect(await db.item.findUnique({where:{id:item.id}})).toBeNull();expect(await db.itemBarcode.count({where:{item_id:item.id}})).toBe(0);
  });
  it('opening stock, purchases and sale history protect permanent deletion',async()=>{
    for(const item of [pipe,purchased]){expect((await call('get','retail/items/'+item.id+'/removal').expect(200)).body.can_permanently_delete).toBe(false);await call('post','retail/items/removal').send({ids:[item.id],action:'DELETE',confirmation:'DELETE PERMANENTLY'}).expect(400);}
    const sold=await create('Sold History',{opening_stock:1,opening_cost:40});await call('post','retail/bills').send(bill(sold,1)).expect(201);
    expect((await call('get','retail/items/'+sold.id+'/removal').expect(200)).body.can_permanently_delete).toBe(false);
    await call('post','retail/items/removal').send({ids:[sold.id],action:'ARCHIVE'}).expect(201);
    expect(await db.salesInvoiceLine.count({where:{item_id:sold.id}})).toBe(1);
  });
  it('mixed bulk permanent delete is atomic and tenant IDs cannot cross boundaries',async()=>{
    await call('post','retail/items/removal').send({ids:[fresh.id,pipe.id],action:'DELETE',confirmation:'DELETE PERMANENTLY'}).expect(400);
    expect(await db.item.findUnique({where:{id:fresh.id}})).not.toBeNull();
    await call('get','retail/items/'+pipe.id+'/removal','CLOTHING').expect(404);
    await call('post','retail/items/removal','CLOTHING').send({ids:[pipe.id],action:'ARCHIVE'}).expect(404);
  });
  it('278 MTR with 20 available is rejected at final posting, with no partial financial or stock writes',async()=>{
    const company=shops.HARDWARE.company.id,before={sales:await db.salesInvoice.count({where:{company_id:company}}),vouchers:await db.voucher.count({where:{company_id:company}}),movements:await db.stockMovement.count({where:{item_id:pipe.id}})};
    const result=await call('post','retail/bills').send({...bill(pipe,278),payment_splits:[{method:'CASH',amount:59047.20}]}).expect(400);
    expect(JSON.stringify(result.body)).toMatch(/stock|insufficient/i);
    expect(await db.salesInvoice.count({where:{company_id:company}})).toBe(before.sales);expect(await db.voucher.count({where:{company_id:company}})).toBe(before.vouchers);expect(await db.stockMovement.count({where:{item_id:pipe.id}})).toBe(before.movements);
    expect(Number((await db.stockBalanceProjection.aggregate({where:{item_id:pipe.id},_sum:{quantity:true}}))._sum.quantity)).toBe(20);
  });
  it('GST quote uses the existing exclusive calculation and exposes accurate amounts',async()=>{
    const quote=(await call('post','retail/bills/quote').send({...bill(pipe,278),payment_splits:[]}).expect(201)).body;
    expect(quote.lines[0].taxable_value).toBe(50040);expect(quote.lines[0].tax_amount).toBe(9007.2);expect(quote.grand_total).toBe(59047.2);
  });
  it('concurrent 15 + 10 sales against 20 allow exactly one sale and never oversell',async()=>{
    const item=await create('Concurrent Pipe',{unit_code:'MTR',selling_mode:'LENGTH',opening_stock:20,opening_cost:100});
    const responses=await Promise.all([call('post','retail/bills').send(bill(item,15)),call('post','retail/bills').send(bill(item,10))]);
    expect(responses.map(r=>r.status).sort()).toEqual([201,400]);
    const balance=Number((await db.stockBalanceProjection.aggregate({where:{item_id:item.id},_sum:{quantity:true}}))._sum.quantity);expect([5,10]).toContain(balance);
    expect(await db.salesInvoiceLine.count({where:{item_id:item.id}})).toBe(1);
  });
  it('stocked archive preserves quantity, cost valuation, movements and stock reports without creating adjustment',async()=>{
    const before=await db.stockMovement.count({where:{item_id:pipe.id}}),adjustments=await db.stockAdjustment.count({where:{company_id:shops.HARDWARE.company.id}});
    await call('post','retail/items/removal').send({ids:[pipe.id],action:'ARCHIVE'}).expect(201);
    expect(await db.stockMovement.count({where:{item_id:pipe.id}})).toBe(before);expect(await db.stockAdjustment.count({where:{company_id:shops.HARDWARE.company.id}})).toBe(adjustments);
    expect(Number((await db.stockBalanceProjection.aggregate({where:{item_id:pipe.id},_sum:{quantity:true}}))._sum.quantity)).toBe(20);
    const active=(await call('get','retail/items?search='+encodeURIComponent(suffix)).expect(200)).body;expect(active.some((i:any)=>i.id===pipe.id)).toBe(false);
    expect((await call('get','retail/items?include_inactive=true&search='+encodeURIComponent(suffix)).expect(200)).body.some((i:any)=>i.id===pipe.id)).toBe(true);
    const valuation=(await call('get','retail/reports/financial/valuation?item_id='+pipe.id).expect(200)).body;expect(Number(valuation.rows[0].inventory_value)).toBe(2000);
    const stock=(await call('get','retail/reports/stock?item_id='+pipe.id).expect(200)).body;expect(JSON.stringify(stock)).toContain(pipe.id);expect(JSON.stringify(stock)).toContain('"archived":true');
    await call('post','retail/bills').send({...bill(pipe,1),payment_splits:[{method:'CASH',amount:212.4}]}).expect(400);
  });
  it('write-off uses authoritative adjustment and a separate audit event',async()=>{
    await call('post','inventory/adjustments').send({adjustment_type:'OUT',narration:'TEST-QA separate write-off',lines:[{item_id:pipe.id,godown_id:shops.HARDWARE.godown.id,unit_id:pipe.primary_unit_id,quantity:20}]}).expect(201);
    expect(Number((await db.stockBalanceProjection.aggregate({where:{item_id:pipe.id},_sum:{quantity:true}}))._sum.quantity)).toBe(0);
    expect(await db.auditLog.count({where:{company_id:shops.HARDWARE.company.id,action:'RETAIL_ITEM_ARCHIVED',details:{contains:pipe.id}}})).toBe(1);
    expect(await db.auditLog.count({where:{company_id:shops.HARDWARE.company.id,action:'STOCK_ADJUSTMENT_POSTED'}})).toBeGreaterThan(0);
    expect((await call('get','retail/items/'+pipe.id+'/removal').expect(200)).body.can_permanently_delete).toBe(false);
  });
  it('purchase status is explicit; Paid, Credit and Partial preserve the existing supplier due rules',async()=>{
    const supplier=(await call('post','retail/suppliers').send({name:'TEST-QA Payment Supplier '+suffix}).expect(201)).body;
    await call('post','retail/purchases').send({supplier_id:supplier.id,total_amount:100}).expect(400);
    for(const [status,paid,due] of [['PAID',undefined,0],['CREDIT',undefined,100],['PARTIAL',40,60]] as const){
      const invoice=(await call('post','retail/purchases').send({supplier_id:supplier.id,total_amount:100,payment_status:status,paid_amount:paid,payment_method:'CASH'}).expect(201)).body;
      expect(Number(invoice.outstanding_amount)).toBe(due);
    }
    const timeline=(await call('get','retail/suppliers/'+supplier.id+'/khata').expect(200)).body;expect(Number(timeline.balance)).toBe(160);
  });
  it('Pharmacy aliases and Starter entitlement restrictions are present without mandatory batch on general goods',async()=>{
    const type=businessTypeCatalog().find(t=>t.code==='PHARMACY')!;
    for(const word of ['pharmacy','medical','chemist','medicine'])expect([type.name,...type.keywords].join(' ').toLowerCase()).toContain(word);
    const access=(await call('get','retail/account/subscription','PHARMACY_STARTER').expect(200)).body;expect(access.business_type).toBe('PHARMACY');expect(access.entitlements.features.find((f:any)=>f.code==='BATCH_TRACKING').plan_entitled).toBe(false);
    const general=await create('Medical General Goods',{},'PHARMACY');expect(general.track_batch).toBe(false);
    medicine=await create('Medicine',{track_batch:true,unit_code:'PKT'},'PHARMACY');
    const supplier=(await call('post','retail/suppliers','PHARMACY').send({name:'TEST-QA Medical Supplier '+suffix}).expect(201)).body;
    await call('post','retail/purchases','PHARMACY').send({supplier_id:supplier.id,payment_status:'PAID',lines:[{item_id:medicine.id,quantity:3,purchase_rate:50}]}).expect(400);
    await call('post','retail/purchases','PHARMACY').send({supplier_id:supplier.id,payment_status:'PAID',lines:[{item_id:medicine.id,quantity:3,purchase_rate:50,batch_number:'TEST-MED',expiry_date:'2030-01-01',manufacturing_date:'2026-10-01'}]}).expect(201);
    expect((await call('get','retail/items/'+medicine.id+'/removal','PHARMACY').expect(200)).body.can_permanently_delete).toBe(false);
  });
  it('Clothing and Footwear variants start at zero and are received for the selected item/variant',async()=>{
    for(const type of ['CLOTHING','FOOTWEAR']){
      const item=await create(type==='CLOTHING'?'T-shirt':'Sneaker',{has_variants:true,unit_code:type==='FOOTWEAR'?'PAIR':'PCS'},type);
      expect(Number((await db.stockBalanceProjection.aggregate({where:{item_id:item.id},_sum:{quantity:true}}))._sum.quantity||0)).toBe(0);
      variant=(await call('post','retail/items/'+item.id+'/variants',type).send({attributes:{size:type==='CLOTHING'?'M':'9',colour:'Black'},sku:'TEST-VAR-'+type+'-'+suffix}).expect(201)).body;
      const supplier=(await call('post','retail/suppliers',type).send({name:'TEST-QA '+type+' Supplier '+suffix}).expect(201)).body;
      await call('post','retail/purchases',type).send({supplier_id:supplier.id,payment_status:'PAID',lines:[{item_id:item.id,variant_id:variant.id,quantity:2,purchase_rate:80}]}).expect(201);
      expect(Number((await db.stockBalanceProjection.aggregate({where:{item_id:item.id,variant_id:variant.id},_sum:{quantity:true}}))._sum.quantity)).toBe(2);
      shops[type].testItem=item;
    }
    const directory=resolve(process.cwd(),'../output/retail-qa-20261013');mkdirSync(directory,{recursive:true});
    writeFileSync(resolve(directory,'private-fixtures.json'),JSON.stringify({shops:Object.fromEntries(Object.entries(shops).map(([type,s])=>[type,{username:s.user.username,password,company:s.company.id,branch:s.branch.id,year:s.financialYear.id,item:s.testItem}])),pipe,fresh,purchased,medicine},null,2));
  });
});
