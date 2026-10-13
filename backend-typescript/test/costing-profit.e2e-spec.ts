import {Test} from '@nestjs/testing';
import {INestApplication,ValidationPipe,RequestMethod} from '@nestjs/common';
import request from 'supertest';
import {randomUUID} from 'crypto';
import {AppModule} from '../src/app.module';
import {PrismaService} from '../src/database/prisma.service';
import {TenantProvisioningService} from '../src/platform/provisioning/tenant-provisioning.service';
import {InventoryPostingService} from '../src/inventory/posting.service';
import {businessDate} from '../src/common/business-date';
import {StockAdjustmentService} from '../src/inventory/adjustment.service';
import {StockTransferService} from '../src/inventory/transfer.service';
import {StockCountService} from '../src/inventory/stock-count.service';
import {PostingService as PurchasePostingService} from '../src/purchase/posting.service';
import {SalesPostingService} from '../src/sales/posting.service';
import * as bcrypt from 'bcrypt';

describe('Phase 5.6 authoritative costing and profit HTTP/DB lifecycle',()=>{
 let app:INestApplication,db:PrismaService,A:any,B:any,token:string,otherToken:string,supplier:any,pcs:any,life:any,sold:any;
 const date=businessDate(),suffix=randomUUID(),password='DisposableCosting!739';
 const call=(method:string,path:string,shop=A,credential=token)=>(request(app.getHttpServer()) as any)[method]('/api/v1/retail/'+path)
  .set('Authorization','Bearer '+credential).set('X-Company-Id',shop.company.id).set('X-Branch-Id',shop.branch.id).set('X-Financial-Year-Id',shop.financialYear.id);
 const item=async(name:string,extra:any={})=>(await call('post','items').send({name,selling_price:15,unit_code:'PCS',...extra}).expect(201)).body;
 const buy=(id:string,quantity:number,rate:number,extra:any={})=>call('post','purchases').send({supplier_id:supplier.id,payment_status:'CREDIT',purchase_date:date,lines:[{item_id:id,quantity,purchase_rate:rate,...extra}]}).expect(201);
 const sell=(id:string,quantity:number,rate:number,extra:any={})=>call('post','bills').send({items:[{item_id:id,quantity,rate,...extra}],payment_splits:[{method:'CASH',amount:quantity*rate}],date}).expect(201);
 const state=(id:string,variant='BASE')=>db.inventoryCostState.findUniqueOrThrow({where:{company_id_item_id_variant_key:{company_id:A.company.id,item_id:id,variant_key:variant}}});
 beforeAll(async()=>{
  const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();
  app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});
  app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true}));await app.init();db=app.get(PrismaService);
  const provision=async(name:string)=>app.get(TenantProvisioningService).provisionTenant({planId:(await db.plan.findUniqueOrThrow({where:{code:'PRO'}})).id,organizationName:name,adminName:'Cost Owner',adminEmail:name+'@test.invalid',adminPassword:password});
  A=await provision('cost-a-'+suffix);B=await provision('cost-b-'+suffix);
  const features=await db.feature.findMany({where:{code:{in:['BUNDLES','MODIFIERS','SERVICES','BATCH_TRACKING','SERIAL_TRACKING','VARIANTS','MULTI_UNIT','WEIGHT','LENGTH','AREA','MULTIPLE_STOCK_LOCATIONS']}}});
  await db.tenantEntitlement.createMany({data:[A,B].flatMap(shop=>features.map(f=>({organization_id:shop.organization.id,feature_id:f.id,is_enabled:true}))),skipDuplicates:true});
  token=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:A.user.username,password}).expect(200)).body.access_token;
  otherToken=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:B.user.username,password}).expect(200)).body.access_token;
  supplier=(await call('post','suppliers').send({name:'Cost supplier'}).expect(201)).body;
  pcs=await db.unit.findFirstOrThrow({where:{company_id:A.company.id,code:'PCS'}});
 });
 afterAll(async()=>{await app?.close();});
 it('two purchases create quantity 200, average 11 and value 2200',async()=>{
  life=await item('Lifecycle');await buy(life.id,100,10);await buy(life.id,100,12);
  const s=await state(life.id);expect(s.quantity.toString()).toBe('200');expect(s.known_value.toString()).toBe('2200');expect(s.unknown_quantity.toString()).toBe('0');
 });
 it('sale snapshots revenue 150, COGS 110 and profit 40',async()=>{
  sold=(await sell(life.id,10,15)).body;const line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:sold.id}});
  expect(line.net_revenue?.toString()).toBe('150');expect(line.cogs_total?.toString()).toBe('110');expect(line.gross_profit?.toString()).toBe('40');
  const s=await state(life.id);expect(s.quantity.toString()).toBe('190');expect(s.known_value.toString()).toBe('2090');
 });
 it('later purchase changes current average without changing the historical bill',async()=>{
  await buy(life.id,100,20);const line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:sold.id}});
  expect(line.cogs_total?.toString()).toBe('110');expect((await state(life.id)).known_value.toString()).toBe('4090');
 });
 it('partial return restores original COGS 44 and original profit impact',async()=>{
  await call('post','bills/return').send({original_invoice_id:sold.id,lines:[{item_id:life.id,quantity:4,rate:15}],refund_method:'CASH'}).expect(201);
  const line=await db.salesReturnLine.findFirstOrThrow({where:{sales_return:{original_invoice_id:sold.id}}});
  expect(line.cogs_total?.toString()).toBe('44');expect(line.net_revenue?.toString()).toBe('60');
  const s=await state(life.id);expect(s.quantity.toString()).toBe('294');expect(s.known_value.toString()).toBe('4134');
  const r=(await call('get','reports/financial/summary?item_id='+life.id+'&from='+date+'&to='+date).expect(200)).body;
  expect(r.net_sales).toBe('90');expect(r.cogs).toBe('66');expect(r.gross_profit).toBe('24');expect(r.cost_coverage).toBe('100');
 });
 it('all financial grouping queries use saved facts',async()=>{
  for(const group of ['items','bills','categories','customers','staff','trend','margin','low-margin','below-cost'])
    await call('get','reports/financial/'+group+'?from='+date+'&to='+date).expect(200);
  const v=(await call('get','reports/financial/valuation?item_id='+life.id).expect(200)).body;
  expect(Number(v.rows[0].inventory_value)).toBeCloseTo(4134,6);
 });
 it('unknown opening costs and mixed receipts never become zero-cost profit',async()=>{
  const unknown=await item('Unknown opening',{opening_stock:10});await buy(unknown.id,10,12);
  await sell(unknown.id,2,15);const line=await db.salesInvoiceLine.findFirstOrThrow({where:{item_id:unknown.id}});
  expect(line.cost_status).toBe('UNKNOWN');expect(line.cogs_total).toBeNull();
  expect(Number((await state(unknown.id)).unknown_quantity)).toBe(9);
  const r=(await call('get','reports/financial/summary?item_id='+unknown.id).expect(200)).body;expect(r.cost_coverage).toBe('0');expect(r.warning).toBeTruthy();
  // A financial year ending on this business date remains open throughout the day.
  await db.financialYear.update({where:{id:A.financialYear.id},data:{end_date:new Date(date)}});
  await call('post','reports/financial/missing-cost').send({item_id:unknown.id,cost_per_base_unit:'10',note:'Owner verified remaining opening cost'}).expect(201);
  await db.financialYear.update({where:{id:A.financialYear.id},data:{end_date:A.financialYear.end_date}});
  expect((await db.salesInvoiceLine.findUniqueOrThrow({where:{id:line.id}})).cogs_total).toBeNull();
  expect((await state(unknown.id)).unknown_quantity.toString()).toBe('0');
  await call('post','reports/financial/missing-cost').send({item_id:unknown.id,cost_per_base_unit:'10',note:'Retry'}).expect(400);
 });
 it('explicit free acquisition has a known zero cost',async()=>{
  const free=await item('Free stock',{opening_stock:10,opening_cost:0});await sell(free.id,1,15);
  const line=await db.salesInvoiceLine.findFirstOrThrow({where:{item_id:free.id}});expect(line.cogs_total?.toString()).toBe('0');expect(line.cost_status).toBe('KNOWN');
 });
 it('service revenue remains separate and does not become profit',async()=>{
  const service=await item('Service',{selling_mode:'SERVICE'});await sell(service.id,1,100);
  const r=(await call('get','reports/financial/summary?item_id='+service.id).expect(200)).body;
  expect(r.service_revenue).toBe('100');expect(r.gross_profit).toBe('0');expect(r.complete).toBe(false);
 });
 it('tenant B cannot read A valuation, bill filters or correct A costs',async()=>{
  for(const path of ['valuation?item_id='+life.id,'summary?bill_id='+sold.id,'items?branch_id='+A.branch.id])
    expect([400,403,404]).toContain((await call('get','reports/financial/'+path,B,otherToken)).status);
  const before=await state(life.id);
  const attack=await call('post','reports/financial/missing-cost',B,otherToken).send({item_id:life.id,cost_per_base_unit:'1',note:'Cross tenant attempt'});
  expect([400,403,404]).toContain(attack.status);expect((await state(life.id)).known_value.toString()).toBe(before.known_value.toString());
 });
 it('double posting is rejected and concurrent last-stock sales cannot oversell or duplicate cost',async()=>{
  const last=await item('Last stock');await buy(last.id,1,10);
  const results=await Promise.all([1,2].map(()=>call('post','bills').send({items:[{item_id:last.id,quantity:1,rate:15}],payment_splits:[{method:'CASH',amount:15}],date})));
  expect(results.map(r=>r.status).sort()).toEqual([201,400]);expect((await state(last.id)).quantity.toString()).toBe('0');
  const movement=await db.stockMovement.findFirstOrThrow({where:{company_id:A.company.id,item_id:life.id,movement_type:'PURCHASE_IN'}});
  await expect(db.$transaction(tx=>app.get(InventoryPostingService).postMovement(tx,{company_id:A.company.id,branch_id:A.branch.id,
    source_document_type:movement.source_document_type,source_document_id:movement.source_document_id,movement_type:'PURCHASE_IN',business_date:new Date(),
    lines:[{item_id:life.id,godown_id:movement.godown_id,unit_id:pcs.id,quantity:100,cost_rate:10,source_line_id:movement.source_line_id!}]}))).rejects.toThrow('Duplicate');
 });
 it.each([
  ['Pharmacy','PIECE','TAB','BOX',300,10,1500,'STRIP',15,1,105,75,2985],
  ['Grocery','PIECE','PCS','CRATE',24,5,480,'PCS',1,3,30,60,117],
  ['Hardware','PIECE','PCS','HBOX',100,10,1000,'PCS',1,27,15,270,973],
  ['Weight','WEIGHT','KG','KG',1,10,600,'KG',1,0.25,800,150,9.75],
  ['Length','LENGTH','M','ROLL',90,1,2700,'M',1,12.5,50,375,77.5],
 ] as const)('%s alternate/base-unit costing',async(name,mode,baseCode,inCode,inFactor,inQty,inRate,outCode,outFactor,outQty,outRate,expectedCost,remaining)=>{
  const product=await item(name,{unit_code:baseCode,selling_mode:mode});
  const base=await db.unit.findFirstOrThrow({where:{company_id:A.company.id,code:baseCode}});
  const unit=async(code:string,factor:number)=>{if(code===baseCode)return base;let u=await db.unit.findFirst({where:{company_id:A.company.id,code}});if(!u)u=await db.unit.create({data:{company_id:A.company.id,code,name:code}});
   await db.itemUnitConversion.create({data:{item_id:product.id,from_unit_id:u.id,to_unit_id:base.id,conversion_factor:factor}});return u;};
  const incoming=await unit(inCode,inFactor),outgoing=await unit(outCode,outFactor);
  await buy(product.id,inQty,inRate,{unit_id:incoming.id});await sell(product.id,outQty,outRate,{unit_id:outgoing.id});
  const line=await db.salesInvoiceLine.findFirstOrThrow({where:{item_id:product.id}});expect(Number(line.cogs_total)).toBeCloseTo(expectedCost,6);
  expect(Number((await state(product.id)).quantity)).toBeCloseTo(remaining,6);
  if(name==='Pharmacy'){await call('post','bills').send({items:[{item_id:product.id,unit_id:outgoing.id,quantity:2,rate:105},{item_id:product.id,unit_id:base.id,quantity:3,rate:7}],payment_splits:[{method:'CASH',amount:231}],date}).expect(201);expect(Number((await state(product.id)).quantity)).toBe(2952);}
 });
 it('area snapshots measured cost and discounted/below-cost sales retain negative profit',async()=>{
  const area=await item('Plywood',{unit_code:'SQFT',selling_mode:'AREA'});
  await buy(area.id,10,10,{dimensions:{length:8,width:4}});
  const sale=(await call('post','bills').send({items:[{item_id:area.id,quantity:1,rate:15,dimensions:{length:2,width:3}}],payment_splits:[{method:'CASH',amount:90}],date}).expect(201)).body;
  const line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:sale.id}});expect(line.cogs_total?.toString()).toBe('60');expect(line.base_quantity?.toString()).toBe('6');
  const discounted=await item('Discounted');await buy(discounted.id,10,110);
  const bill=(await call('post','bills').send({items:[{item_id:discounted.id,quantity:1,rate:150,discount_amount:10}],payment_splits:[{method:'CASH',amount:140}],date}).expect(201)).body;
  expect((await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:bill.id}})).gross_profit?.toString()).toBe('30');
  const loss=(await sell(discounted.id,1,90)).body;expect((await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:loss.id}})).gross_profit?.toString()).toBe('-20');
 });
 it('variants keep separate pools and FEFO selects physical batch independently of WAC',async()=>{
  const shirt=await item('Shirt',{has_variants:true});
  const red=await db.itemVariant.create({data:{item_id:shirt.id,attributes:{Colour:'Red'}}}),blue=await db.itemVariant.create({data:{item_id:shirt.id,attributes:{Colour:'Blue'}}});
  await buy(shirt.id,10,10,{variant_id:red.id});await buy(shirt.id,10,20,{variant_id:blue.id});
  await sell(shirt.id,1,30,{variant_id:red.id});await sell(shirt.id,1,30,{variant_id:blue.id});
  expect((await state(shirt.id,red.id)).known_value.toString()).toBe('90');expect((await state(shirt.id,blue.id)).known_value.toString()).toBe('180');
  const medicine=await item('Lot medicine',{track_batch:true});
  await buy(medicine.id,10,10,{batch_number:'EARLY',expiry_date:'2027-01-01'});await buy(medicine.id,10,20,{batch_number:'LATE',expiry_date:'2027-12-31'});
  const bill=(await sell(medicine.id,1,25)).body;const l=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:bill.id},include:{batch_allocations:{include:{batch:true}}}});
  expect(l.batch_allocations[0].batch.batch_number).toBe('EARLY');expect(l.cogs_total?.toString()).toBe('15');
 });
 it('serial receipt costs remain exact but sales use WAC and return original COGS',async()=>{
  const phone=await item('Phone',{track_serial:true,warranty_days:365});
  await buy(phone.id,1,100,{serial_numbers:['SN-A-'+suffix]});await buy(phone.id,1,200,{serial_numbers:['SN-B-'+suffix]});
  const serial=await db.itemSerial.findFirstOrThrow({where:{item_id:phone.id,serial_number:('SN-A-'+suffix).toUpperCase()}});
  const bill=(await sell(phone.id,1,300,{serial_ids:[serial.id]})).body;
  const l=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:bill.id}});expect(l.cogs_total?.toString()).toBe('150');
  await call('post','bills/return').send({original_invoice_id:bill.id,lines:[{item_id:phone.id,quantity:1,rate:300,serial_ids:[serial.id]}],refund_method:'CASH'}).expect(201);
  expect((await state(phone.id)).known_value.toString()).toBe('300');
  expect((await db.stockMovement.findFirstOrThrow({where:{item_id:phone.id,serial_id:serial.id,movement_type:'PURCHASE_IN'}})).value_delta.toString()).toBe('100');
 });
 it('bundle component cost is snapshotted and returned from the original composition',async()=>{
  const a=await item('Kit Pencil'),b=await item('Kit Notebook'),kit=await item('School Kit',{is_bundle:true});
  await buy(a.id,10,5);await buy(b.id,10,10);
  await call('put','items/'+kit.id+'/bundle').send({components:[{item_id:a.id,quantity:2},{item_id:b.id,quantity:1}]}).expect(200);
  const bill=(await sell(kit.id,1,50)).body;const l=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:bill.id}});expect(l.cogs_total?.toString()).toBe('20');
  await call('post','bills/return').send({original_invoice_id:bill.id,lines:[{item_id:kit.id,quantity:1,rate:50}],refund_method:'CASH'}).expect(201);
  expect((await state(a.id)).known_value.toString()).toBe('50');expect((await state(b.id)).known_value.toString()).toBe('100');
 });
 it('quick purchase and supplier settlement do not change inventory or operating expenses',async()=>{
  const before=await state(life.id),profit=(await call('get','reports/financial/summary').expect(200)).body;
  await call('post','purchases').send({supplier_id:supplier.id,total_amount:100,payment_status:'CREDIT',purchase_date:date}).expect(201);
  await call('post','suppliers/'+supplier.id+'/payments').send({amount:20,payment_method:'CASH',date}).expect(201);
  expect((await state(life.id)).known_value.toString()).toBe(before.known_value.toString());
  expect((await call('get','reports/financial/summary').expect(200)).body.business_expenses).toBe(profit.business_expenses);
 });
 it('purchase discount and landed charges exclude recoverable GST from inventory cost',async()=>{
  const taxed=await item('GST landed',{gst_rate:18});
  const response=await call('post','purchases').send({supplier_id:supplier.id,payment_status:'CREDIT',purchase_date:date,landed_cost_amount:20,lines:[{item_id:taxed.id,quantity:10,purchase_rate:10,discount_amount:10}]}).expect(201);
  expect(Number(response.body.grand_total)).toBeCloseTo(126.2);expect((await state(taxed.id)).known_value.toString()).toBe('110');
  const bill=(await call('post','bills').send({items:[{item_id:taxed.id,quantity:1,rate:15}],payment_splits:[{method:'CASH',amount:17.7}],date}).expect(201)).body;
  const line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:bill.id}});expect(line.cogs_total?.toString()).toBe('11');expect(line.net_revenue?.toString()).toBe('15');expect(line.gross_profit?.toString()).toBe('4');
 });
 it('bill discount quote/post parity and exact GST-adjusted revenue are preserved',async()=>{
  const first=await item('Discount GST first',{gst_rate:18,opening_stock:10,opening_cost:50}),second=await item('Discount GST second',{gst_rate:18,opening_stock:10,opening_cost:25});
  const payload={items:[{item_id:first.id,quantity:1,rate:100},{item_id:second.id,quantity:1,rate:50}],bill_discount:30,payment_splits:[],date};
  const quote=(await call('post','bills/quote').send(payload).expect(201)).body;
  const sale=(await call('post','bills').send({...payload,payment_splits:[{method:'CASH',amount:quote.grand_total}]}).expect(201)).body;
  const lines=await db.salesInvoiceLine.findMany({where:{sales_invoice_id:sale.id}});
  expect(lines.reduce((sum,l)=>sum+Number(l.net_revenue),0)).toBe(120);expect(lines.reduce((sum,l)=>sum+Number(l.tax_amount),0)).toBeCloseTo(21.6);
  expect(lines.reduce((sum,l)=>sum+Number(l.cogs_total),0)).toBe(75);expect(Number(sale.grand_total)).toBe(quote.grand_total);
 });
 it('three partial returns restore the full discounted revenue exactly',async()=>{
  const product=await item('Partial paisa',{opening_stock:3,opening_cost:1});
  const sale=(await call('post','bills').send({items:[{item_id:product.id,quantity:3,rate:2}],bill_discount:1,payment_splits:[{method:'CASH',amount:5}],date}).expect(201)).body;
  for(let n=0;n<3;n++){const r=await call('post','bills/return').send({original_invoice_id:sale.id,lines:[{item_id:product.id,quantity:1,rate:2}],refund_method:'CASH'});expect(r.status,JSON.stringify(r.body)).toBe(201);}
  const returns=await db.salesReturnLine.findMany({where:{sales_return:{original_invoice_id:sale.id}}});expect(returns.reduce((sum,l)=>sum+Number(l.net_revenue),0)).toBe(5);expect(returns.reduce((sum,l)=>sum+Number(l.cogs_total),0)).toBe(3);
 });
 it('holding and resuming preserves bill discount without posting stock or accounting',async()=>{
  const before=await state(life.id),journals=await db.voucher.count({where:{company_id:A.company.id}});
  const held=(await call('post','bills/hold').send({items:[{item_id:life.id,quantity:1,rate:15}],bill_discount:2}).expect(201)).body;
  expect(Number(held.bill_discount)).toBe(2);
  const resumed=(await call('post','bills/hold/'+held.id+'/resume').send({}).expect(201)).body;expect(Number(resumed.bill_discount)).toBe(2);
  expect((await state(life.id)).known_value.toString()).toBe(before.known_value.toString());expect(await db.voucher.count({where:{company_id:A.company.id}})).toBe(journals);
 });
 it('purchase return removes original acquisition value rather than current WAC',async()=>{
  const product=await item('Purchase return');const original=(await buy(product.id,100,10)).body;await buy(product.id,100,20);
  const ret=await db.purchaseReturn.create({data:{company_id:A.company.id,branch_id:A.branch.id,financial_year_id:A.financialYear.id,party_id:supplier.id,original_invoice_id:original.id,document_number:'PR-'+randomUUID(),document_date:new Date(date),status:'DRAFT',taxable_amount:100,grand_total:100,lines:{create:{item_id:product.id,godown_id:A.godown.id,unit_id:pcs.id,quantity:10,rate:10,taxable_value:100,line_total:100}}}});
  await app.get(PurchasePostingService).postPurchaseReturn(ret.id,A.user.id);expect((await state(product.id)).known_value.toString()).toBe('2900');expect((await state(product.id)).quantity.toString()).toBe('190');
  await app.get(PurchasePostingService).reversePurchaseReturn(ret.id,A.user.id);expect((await state(product.id)).known_value.toString()).toBe('3000');
  const allocations=await db.billAllocation.findMany({where:{company_id:A.company.id,reference_document_id:original.id}});
  expect(allocations.reduce((sum,a)=>sum+(a.allocation_type==='NEW_REFERENCE'?1:-1)*Number(a.amount),0)).toBe(1000);
 });
 it('priced GRN accrues actual receipt cost without waiting for the supplier invoice',async()=>{
  const product=await item('GRN cost');const grn=await db.goodsReceipt.create({data:{company_id:A.company.id,branch_id:A.branch.id,party_id:supplier.id,document_number:'GRN-'+randomUUID(),document_date:new Date(date),status:'DRAFT',lines:{create:{item_id:product.id,godown_id:A.godown.id,unit_id:pcs.id,received_quantity:10,acquisition_cost_rate:7}}}});
  await app.get(PurchasePostingService).postGoodsReceipt(grn.id,A.user.id);expect((await state(product.id)).known_value.toString()).toBe('70');
  expect(await db.voucher.count({where:{company_id:A.company.id,source_document_type:'GOODS_RECEIPT_COST',source_document_id:grn.id}})).toBe(1);
  await app.get(PurchasePostingService).reverseGoodsReceipt(grn.id,A.user.id);expect((await state(product.id)).quantity.toString()).toBe('0');
 });
 it('priced receipt invoice clears accrual and records the verified price difference separately',async()=>{
  const product=await item('Receipt invoice variance');const receipt=await db.goodsReceipt.create({data:{company_id:A.company.id,branch_id:A.branch.id,party_id:supplier.id,document_number:'GRN-'+randomUUID(),document_date:new Date(date),status:'DRAFT',lines:{create:{item_id:product.id,godown_id:A.godown.id,unit_id:pcs.id,received_quantity:10,acquisition_cost_rate:7}}},include:{lines:true}});
  await app.get(PurchasePostingService).postGoodsReceipt(receipt.id,A.user.id);
  const invoice=await db.purchaseInvoice.create({data:{company_id:A.company.id,branch_id:A.branch.id,financial_year_id:A.financialYear.id,party_id:supplier.id,document_number:'PI-'+randomUUID(),document_date:new Date(date),supplier_invoice_number:'SUP-'+randomUUID(),supplier_invoice_date:new Date(date),status:'DRAFT',taxable_amount:90,grand_total:90,lines:{create:{item_id:product.id,godown_id:A.godown.id,unit_id:pcs.id,goods_receipt_line_id:receipt.lines[0].id,quantity:10,rate:9,taxable_value:90,line_total:90}}}});
  const before=(await call('get','reports/financial/summary').expect(200)).body;
  await app.get(PurchasePostingService).postPurchaseInvoice(invoice.id,A.user.id);expect((await state(product.id)).known_value.toString()).toBe('70');
  const cleared=await db.voucherLine.aggregate({where:{ledger_account:{company_id:A.company.id,code:'GRN_CLEARING'}},_sum:{debit:true,credit:true}});expect(Number(cleared._sum.credit)-Number(cleared._sum.debit)).toBe(0);
  expect(Number((await call('get','reports/financial/summary').expect(200)).body.business_expenses)-Number(before.business_expenses)).toBe(20);
 });
 it('delivery challan invoice recognizes original dispatch COGS without removing stock twice',async()=>{
  const product=await item('Dispatch snapshot',{opening_stock:10,opening_cost:5}),customer=(await call('post','customers').send({name:'Dispatch customer',credit_allowed:true}).expect(201)).body;
  const dc=await db.deliveryChallan.create({data:{company_id:A.company.id,branch_id:A.branch.id,party_id:customer.id,document_number:'DC-'+randomUUID(),document_date:new Date(date),status:'DRAFT',lines:{create:{item_id:product.id,godown_id:A.godown.id,unit_id:pcs.id,dispatched_quantity:2}}},include:{lines:true}});
  await app.get(SalesPostingService).postDeliveryChallan(A.company.id,dc.id,A.user.id);await buy(product.id,10,10);
  const invoice=await db.salesInvoice.create({data:{company_id:A.company.id,branch_id:A.branch.id,financial_year_id:A.financialYear.id,party_id:customer.id,document_number:'DCI-'+randomUUID(),document_date:new Date(date),status:'DRAFT',taxable_amount:30,grand_total:30,lines:{create:{item_id:product.id,godown_id:A.godown.id,unit_id:pcs.id,delivery_challan_line_id:dc.lines[0].id,quantity:2,rate:15,taxable_value:30,line_total:30}}}});
  await app.get(SalesPostingService).postSalesInvoice(A.company.id,invoice.id,A.user.id);
  const line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:invoice.id}});expect(line.cogs_total?.toString()).toBe('10');expect(line.gross_profit?.toString()).toBe('20');expect((await state(product.id)).quantity.toString()).toBe('18');
  const deferred=await db.voucherLine.aggregate({where:{ledger_account:{company_id:A.company.id,code:'UNBILLED_COGS'}},_sum:{debit:true,credit:true}});expect(Number(deferred._sum.debit)-Number(deferred._sum.credit)).toBe(0);
 });
 it('stock transfer changes locations without changing company cost, profit or journals',async()=>{
  const product=await item('Transfer cost',{opening_stock:10,opening_cost:5});const destination=await db.godown.create({data:{branch_id:A.branch.id,name:'Cost second location',code:'COST-'+randomUUID().slice(0,8)}});
  const before=(await call('get','reports/financial/summary').expect(200)).body,journals=await db.voucher.count({where:{company_id:A.company.id}});
  await app.get(StockTransferService).createAndPost({company_id:A.company.id,branch_id:A.branch.id,financial_year_id:A.financialYear.id,user_id:A.user.id,document_date:new Date(date),source_godown_id:A.godown.id,destination_godown_id:destination.id,lines:[{item_id:product.id,unit_id:pcs.id,quantity:3}]});
  expect((await state(product.id)).known_value.toString()).toBe('50');expect((await state(product.id)).quantity.toString()).toBe('10');expect(await db.voucher.count({where:{company_id:A.company.id}})).toBe(journals);expect((await call('get','reports/financial/summary').expect(200)).body.gross_profit).toBe(before.gross_profit);
 });
 it('wastage is an expense, personal stock is drawings, and reversal restores original value',async()=>{
  const product=await item('Wastage',{opening_stock:10,opening_cost:5});const before=(await call('get','reports/financial/summary').expect(200)).body;
  const adjustment=await app.get(StockAdjustmentService).createAndPost({company_id:A.company.id,branch_id:A.branch.id,financial_year_id:A.financialYear.id,user_id:A.user.id,document_date:new Date(date),adjustment_type:'OUT',lines:[{item_id:product.id,unit_id:pcs.id,godown_id:A.godown.id,quantity:2,reason:'damaged'},{item_id:product.id,unit_id:pcs.id,godown_id:A.godown.id,quantity:1,reason:'owner personal use'}]});
  const after=(await call('get','reports/financial/summary').expect(200)).body;expect(Number(after.business_expenses)-Number(before.business_expenses)).toBe(10);expect((await state(product.id)).known_value.toString()).toBe('35');
  await app.get(StockAdjustmentService).reverseAdjustment(adjustment.id,A.user.id);expect((await state(product.id)).known_value.toString()).toBe('50');expect((await call('get','reports/financial/summary').expect(200)).body.business_expenses).toBe(before.business_expenses);
  const reversal = await db.voucher.findFirstOrThrow({where:{company_id:A.company.id,source_document_id:adjustment.id,voucher_type:'REVERSAL'}});
  expect(reversal.voucher_date.toISOString().slice(0,10)).toBe(businessDate());
  const movements = await db.stockMovement.findMany({where:{company_id:A.company.id,source_document_id:adjustment.id,source_document_type:'STOCK_ADJUSTMENT_REVERSAL'}});
  expect(movements.every(movement=>movement.business_date.toISOString().slice(0,10)===businessDate())).toBe(true);
 });
 it('stock count loss posts value and rejects retry',async()=>{
  const product=await item('Count loss',{opening_stock:10,opening_cost:5});const before=(await call('get','reports/financial/summary').expect(200)).body;
  const count=await app.get(StockCountService).createStockCount({company_id:A.company.id,branch_id:A.branch.id,financial_year_id:A.financialYear.id,document_number:'COUNT-'+randomUUID(),count_date:new Date(date),godown_id:A.godown.id,lines:[{item_id:product.id,unit_id:pcs.id,counted_quantity:8}]},A.user.id);
  await app.get(StockCountService).postStockCount(count.id,A.user.id);expect((await state(product.id)).known_value.toString()).toBe('40');expect(Number((await call('get','reports/financial/summary').expect(200)).body.business_expenses)-Number(before.business_expenses)).toBe(10);
  await expect(app.get(StockCountService).postStockCount(count.id,A.user.id)).rejects.toThrow('already posted');
 });
 it('business expense reduces net profit while owner withdrawal does not',async()=>{
  const category=(await call('post','expense-categories').send({name:'Cost operating expense'}).expect(201)).body,before=(await call('get','reports/financial/summary').expect(200)).body;
  await call('post','expenses').send({type:'BUSINESS_EXPENSE',category_id:category.id,amount:10,payment_method:'CASH',date}).expect(201);
  await call('post','expenses').send({type:'OWNER_WITHDRAWAL',amount:50,payment_method:'CASH',date}).expect(201);
  const after=(await call('get','reports/financial/summary').expect(200)).body;expect(Number(after.net_business_profit)).toBeCloseTo(Number(before.net_business_profit)-10);expect(after.gross_profit).toBe(before.gross_profit);
 });
 it('same serial cannot be sold concurrently twice',async()=>{
  const product=await item('Serial race',{track_serial:true});await buy(product.id,1,100,{serial_numbers:['RACE-'+suffix]});const serial=await db.itemSerial.findFirstOrThrow({where:{item_id:product.id}});
  const results=await Promise.all([1,2].map(()=>call('post','bills').send({items:[{item_id:product.id,quantity:1,rate:200,serial_ids:[serial.id]}],payment_splits:[{method:'CASH',amount:200}],date})));
  expect(results.map(r=>r.status).sort()).toEqual([201,400]);expect((await state(product.id)).quantity.toString()).toBe('0');expect(await db.salesInvoiceLine.count({where:{item_id:product.id}})).toBe(1);
 });
 it('concurrent receipts on one item produce the exact combined weighted average',async()=>{
  const product=await item('Concurrent receipts');await Promise.all([buy(product.id,100,10),buy(product.id,100,12)]);
  const cost=await state(product.id);expect(cost.quantity.toString()).toBe('200');expect(cost.known_value.toString()).toBe('2200');
  const sale=(await sell(product.id,10,15)).body;expect((await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:sale.id}})).cogs_total?.toString()).toBe('110');
 });
 it('free same-item and alternate FEFO promotions retain actual physical COGS',async()=>{
  const product=await item('Free quantity costing',{opening_stock:20,opening_cost:5});
  await db.promotionScheme.create({data:{company_id:A.company.id,code:'FREE-'+randomUUID().slice(0,8),name:'One free',scheme_type:'BUY_X_GET_Y',item_id:product.id,buy_quantity:2,get_quantity:1}});
  const same=(await sell(product.id,2,15)).body,line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:same.id}});
  expect(line.cogs_total?.toString()).toBe('15');expect(line.cost_per_base_unit?.toString()).toBe('5');expect((await state(product.id)).quantity.toString()).toBe('17');
  const paid=await item('Promo paid',{opening_stock:10,opening_cost:5}),gift=await item('FEFO gift',{track_batch:true});await buy(gift.id,10,7,{batch_number:'GIFT',expiry_date:'2027-12-31'});
  await db.promotionScheme.create({data:{company_id:A.company.id,code:'GIFT-'+randomUUID().slice(0,8),name:'Batch gift',scheme_type:'BUY_X_GET_Y',item_id:paid.id,free_item_id:gift.id,buy_quantity:2,get_quantity:1}});
  const alternate=(await sell(paid.id,2,15)).body,lines=await db.salesInvoiceLine.findMany({where:{sales_invoice_id:alternate.id}}),free=lines.find(l=>l.item_id===gift.id)!;
  expect(free.cogs_total?.toString()).toBe('7');expect(free.cost_per_base_unit?.toString()).toBe('7');expect(free.gross_profit?.toString()).toBe('-7');
 });
 it('cashier billing detail strips costs and cannot invoke report or cost correction',async()=>{
  const p=await db.permission.findUniqueOrThrow({where:{code:'sales.read'}}),role=await db.role.create({data:{organization_id:A.organization.id,name:'Cost Cashier '+suffix,role_permissions:{create:{permission_id:p.id}}}});
  const staff=await db.user.create({data:{organization_id:A.organization.id,username:'cost-staff-'+suffix,display_name:'Cost Cashier',password_hash:await bcrypt.hash(password,10),roles:{create:{role_id:role.id,company_id:A.company.id,branch_id:A.branch.id}}}});
  const staffToken=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:staff.username,password}).expect(200)).body.access_token;
  const detail=(await call('get','bills/'+sold.id,A,staffToken).expect(200)).body;expect(detail.sales_invoice_line[0]).not.toHaveProperty('cogs_total');expect(detail.sales_invoice_line[0]).not.toHaveProperty('cost_snapshot');
  const legacy=(await request(app.getHttpServer()).get('/api/v1/sales/invoices/'+sold.id).set('Authorization','Bearer '+staffToken).set('X-Company-Id',A.company.id).set('X-Branch-Id',A.branch.id).set('X-Financial-Year-Id',A.financialYear.id).expect(200)).body;
  expect(legacy.lines[0]).not.toHaveProperty('cogs_total');expect(legacy.lines[0]).not.toHaveProperty('cost_snapshot');
  await call('get','reports/financial/summary',A,staffToken).expect(403);await call('post','reports/financial/missing-cost',A,staffToken).send({item_id:life.id,cost_per_base_unit:'1',note:'Not permitted'}).expect(403);
 });
 it('invalid report dates reject without querying a rolled-over date',async()=>{await call('get','reports/financial/summary?from=2026-02-31&to=2026-03-04').expect(400);});
 it('Assistant and Reports return the same authoritative profits and warn about unknown costs',async()=>{
  const headers={'Authorization':'Bearer '+token,'X-Company-Id':A.company.id,'X-Branch-Id':A.branch.id,'X-Financial-Year-Id':A.financialYear.id};
  const report=(await call('get','reports/financial/summary').expect(200)).body,answer=(await request(app.getHttpServer()).post('/api/v1/assistant/query').set(headers).send({message:'aaj kitna profit hua',language:'hinglish'}).expect(201)).body;
  expect(answer.status).toBe('SUCCESS');for(const key of ['gross_profit','net_business_profit','cogs','cost_coverage'])expect(answer.result.summary[key]).toBe(report[key]);expect(answer.text).toContain('adhura');
 });
 it('every pool reconciles physical quantity/value and all journals balance',async()=>{
  const states=await db.inventoryCostState.findMany({where:{company_id:A.company.id}});
  for(const s of states){const physical=await db.stockBalanceProjection.aggregate({where:{company_id:A.company.id,item_id:s.item_id,variant_id:s.variant_key==='BASE'?null:s.variant_key},_sum:{quantity:true}});
    expect(Number(physical._sum.quantity)).toBeCloseTo(Number(s.quantity),6);
    const movements=await db.stockMovement.aggregate({where:{company_id:A.company.id,item_id:s.item_id,variant_id:s.variant_key==='BASE'?null:s.variant_key,movement_type:{notIn:['TRANSFER_IN','TRANSFER_OUT']}},_sum:{value_delta:true}});
    const correction=await db.auditLog.findMany({where:{company_id:A.company.id,source_document_type:'INVENTORY_COST_STATE',source_document_id:s.id,action:'MISSING_STOCK_COST_CORRECTED'}});
    const added=correction.reduce((sum,a)=>{const details=JSON.parse(a.details!);return sum+Number(details.after.known_value)-Number(details.before.known_value);},0);
    expect(Number(movements._sum.value_delta)+added).toBeCloseTo(Number(s.known_value),6);}
  const vouchers=await db.voucher.findMany({where:{company_id:A.company.id,status:'POSTED'},include:{lines:true}});
  for(const v of vouchers)expect(Number(v.lines.reduce((s,l)=>s.plus(l.debit).minus(l.credit),new (require('@prisma/client').Prisma.Decimal)(0)))).toBeCloseTo(0,6);
  const asset=await db.voucherLine.aggregate({where:{ledger_account:{company_id:A.company.id,code:'1200'},voucher:{status:{in:['POSTED','REVERSED']}}},_sum:{debit:true,credit:true}});
  expect(Number(asset._sum.debit)-Number(asset._sum.credit)).toBeCloseTo(states.reduce((sum,s)=>sum+Number(s.known_value),0),5);
  const costLines=await db.voucherLine.aggregate({where:{ledger_account:{company_id:A.company.id,code:'COGS'},voucher:{status:{in:['POSTED','REVERSED']}}},_sum:{debit:true,credit:true}});
  const saleValue=await db.stockMovement.aggregate({where:{company_id:A.company.id,movement_type:'SALES_OUT'},_sum:{value_delta:true}}),returnValue=await db.stockMovement.aggregate({where:{company_id:A.company.id,movement_type:'SALES_RETURN_IN'},_sum:{value_delta:true}});
  expect(Number(costLines._sum.debit)-Number(costLines._sum.credit)).toBeCloseTo(-Number(saleValue._sum.value_delta)-Number(returnValue._sum.value_delta),5);
 });
});


