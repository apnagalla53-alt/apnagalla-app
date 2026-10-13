import {Test} from '@nestjs/testing';
import {INestApplication,ValidationPipe,RequestMethod} from '@nestjs/common';
import request from 'supertest';
import {randomUUID,randomBytes} from 'crypto';
import * as bcrypt from 'bcrypt';
import {AppModule} from '../src/app.module';
import {PrismaService} from '../src/database/prisma.service';
import {TenantProvisioningService} from '../src/platform/provisioning/tenant-provisioning.service';
import {validateEnvironment} from '../src/common/environment';
import {businessDate as currentBusinessDate} from '../src/common/business-date';

describe('Production audit: real HTTP tenant attacks, posting concurrency, UPI and Daily Galla',()=>{
  let app:INestApplication,db:PrismaService,A:any,B:any,tokenA:string,tokenB:string,customer:any,supplier:any,item:any,bitem:any,bparty:any,bpurchase:any,bill:any,category:any;
  const suffix=Date.now(),password='Disposable!Audit765';
  const date=currentBusinessDate();
  const call=(method:string,path:string,shop=A,token=tokenA)=>(request(app.getHttpServer()) as any)[method]('/api/v1/'+path)
    .set('Authorization','Bearer '+token).set('X-Company-Id',shop.company.id).set('X-Branch-Id',shop.branch.id).set('X-Financial-Year-Id',shop.financialYear.id);
  const retail=(method:string,path:string)=>call(method,'retail/'+path);
  const amount=(value:number,method:string,cust?:string,d=date)=>retail('post','bills/amount-sale').send({amount:value,payment_method:method,customer_id:cust,date:d});
  beforeAll(async()=>{
    app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();
    app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
    const provision=(name:string)=>app.get(TenantProvisioningService).provisionTenant({organizationName:name,adminEmail:name+'@test.invalid',adminName:'Owner',adminPassword:password});
    A=await provision('audit-a-'+suffix);B=await provision('audit-b-'+suffix);
    const advanced=await db.feature.findMany({where:{code:{in:['SERIAL_TRACKING','BATCH_TRACKING','VARIANTS','MULTI_UNIT','SERVICES','WEIGHT','LENGTH','AREA','VOLUME','ITEM_IMAGES']}}});
    await db.tenantEntitlement.createMany({data:advanced.map(f=>({organization_id:A.organization.id,feature_id:f.id,is_enabled:true})),skipDuplicates:true});
    const login=async(s:any)=>(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:s.user.username,password}).expect(200)).body.access_token;
    tokenA=await login(A);tokenB=await login(B);
    customer=(await retail('post','customers').send({name:'Audit Customer',opening_balance:500,credit_allowed:true}).expect(201)).body;
    supplier=(await retail('post','suppliers').send({name:'Audit Supplier'}).expect(201)).body;
    item=(await retail('post','items').send({name:'Audit Stock',selling_price:100,opening_stock:30,purchase_price:50}).expect(201)).body;
    bparty=(await call('post','retail/suppliers',B,tokenB).send({name:'Other Supplier'}).expect(201)).body;
    bitem=(await call('post','retail/items',B,tokenB).send({name:'Other Stock',selling_price:100,opening_stock:10}).expect(201)).body;
    bpurchase=(await call('post','retail/purchases',B,tokenB).send({supplier_id:bparty.id,total_amount:100,payment_status:'CREDIT'}).expect(201)).body;
    bill=(await call('post','retail/bills',B,tokenB).send({items:[{item_id:bitem.id,quantity:1,rate:100}],payment_splits:[{method:'CASH',amount:100}]}).expect(201)).body;
    category=(await retail('post','expense-categories').send({name:'Audit Costs'}).expect(201)).body;
  });
  afterAll(async()=>{
    if(A&&B){const scope={company_id:{in:[A.company.id,B.company.id]}};
      await db.requestIdempotency.deleteMany({where:scope});await db.dailyCashCount.deleteMany({where:scope});
      await db.attachment.deleteMany({where:scope});await db.needList.deleteMany({where:scope});await db.auditLog.deleteMany({where:scope});
      await db.stockMovement.deleteMany({where:scope});await db.stockBalanceProjection.deleteMany({where:scope});await db.billAllocation.deleteMany({where:scope});
      await db.expense.deleteMany({where:scope});await db.expenseCategory.deleteMany({where:scope});await db.voucherLine.deleteMany({where:{voucher:scope}});await db.voucher.deleteMany({where:scope});
      await db.salesReturn.deleteMany({where:scope});await db.salesInvoice.deleteMany({where:scope});await db.goodsReceipt.deleteMany({where:scope});
      await db.purchaseInvoice.deleteMany({where:scope});await db.purchaseOrder.deleteMany({where:scope});await db.openingStock.deleteMany({where:scope});await db.pricingTrace.deleteMany({where:scope});await db.item.deleteMany({where:scope});
    }await app.close();
  });
  it('rejects missing/weak/shared production secrets, bootstrap and unsafe origins without exposing values',()=>{
    expect(currentBusinessDate(new Date('2026-10-06T18:45:00Z'))).toBe('2026-10-07');
    expect(()=>validateEnvironment({NODE_ENV:'production',DATABASE_URL:'postgresql://db/app'})).toThrow('JWT_SECRET');
    const valid={NODE_ENV:'production',DATABASE_URL:'postgresql://db/app',JWT_SECRET:randomBytes(48).toString('hex'),PLATFORM_JWT_SECRET:randomBytes(48).toString('hex'),MFA_ENCRYPTION_KEY:randomBytes(32).toString('base64'),FRONTEND_ORIGIN:'https://shop.example.com',API_ORIGIN:'https://api.example.com',STORAGE_PROVIDER:'local',UPLOAD_DIR:'/private/uploads',BACKUP_PROVIDER:'none',APP_VERSION:'audit'};
    expect(validateEnvironment(valid).NODE_ENV).toBe('production');
    expect(()=>validateEnvironment({...valid,PLATFORM_JWT_SECRET:valid.JWT_SECRET})).toThrow('must differ');
    expect(()=>validateEnvironment({...valid,FRONTEND_ORIGIN:'http://localhost:5173'})).toThrow('HTTPS');
    expect(()=>validateEnvironment({...valid,PLATFORM_BOOTSTRAP_PASSWORD:'irrelevant'})).toThrow('forbidden');
  });
  for(const method of ['get','post','patch','delete'])it('tenant owner cannot access Platform APIs with '+method.toUpperCase(),async()=>{
    const res=await call(method,'platform/admin/tenants');expect([401,404]).toContain(res.status);
  });
  it('rejects altered JWTs, platform claim escalation, company/FY/branch header substitution',async()=>{
    const parts=tokenA.split('.');parts[1]=Buffer.from(JSON.stringify({sub:A.user.id,is_platform:true})).toString('base64url');
    await call('get','platform/admin/tenants',A,parts.join('.')).expect(401);
    await retail('get','items').set('X-Company-Id',B.company.id).expect(403);
    await retail('get','items').set('X-Branch-Id',B.branch.id).expect(403);
    await retail('get','items').set('X-Financial-Year-Id',B.financialYear.id).expect(403);
  });
  it('legacy Purchase document reads/posts/reversals reject foreign IDs before document status processing',async()=>{
    await call('get','purchase/invoices/'+bpurchase.id).expect(404);
    for(const action of ['post','reverse','match']) {
      const res=await call(action==='match'?'get':'post','purchase/invoices/'+bpurchase.id+'/'+action).send({});expect([400,404]).toContain(res.status);
    }
    const order=await db.purchaseOrder.create({data:{company_id:B.company.id,branch_id:B.branch.id,party_id:bparty.id,document_number:'AUDIT-PO',document_date:new Date(date),status:'DRAFT'}});
    await call('get','purchase/orders/'+order.id).expect(404);
    await call('post','purchase/orders/'+order.id+'/convert').send({}).expect(400);
    const receipt=await db.goodsReceipt.create({data:{company_id:B.company.id,branch_id:B.branch.id,party_id:bparty.id,document_number:'AUDIT-GRN',document_date:new Date(date),status:'DRAFT'}});
    await call('get','purchase/receipts/'+receipt.id).expect(404);
    for(const action of ['post','reverse'])await call('post','purchase/receipts/'+receipt.id+'/'+action).send({}).expect(400);
    expect((await db.goodsReceipt.findUnique({where:{id:receipt.id}}))!.status).toBe('DRAFT');
  });
  it('rejects foreign item/unit/variant/batch/serial/party and nested Prisma relation payloads without posting',async()=>{
    const variant=await db.itemVariant.create({data:{item_id:bitem.id,attributes:{size:'other'}}});
    const batch=await db.itemBatch.create({data:{company_id:B.company.id,item_id:bitem.id,batch_number:'OTHER'}});
    const serial=await db.itemSerial.create({data:{company_id:B.company.id,item_id:bitem.id,godown_id:B.godown.id,serial_number:'FOREIGN-'+suffix}});
    const unit=await db.unit.findFirst({where:{company_id:B.company.id}});
    const before=await db.salesInvoice.count({where:{company_id:A.company.id}});
    for(const change of [{item_id:bitem.id},{unit_id:unit!.id},{variant_id:variant.id},{batch_id:batch.id},{serial_ids:[serial.id]}])
      await retail('post','bills').send({items:[{item_id:item.id,quantity:1,rate:100,...change}],payment_splits:[{method:'CASH',amount:100}]}).expect(400);
    await retail('post','needs').send({name:'Foreign',preferred_supplier_id:bparty.id}).expect(400);
    await call('post','purchase/orders').send({party_id:supplier.id,document_date:date,document_number:'ATTACK',lines:[],company:{connect:{id:B.company.id}}}).expect(400);
    expect(await db.salesInvoice.count({where:{company_id:A.company.id}})).toBe(before);
  });
  it('foreign bill/return/purchase/expense/need/khata/attachment reads, edits and deletes fail',async()=>{
    const need=(await call('post','retail/needs',B,tokenB).send({name:'Other need'}).expect(201)).body;
    const expense=(await call('post','retail/expenses',B,tokenB).send({type:'OWNER_WITHDRAWAL',amount:5,payment_method:'CASH',date}).expect(201)).body;
    for(const path of ['retail/bills/'+bill.id,'retail/items/'+bitem.id+'/options','retail/suppliers/'+bparty.id+'/khata','retail/expenses/'+expense.id])await call('get',path).expect(404);
    await retail('post','items/'+bitem.id).send({name:'Stolen'}).expect(400);
    await retail('patch','needs/'+need.id).send({status:'ORDERED'}).expect(404);
    await retail('post','bills/return').send({original_invoice_id:bill.id,lines:[{item_id:item.id,quantity:1,rate:100}],refund_method:'CASH'}).expect(400);
    await retail('post','suppliers/'+bparty.id+'/payments').send({amount:1,payment_method:'CASH',date}).expect(400);
    const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC','base64');
    const uploaded=(await call('post','attachments',B,tokenB).field('entityType','NEED').field('entityId',need.id).field('category','NEED_PHOTO').attach('file',image,{filename:'real.png',contentType:'image/png'}).expect(201)).body;
    await call('get','attachments/'+uploaded.id+'/content').expect(404);await call('delete','attachments/'+uploaded.id).expect(404);
    await call('post','attachments').field('entityType','NEED').field('entityId',need.id).field('category','NEED_PHOTO').attach('file',image,{filename:'real.png',contentType:'image/png'}).expect(404);
  });
  it('rejects forged image content and unsafe entity category',async()=>{
    await call('post','attachments').field('entityType','ITEM').field('entityId',item.id).field('category','ITEM_IMAGE').attach('file',Buffer.from('<script>attack</script>'),{filename:'fake.png',contentType:'image/png'}).expect(400);
    await call('post','attachments').field('entityType','ITEM').field('entityId',item.id).field('category','../../public').attach('file',Buffer.from([255,216,255]),{filename:'a.jpg',contentType:'image/jpeg'}).expect(400);
  });
  it('system Cashier role does not bypass permissions; logout immediately revokes its device',async()=>{
    const role=await db.role.create({data:{organization_id:A.organization.id,name:'CASHIER',system_role:true}});
    const user=await db.user.create({data:{organization_id:A.organization.id,username:'audit-cashier-'+suffix,display_name:'Cashier',password_hash:await bcrypt.hash(password,12),roles:{create:{company_id:A.company.id,branch_id:A.branch.id,role_id:role.id}}}});
    const token=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:user.username,password}).expect(200)).body.access_token;
    await call('post','retail/items',A,token).send({name:'Unauthorized',selling_price:1}).expect(403);
    await call('get','retail/reports/sales',A,token).expect(403);
    await call('post','retail/payments/upi',A,token).send({upi_id:'attack@upi',payee_name:'Attack',show_on_invoice:true}).expect(403);
    await call('post','auth/logout',A,token).expect(201);await call('get','retail/items',A,token).expect(401);
  });
  it('replays concurrent identical sales exactly once and rejects key reuse with changed payload',async()=>{
    const key=randomUUID(),body={amount:77,payment_method:'CASH',date};
    const before=await db.salesInvoice.count({where:{company_id:A.company.id}});
    const responses=await Promise.all([1,2,3].map(()=>retail('post','bills/amount-sale').set('Idempotency-Key',key).send(body)));
    expect(responses.map(r=>r.status)).toEqual([201,201,201]);expect(new Set(responses.map(r=>r.body.id)).size).toBe(1);
    expect(await db.salesInvoice.count({where:{company_id:A.company.id}})).toBe(before+1);
    await retail('post','bills/amount-sale').set('Idempotency-Key',key).send({...body,amount:78}).expect(409);
  });
  it('last stock concurrent sale has one winner and no negative projection or orphan voucher',async()=>{
    const last=(await retail('post','items').send({name:'Last Stock',selling_price:10,opening_stock:1}).expect(201)).body;
    const body={items:[{item_id:last.id,quantity:1,rate:10}],payment_splits:[{method:'CASH',amount:10}]};
    const responses=await Promise.all([1,2].map(()=>retail('post','bills').set('Idempotency-Key',randomUUID()).send(body)));
    expect(responses.map(r=>r.status).sort()).toEqual([201,400]);
    const projection=await db.stockBalanceProjection.findFirst({where:{company_id:A.company.id,item_id:last.id}});expect(Number(projection!.quantity)).toBe(0);
    expect(await db.salesInvoiceLine.count({where:{item_id:last.id}})).toBe(1);
  });
  it('serial receipt count/uniqueness, concurrent exact serial sale, original return and resale preserve warranty history',async()=>{
    const tracked=(await retail('post','items').send({name:'Serial Device',selling_price:200,track_serial:true,warranty_days:365}).expect(201)).body;
    const purchase={supplier_id:supplier.id,payment_status:'CREDIT',lines:[{item_id:tracked.id,quantity:2,purchase_rate:100,serial_numbers:['  device-a-'+suffix+' ','DEVICE-B-'+suffix]}]};
    await retail('post','purchases').send({...purchase,lines:[{...purchase.lines[0],serial_numbers:['only-one']}]}).expect(400);
    expect(await db.itemSerial.count({where:{item_id:tracked.id}})).toBe(0);
    await retail('post','purchases').send(purchase).expect(201);await retail('post','purchases').send(purchase).expect(400);
    const serial=await db.itemSerial.findFirst({where:{item_id:tracked.id},orderBy:{serial_number:'asc'}});
    const body={customer_id:customer.id,items:[{item_id:tracked.id,quantity:1,rate:200,serial_ids:[serial!.id]}],payment_splits:[{method:'CASH',amount:200}],date};
    const responses=await Promise.all([1,2].map(()=>retail('post','bills').set('Idempotency-Key',randomUUID()).send(body)));
    expect(responses.map(r=>r.status).sort()).toEqual([201,400]);const sold=responses.find(r=>r.status===201)!.body;
    const line=await db.salesInvoiceLine.findFirst({where:{sales_invoice_id:sold.id}});expect((line!.warranty_snapshot as any).days).toBe(365);
    await db.item.update({where:{id:tracked.id},data:{warranty_days:30}});
    const ret={original_invoice_id:sold.id,lines:[{item_id:tracked.id,original_line_id:line!.id,quantity:1,rate:1,serial_ids:[serial!.id]}],refund_method:'CASH'};
    const key=randomUUID();const returned=(await retail('post','bills/return').set('Idempotency-Key',key).send(ret).expect(201)).body;
    expect((await retail('post','bills/return').set('Idempotency-Key',key).send(ret).expect(201)).body.id).toBe(returned.id);
    await retail('post','bills/return').send(ret).expect(400);await retail('post','bills').send(body).expect(201);
    const history=(await retail('get','warranty?search=DEVICE-A-'+suffix).expect(200)).body;expect(history[0].allocations).toHaveLength(2);
    expect(history[0].allocations.some((a:any)=>a.returned_at&&(a.warranty_snapshot as any).days===365)).toBe(true);
    expect(history[0].allocations.some((a:any)=>!a.returned_at&&(a.warranty_snapshot as any).days===30)).toBe(true);
  });
  it('serial sales retain the selected serial batch instead of independently allocating a different FEFO lot',async()=>{
    const tracked=(await retail('post','items').send({name:'Serial Batch Device',selling_price:100,track_serial:true,track_batch:true}).expect(201)).body;
    const expiry=(days:number)=>new Date(new Date(date).getTime()+days*86400000).toISOString().slice(0,10);
    for(const [batch,days,serial] of [['EARLY',30,'EARLY-SERIAL'],['LATE',60,'LATE-SERIAL']] as const)
      await retail('post','purchases').send({supplier_id:supplier.id,payment_status:'CREDIT',lines:[{item_id:tracked.id,quantity:1,purchase_rate:50,batch_number:batch,expiry_date:expiry(days),serial_numbers:[serial+'-'+suffix]}]}).expect(201);
    const early=await db.itemBatch.findFirstOrThrow({where:{item_id:tracked.id,batch_number:'EARLY'}});
    const late=await db.itemBatch.findFirstOrThrow({where:{item_id:tracked.id,batch_number:'LATE'}});
    const serial=await db.itemSerial.findFirstOrThrow({where:{item_id:tracked.id,batch_id:late.id}});
    const line={item_id:tracked.id,quantity:1,rate:100,serial_ids:[serial.id]};
    await retail('post','bills').send({items:[{...line,batch_id:early.id}],payment_splits:[{method:'CASH',amount:100}],date}).expect(400);
    const sale=(await retail('post','bills').send({items:[line],payment_splits:[{method:'CASH',amount:100}],date}).expect(201)).body;
    const posted=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:sale.id}});expect(posted.batch_id).toBe(late.id);
    const balances=await db.stockBalanceProjection.findMany({where:{item_id:tracked.id}});
    expect(balances.filter(p=>p.batch_id===early.id).reduce((s,p)=>s+Number(p.quantity),0)).toBe(1);
    expect(balances.filter(p=>p.batch_id===late.id).reduce((s,p)=>s+Number(p.quantity),0)).toBe(0);
  });
  it('concurrent last-batch sales allocate once without overselling',async()=>{
    const batchItem=(await retail('post','items').send({name:'Concurrent Batch',selling_price:10,track_batch:true}).expect(201)).body;
    await retail('post','purchases').send({supplier_id:supplier.id,payment_status:'CREDIT',lines:[{item_id:batchItem.id,quantity:1,purchase_rate:5,batch_number:'LAST',expiry_date:new Date(new Date(date).getTime()+86400000*30).toISOString().slice(0,10)}]}).expect(201);
    const body={items:[{item_id:batchItem.id,quantity:1,rate:10}],payment_splits:[{method:'CASH',amount:10}],date};
    const responses=await Promise.all([1,2].map(()=>retail('post','bills').set('Idempotency-Key',randomUUID()).send(body)));
    expect(responses.map(r=>r.status).sort()).toEqual([201,400]);expect(await db.salesInvoiceLine.count({where:{item_id:batchItem.id}})).toBe(1);
    expect(Number((await db.stockBalanceProjection.findFirstOrThrow({where:{item_id:batchItem.id}})).quantity)).toBe(0);
  });
  it('concurrent customer and supplier payment retries post one balanced voucher each',async()=>{
    for(const [kind,party] of [['customers',customer],['suppliers',supplier]] as const){
      const before=await db.voucher.count({where:{company_id:A.company.id}}),key=randomUUID();
      const responses=await Promise.all([1,2].map(()=>retail('post',kind+'/'+party.id+'/payments').set('Idempotency-Key',key).send({amount:5,payment_method:'CASH',date})));
      expect(responses.map(r=>r.status)).toEqual([201,201]);expect(responses[0].body).toEqual(responses[1].body);
      expect(await db.voucher.count({where:{company_id:A.company.id}})).toBe(before+1);
    }
  });
  it('concurrent purchase retries and original-invoice returns cannot double post',async()=>{
    const before=await db.purchaseInvoice.count({where:{company_id:A.company.id}}),key=randomUUID();
    const responses=await Promise.all([1,2].map(()=>retail('post','purchases').set('Idempotency-Key',key).send({supplier_id:supplier.id,total_amount:15,payment_status:'CREDIT',purchase_date:date})));
    expect(responses.map(r=>r.status)).toEqual([201,201]);expect(responses[0].body.id).toBe(responses[1].body.id);
    expect(await db.purchaseInvoice.count({where:{company_id:A.company.id}})).toBe(before+1);
    const sale=(await retail('post','bills').send({items:[{item_id:item.id,quantity:1,rate:100}],payment_splits:[{method:'CASH',amount:100}],date}).expect(201)).body;
    const line=await db.salesInvoiceLine.findFirstOrThrow({where:{sales_invoice_id:sale.id}});
    const ret={original_invoice_id:sale.id,lines:[{item_id:item.id,original_line_id:line.id,quantity:1,rate:100}],refund_method:'CASH'};
    const returns=await Promise.all([1,2].map(()=>retail('post','bills/return').set('Idempotency-Key',randomUUID()).send(ret)));
    expect(returns.map(r=>r.status).sort()).toEqual([201,400]);expect(await db.salesReturn.count({where:{original_invoice_id:sale.id}})).toBe(1);
  });
  it('different GRNs cannot concurrently over-receive the same purchase order',async()=>{
    const unit=(await db.item.findUniqueOrThrow({where:{id:item.id}})).primary_unit_id;
    const order=await db.purchaseOrder.create({data:{company_id:A.company.id,branch_id:A.branch.id,party_id:supplier.id,document_number:'CONCURRENT-PO-'+suffix,document_date:new Date(date),status:'CONFIRMED',lines:{create:{item_id:item.id,unit_id:unit,ordered_quantity:1,rate:50}}},include:{lines:true}});
    const receipts=[];
    for(const n of [1,2])receipts.push(await db.goodsReceipt.create({data:{company_id:A.company.id,branch_id:A.branch.id,party_id:supplier.id,purchase_order_id:order.id,document_number:'CONCURRENT-GRN-'+suffix+'-'+n,document_date:new Date(date),status:'DRAFT',lines:{create:{purchase_order_line_id:order.lines[0].id,item_id:item.id,godown_id:A.godown.id,unit_id:unit,received_quantity:1}}}}));
    const responses=await Promise.all(receipts.map(r=>call('post','purchase/receipts/'+r.id+'/post').send({})));
    expect(responses.map(r=>r.status).sort()).toEqual([201,400]);
    expect(Number((await db.purchaseOrderLine.findUniqueOrThrow({where:{id:order.lines[0].id}})).received_quantity)).toBe(1);
  });
  it('different concurrent payment requests cannot collect or pay the same final due twice',async()=>{
    for(const kind of ['customers','suppliers']){
      const party=(await retail('post',kind).send({name:'Final Due '+kind,credit_allowed:true,...(kind==='customers'?{opening_balance:10}:{})}).expect(201)).body;
      if(kind==='suppliers')await retail('post','purchases').send({supplier_id:party.id,total_amount:10,payment_status:'CREDIT',purchase_date:date}).expect(201);
      const responses=await Promise.all([1,2].map(()=>retail('post',kind+'/'+party.id+'/payments').set('Idempotency-Key',randomUUID()).send({amount:10,payment_method:'CASH',date})));
      expect(responses.map(r=>r.status).sort()).toEqual([201,400]);
    }
  });
  it('stock reports include zero-stock catalog items, without inventing valuation',async()=>{
    const zero=(await retail('post','items').send({name:'Zero Stock Catalog',selling_price:10}).expect(201)).body;
    const report=(await retail('get','reports/stock').expect(200)).body;
    expect(report.items.find((i:any)=>i.item_id===zero.id).quantity).toBe(0);expect(report.summary.out_of_stock_count).toBeGreaterThan(0);
    expect(report.summary.stock_valuation).toBeUndefined();
  });
  it('sales dashboard separates UPI, Card and Bank even inside a split payment',async()=>{
    const reportDate=new Date(new Date(date).getTime()-7*86400000).toISOString().slice(0,10);
    await amount(80,'BANK',undefined,reportDate).expect(201);await amount(20,'UPI',undefined,reportDate).expect(201);
    await retail('post','bills').send({items:[{item_id:item.id,quantity:1,rate:60}],payment_splits:[{method:'CASH',amount:10},{method:'UPI',amount:30},{method:'CARD',amount:20}],date:reportDate}).expect(201);
    const report=(await retail('get','reports/dashboard?from='+reportDate+'&to='+reportDate).expect(200)).body;
    expect(report.cash_received).toBe(10);expect(report.upi_received).toBe(50);expect(report.other_received).toBe(100);
  });
  it('advanced entitlements are enforced by the backend; overrides cannot bypass a global rollout stop',async()=>{
    const feature=await db.feature.findUniqueOrThrow({where:{code:'SERIAL_TRACKING'}});
    const key={uix_tenant_entitlements:{organization_id:A.organization.id,feature_id:feature.id}};
    await db.tenantEntitlement.update({where:key,data:{is_enabled:false}});
    await retail('post','items').send({name:'Disabled serial capability',selling_price:100,track_serial:true}).expect(403);
    const existing=await db.item.findFirstOrThrow({where:{company_id:A.company.id,track_serial:true,track_batch:false}});
    const draft=await db.goodsReceipt.create({data:{company_id:A.company.id,branch_id:A.branch.id,party_id:supplier.id,document_number:'LICENSE-GRN-'+suffix,document_date:new Date(date),status:'DRAFT',lines:{create:{item_id:existing.id,godown_id:A.godown.id,unit_id:existing.primary_unit_id,received_quantity:1,serial_ids:['LICENSE-BLOCKED-'+suffix]}}}});
    await call('post','purchase/receipts/'+draft.id+'/post').send({}).expect(403);
    expect((await db.goodsReceipt.findUniqueOrThrow({where:{id:draft.id}})).status).toBe('DRAFT');
    await retail('get','items').expect(200);
    await db.tenantEntitlement.update({where:key,data:{is_enabled:true}});
    const previous=feature.rollout_mode;
    try{await db.feature.update({where:{id:feature.id},data:{rollout_mode:'OFF'}});await retail('post','items').send({name:'Global stopped serial capability',selling_price:100,track_serial:true}).expect(403);}
    finally{await db.feature.update({where:{id:feature.id},data:{rollout_mode:previous}});}
  });
  it('UPI profile/URI validation and invoice preference are tenant scoped; QR display never posts money',async()=>{
    await retail('post','payments/upi').send({upi_id:'not-upi',payee_name:'Shop',show_on_invoice:true}).expect(400);
    await retail('post','payments/upi').send({upi_id:'audit.shop@upi',payee_name:'Audit & Shop',show_on_invoice:true}).expect(201);
    const saved=(await retail('get','payments/upi').expect(200)).body;expect(saved.show_on_invoice).toBe(true);expect(saved.bank_verified).toBe(false);
    expect((await call('get','retail/payments/upi',B,tokenB).expect(200)).body.configured).toBe(false);
    const before=await db.voucher.count({where:{company_id:A.company.id}});
    const staticQr=(await retail('get','payments/upi/qr').expect(200)).body;expect(new URL(staticQr.uri).searchParams.has('am')).toBe(false);
    for(const value of [480,500]){const qr=(await retail('get','payments/upi/qr?amount='+value).expect(200)).body;const url=new URL(qr.uri);expect(url.searchParams.get('am')).toBe(value.toFixed(2));expect(url.searchParams.get('pn')).toBe('Audit & Shop');expect(qr.automatic_confirmation).toBe(false);}
    await retail('get','payments/upi/qr?amount=-1').expect(400);await retail('get','payments/upi').set('X-Company-Id',B.company.id).expect(403);
    expect(await db.voucher.count({where:{company_id:A.company.id}})).toBe(before);
    await retail('post','payments/upi').send({upi_id:'audit.shop@upi',payee_name:'Audit & Shop',show_on_invoice:false}).expect(201);
    expect((await retail('get','payments/upi').expect(200)).body.show_on_invoice).toBe(false);
  });
  it('Galla derives actual cash movement, separates UPI/Udhar, cash count does not change accounts, history/date isolation',async()=>{
    const businessDate=new Date(new Date(date).getTime()-2*86400000).toISOString().slice(0,10);
    await amount(100,'CASH',undefined,businessDate).expect(201);await amount(200,'UPI',undefined,businessDate).expect(201);await amount(300,'UDHAR',customer.id,businessDate).expect(201);
    await retail('post','customers/'+customer.id+'/payments').send({amount:50,payment_method:'CASH',date:businessDate}).expect(201);
    const p=(await retail('post','purchases').send({supplier_id:supplier.id,total_amount:100,payment_status:'CREDIT',purchase_date:businessDate}).expect(201)).body;
    await retail('post','suppliers/'+supplier.id+'/payments').send({amount:40,payment_method:'CASH',date:businessDate}).expect(201);
    await retail('post','expenses').send({type:'BUSINESS_EXPENSE',category_id:category.id,amount:10,payment_method:'CASH',date:businessDate}).expect(201);
    await retail('post','expenses').send({type:'OWNER_WITHDRAWAL',amount:20,payment_method:'CASH',date:businessDate}).expect(201);
    const s=(await retail('post','bills').send({items:[{item_id:item.id,quantity:1,rate:100}],payment_splits:[{method:'CASH',amount:100}],date:businessDate}).expect(201)).body;
    const l=await db.salesInvoiceLine.findFirst({where:{sales_invoice_id:s.id}});
    // Retail returns use today's business date. Refund coverage is asserted separately for that date.
    await retail('post','bills/return').send({original_invoice_id:s.id,lines:[{item_id:item.id,original_line_id:l!.id,quantity:1,rate:100}],refund_method:'CASH'}).expect(201);
    const countBefore=await db.voucher.count({where:{company_id:A.company.id}});
    const g=(await retail('post','galla/count').send({date:businessDate,opening_cash:2000,actual_cash:2070}).expect(201)).body;
    expect(g.total_sales).toBe(700);expect(g.cash_sales).toBe(200);expect(g.upi_sales).toBe(200);expect(g.udhar_sales).toBe(300);
    expect(g.old_dues_cash).toBe(50);expect(g.cash_expenses).toBe(10);expect(g.supplier_cash).toBe(40);expect(g.cash_owner_withdrawals).toBe(20);
    expect(g.expected_cash).toBe(2180);expect(g.difference).toBe(-110);expect(g.status).toBe('SHORT');
    expect(await db.voucher.count({where:{company_id:A.company.id}})).toBe(countBefore);
    expect((await retail('get','galla?date='+date).expect(200)).body.cash_refunds).toBeGreaterThanOrEqual(100);
    const foreign=(await call('get','retail/galla?date='+businessDate,B,tokenB).expect(200)).body;expect(foreign.total_sales).toBe(0);expect(foreign.opening_override).toBe(false);
    const history=(await retail('get','galla/history?before='+date).expect(200)).body;expect(history.some((h:any)=>h.date===businessDate&&h.difference===-110)).toBe(true);
    await retail('get','galla?date=2026-02-31').expect(400);
  });
  it('all posted journals remain balanced and no source vouchers outlive their company documents',async()=>{
    const vouchers=await db.voucher.findMany({where:{company_id:A.company.id,status:'POSTED'},include:{lines:true}});
    expect(vouchers.length).toBeGreaterThan(15);for(const v of vouchers){const debit=v.lines.reduce((s,l)=>s+Number(l.debit),0),credit=v.lines.reduce((s,l)=>s+Number(l.credit),0);expect(Math.abs(debit-credit)).toBeLessThan(.000001);}
    const sources:Record<string,string>={SALES_INVOICE:'salesInvoice',POS_RECEIPT:'salesInvoice',SALES_RETURN:'salesReturn',POS_REFUND:'salesReturn',PURCHASE_INVOICE:'purchaseInvoice',RETAIL_EXPENSE:'expense'};
    for(const v of vouchers){const model=v.source_document_type&&sources[v.source_document_type];if(model&&v.source_document_id)expect(await (db as any)[model].count({where:{id:v.source_document_id,company_id:A.company.id}})).toBe(1);}
    expect(await db.stockBalanceProjection.count({where:{company_id:A.company.id,quantity:{lt:0}}})).toBe(0);
  });
});
