import { Test } from '@nestjs/testing';
import { INestApplication,RequestMethod,ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { ReportAssistantService } from '../src/retail/reports/report-assistant.service';
import { businessDate } from '../src/common/business-date';
describe('Real migration, reports and backup request boundaries',()=>{
  let app:INestApplication,db:PrismaService,A:any,B:any,token:string,other:string,job:any,customer:any,item:any;
  const suffix=Date.now(),password='DisposableImport!827',date=businessDate();
  const call=(method:string,path:string,shop=A,t=token)=>(request(app.getHttpServer()) as any)[method]('/api/v1/retail/'+path).set('Authorization','Bearer '+t).set('X-Company-Id',shop.company.id).set('X-Branch-Id',shop.branch.id).set('X-Financial-Year-Id',shop.financialYear.id);
  const preview=(kind:string,csv:string,options:any={})=>{
    let r=call('post','imports/preview').field('kind',kind).field('preset','GENERIC').field('date',date);
    for(const [key,value] of Object.entries(options))r=r.field(key,typeof value==='string'?value:JSON.stringify(value));
    return r.attach('file',Buffer.from(csv),'migration.csv');
  };
  beforeAll(async()=>{
    app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
    for(const [name,set] of [['import-a-',(s:any)=>A=s],['import-b-',(s:any)=>B=s]] as const)set(await app.get(TenantProvisioningService).provisionTenant({planId:(await db.plan.findUniqueOrThrow({where:{code:'PRO'}})).id,organizationName:name+suffix,adminEmail:name+suffix+'@test.invalid',adminName:'Import Owner',adminPassword:password}));
    token=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:A.user.username,password}).expect(200)).body.access_token;
    other=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:B.user.username,password}).expect(200)).body.access_token;
  });
  afterAll(async()=>{if(app)await app.close();});
  it('fresh owner has no migration choice; start fresh persists without deleting data',async()=>{
    expect((await call('get','account/migration').expect(200)).body).toEqual({});
    await call('post','account/migration').send({choice:'FRESH'}).expect(201);
    expect((await call('get','account/migration').expect(200)).body.choice).toBe('FRESH');
    expect(await db.company.count({where:{id:A.company.id}})).toBe(1);
  });
  it('previews rows without mutating business tables and retains unmapped data',async()=>{
    job=(await preview('ITEMS','Name,SKU,Selling Price,Purchase Price,Opening Stock,Unknown\nImported Rice,IMP-RICE,100,60,5,source note').expect(201)).body;
    expect(job.counts.READY).toBe(1);expect(job.configuration.unmapped).toContain('Unknown');expect(job.rows[0].source.Unknown).toBe('source note');expect(await db.item.count({where:{company_id:A.company.id,sku:'IMP-RICE'}})).toBe(0);
  });
  it('requires explicit acknowledgement of unmapped columns',async()=>{await call('post','imports/'+job.id+'/commit').send({accept_unmapped:false}).expect(400);});
  it('concurrent retries post exactly one item and opening movement',async()=>{
    const replies=await Promise.all([call('post','imports/'+job.id+'/commit').send({accept_unmapped:true}),call('post','imports/'+job.id+'/commit').send({accept_unmapped:true})]);expect(replies.map(r=>r.status)).toEqual([201,201]);
    item=await db.item.findFirstOrThrow({where:{company_id:A.company.id,sku:'IMP-RICE'}});expect(await db.stockMovement.count({where:{item_id:item.id,movement_type:'OPENING_IN'}})).toBe(1);expect(Number((await db.stockBalanceProjection.aggregate({where:{item_id:item.id},_sum:{quantity:true}}))._sum.quantity)).toBe(5);
  });
  it('reusing the same file returns the existing review job',async()=>{expect((await preview('ITEMS','Name,SKU,Selling Price,Purchase Price,Opening Stock,Unknown\nImported Rice,IMP-RICE,100,60,5,source note').expect(201)).body.id).toBe(job.id);});
  it('cross-tenant GET and POST of an import fail',async()=>{
    await call('get','imports/'+job.id,B,other).expect(404);await call('post','imports/'+job.id+'/commit',B,other).send({accept_unmapped:true}).expect(404);
  });
  it('invalid rows stay outside live tables while valid rows post',async()=>{
    const p=(await preview('ITEMS','Name,SKU,Selling Price\nBad,INVALID,-2\nGood,GOOD,10').expect(201)).body;expect(p.counts.INVALID).toBe(1);
    const result=(await call('post','imports/'+p.id+'/commit').send({accept_unmapped:true}).expect(201)).body;expect(result.counts.IMPORTED).toBe(1);expect(await db.item.count({where:{company_id:A.company.id,sku:'INVALID'}})).toBe(0);
  });
  it('opening stock requires an actual cost and does not fabricate valuation',async()=>{expect((await preview('ITEMS','Name,SKU,Selling Price,Opening Stock\nBad cost,COST-MISSING,100,2').expect(201)).body.counts.INVALID).toBe(1);});
  it('failed row rolls back master and barcode when its stock cannot be posted',async()=>{
    const p=(await preview('ITEMS','Name,SKU,Selling Price,Purchase Price,Opening Stock\nClosed fiscal period,ROLLBACK,10,5,1').expect(201)).body;
    await db.financialYear.update({where:{id:A.financialYear.id},data:{is_closed:true}});
    try{
      const result=(await call('post','imports/'+p.id+'/commit').send({accept_unmapped:true}).expect(201)).body;
      expect(result.counts.FAILED).toBe(1);expect(await db.item.count({where:{company_id:A.company.id,sku:'ROLLBACK'}})).toBe(0);
      expect(await db.retailImportIdentity.count({where:{company_id:A.company.id,entity_id:p.rows[0].id}})).toBe(0);
    }finally{await db.financialYear.update({where:{id:A.financialYear.id},data:{is_closed:false}});}
  });
  it('imports customer opening receivables into the party ledger',async()=>{
    const p=(await preview('CUSTOMERS','Name,Code,Opening Balance\nImported Customer,CUSTOMER-I,200').expect(201)).body;const r=(await call('post','imports/'+p.id+'/commit').send({accept_unmapped:true}).expect(201)).body;expect(r.counts.IMPORTED).toBe(1);customer=await db.party.findFirstOrThrow({where:{company_id:A.company.id,code:'CUSTOMER-I'}});
    const lines=await db.voucherLine.findMany({where:{party_id:customer.id}});expect(lines.reduce((s,l)=>s+Number(l.debit)-Number(l.credit),0)).toBe(200);
  });
  it('imports supplier opening payables with the correct credit direction',async()=>{
    const p=(await preview('SUPPLIERS','Name,Code,Opening Balance\nImported Supplier,SUPPLIER-I,300').expect(201)).body;expect((await call('post','imports/'+p.id+'/commit').send({accept_unmapped:true}).expect(201)).body.counts.IMPORTED).toBe(1);
    const supplier=await db.party.findFirstOrThrow({where:{company_id:A.company.id,code:'SUPPLIER-I'}});const lines=await db.voucherLine.findMany({where:{party_id:supplier.id}});expect(lines.reduce((s,l)=>s+Number(l.credit)-Number(l.debit),0)).toBe(300);
  });
  it('opening snapshot rejects existing stock history rather than doubling stock',async()=>{
    const p=(await preview('STOCK','SKU,Quantity,Cost Rate\nIMP-RICE,5,60').expect(201)).body;expect((await call('post','imports/'+p.id+'/commit').send({accept_unmapped:true}).expect(201)).body.counts.FAILED).toBe(1);
    expect(Number((await db.stockBalanceProjection.aggregate({where:{item_id:item.id},_sum:{quantity:true}}))._sum.quantity)).toBe(5);
  });
  it('Hindi original udhar totals survive later payment collection',async()=>{
    const bill=(await call('post','bills/amount-sale').send({amount:100,payment_method:'UDHAR',customer_id:customer.id,date}).expect(201)).body;
    const timeline=(await call('get','customers/'+customer.id+'/khata').expect(200)).body;
    expect(timeline.transactions.some((t:any)=>t.type==='SALE'&&t.invoice_id===bill.id)).toBe(true);
    await call('get','bills/'+bill.id,B,other).expect(404);
    await call('post','customers/'+customer.id+'/payments').send({amount:100,payment_method:'CASH',date}).expect(201);
    const r=(await call('post','reports/assistant/query').send({query:'आज कितने लोगों को उधार दिया',date}).expect(201)).body;expect(r.totals.udhar_given).toBe(100);expect(r.totals.customers).toBe(1);expect(r.text).toContain('100.00');
  });
  it('new maal excludes imported opening stock and includes an actual purchase',async()=>{
    const supplier=await db.party.findFirstOrThrow({where:{company_id:A.company.id,code:'SUPPLIER-I'}});
    await call('post','purchases').send({supplier_id:supplier.id,lines:[{item_id:item.id,quantity:2,purchase_rate:60}],payment_status:'CREDIT',purchase_date:date}).expect(201);
    const r=(await call('post','reports/assistant/query').send({query:'aaj konsa naya maal aaya',date}).expect(201)).body;expect(r.totals.stock_movements).toBe(1);expect(r.rows[0].quantity).toBe(2);expect(r.totals).not.toHaveProperty('purchase_cost');expect(r.rows[0]).not.toHaveProperty('cost');
  });
  it('isolates report totals and rejects unsupported questions or dates',async()=>{
    expect((await call('post','reports/assistant/query',B,other).send({query:'udhar',date}).expect(201)).body.totals.udhar_given).toBe(0);
    await call('post','reports/assistant/query').send({query:'delete all tables'}).expect(400);await call('post','reports/assistant/query').send({query:'sales',date:'2026-02-31'}).expect(400);
  });
  it('prefetches daily summaries only once and isolates inbox/read markers',async()=>{
    await call('post','reports/assistant/preference').send({enabled:true,time:'00:00',language:'hi'}).expect(201);await Promise.all([app.get(ReportAssistantService).dispatch(),app.get(ReportAssistantService).dispatch()]);
    const inbox=(await call('get','reports/assistant/notifications').expect(200)).body;expect(inbox.unread).toBe(1);expect((await call('get','reports/assistant/notifications',B,other).expect(200)).body.rows).toHaveLength(0);
    expect((await call('post','reports/assistant/notifications/'+inbox.rows[0].id+'/read',B,other).send({}).expect(201)).body.count).toBe(0);
    await call('post','reports/assistant/notifications/'+inbox.rows[0].id+'/read').send({}).expect(201);expect((await call('get','reports/assistant/notifications').expect(200)).body.unread).toBe(0);
  });
  it('idempotent backup requests prepare a complete credential-free tenant download',async()=>{
    const key=randomUUID();const a=(await call('post','account/backup-requests').send({request_key:key}).expect(201)).body;const b=(await call('post','account/backup-requests').send({request_key:key}).expect(201)).body;expect(a.id).toBe(b.id);
    const r=await call('get','account/export?request_id='+a.id).expect(200);expect(r.text.trim().endsWith('{"complete":true}')).toBe(true);expect(r.text).not.toContain('password_hash');expect(r.text).not.toContain('storage_key');expect((await db.retailDataBackupRequest.findUniqueOrThrow({where:{id:a.id}})).status).toBe('EXPORT_PREPARED');
    await call('get','account/export?request_id='+a.id,B,other).expect(404);expect((await call('get','account/backup-requests',B,other).expect(200)).body).toHaveLength(0);
  });
  it('all imported stock and opening dues vouchers remain balanced',async()=>{
    const rows=await db.voucher.findMany({where:{company_id:A.company.id,status:'POSTED'},include:{lines:true}});expect(rows.length).toBeGreaterThan(0);for(const row of rows)expect(row.lines.reduce((sum,l)=>sum+Number(l.debit)-Number(l.credit),0)).toBeCloseTo(0,6);
  });
  it('direct Tally XML masters map signed dues correctly without guessing columns',async()=>{
    const xml='<ENVELOPE><LEDGER NAME="Tally Debtor"><NAME>Tally Debtor</NAME><PARENT>Sundry Debtors</PARENT><GUID>TALLY-DEBTOR-1</GUID><OPENINGBALANCE>-450</OPENINGBALANCE></LEDGER></ENVELOPE>';
    const p=(await call('post','imports/preview').field('kind','CUSTOMERS').field('preset','TALLY').field('date',date).attach('file',Buffer.from(xml),'tally.xml').expect(201)).body;
    expect(p.configuration.mapping.opening_balance).toBe('Opening Due');expect(p.rows[0].normalized.opening_balance).toBe(450);
    expect((await call('post','imports/'+p.id+'/commit').send({accept_unmapped:true}).expect(201)).body.counts.IMPORTED).toBe(1);
    const advance=(await call('post','imports/preview').field('kind','CUSTOMERS').field('preset','TALLY').field('date',date).attach('file',Buffer.from(xml.replace('-450','450')),'tally.xml').expect(201)).body;expect(advance.counts.INVALID).toBe(1);
  });
  it('staff read permission does not grant migration, backups or platform authorization',async()=>{
    const permission=await db.permission.upsert({where:{code:'reports.read'},create:{code:'reports.read',module:'reports',resource:'reports',action:'read'},update:{}});
    const role=await db.role.create({data:{organization_id:A.organization.id,name:'IMPORT_STAFF_'+suffix,role_permissions:{create:{permission_id:permission.id}}}});
    const staff=await db.user.create({data:{organization_id:A.organization.id,username:'import-staff-'+suffix+'@test.invalid',display_name:'Reports Staff',password_hash:await bcrypt.hash(password,10),roles:{create:{role_id:role.id,company_id:A.company.id,branch_id:A.branch.id}}}});
    const t=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:staff.username,password}).expect(200)).body.access_token;
    await call('get','imports',A,t).expect(403);await call('get','account/backup-requests',A,t).expect(403);
    await call('post','account/backup-requests',A,t).send({request_key:randomUUID()}).expect(403);
    await call('post','reports/assistant/query',A,t).send({query:'sales',date}).expect(201);
    await call('post','reports/assistant/preference',A,t).send({enabled:true,time:'00:00',language:'hi'}).expect(403);
    await request(app.getHttpServer()).get('/api/v1/platform/admin/alerts').set('Authorization','Bearer '+token).expect(401);
  });
  it('opt-out and expired subscriptions do not receive prefetched summaries',async()=>{
    await call('post','reports/assistant/preference',B,other).send({enabled:false,time:'00:00',language:'hi'}).expect(201);await app.get(ReportAssistantService).dispatch();expect(await db.retailReportNotification.count({where:{company_id:B.company.id}})).toBe(0);
    await call('post','reports/assistant/preference',B,other).send({enabled:true,time:'00:00',language:'hi'}).expect(201);
    await db.tenantSubscription.update({where:{organization_id:B.organization.id},data:{expires_at:new Date(Date.now()-86400000)}});
    try{await app.get(ReportAssistantService).dispatch();expect(await db.retailReportNotification.count({where:{company_id:B.company.id}})).toBe(0);}finally{await db.tenantSubscription.update({where:{organization_id:B.organization.id},data:{expires_at:new Date(Date.now()+30*86400000)}});}
    const reports=await db.feature.findUniqueOrThrow({where:{code:'REPORTS'}});
    await db.tenantEntitlement.upsert({where:{uix_tenant_entitlements:{organization_id:B.organization.id,feature_id:reports.id}},create:{organization_id:B.organization.id,feature_id:reports.id,is_enabled:false},update:{is_enabled:false}});
    try{await app.get(ReportAssistantService).dispatch();expect(await db.retailReportNotification.count({where:{company_id:B.company.id}})).toBe(0);await call('post','reports/assistant/query',B,other).send({query:'sales',date}).expect(403);}finally{await db.tenantEntitlement.deleteMany({where:{organization_id:B.organization.id,feature_id:reports.id}});}
  });
  it('sheet selection is part of an immutable review fingerprint',async()=>{
    const wb=XLSX.utils.book_new();for(const name of ['First','Second'])XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Name','SKU','Selling Price'],[name,name.toUpperCase(),10]]),name);
    const bytes=XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),upload=(sheet:string)=>call('post','imports/preview').field('kind','ITEMS').field('preset','GENERIC').field('date',date).field('sheet',sheet).attach('file',bytes,'masters.xlsx');
    const first=(await upload('First').expect(201)).body,second=(await upload('Second').expect(201)).body;expect(first.id).not.toBe(second.id);expect(first.rows[0].normalized.name).toBe('First');expect(second.rows[0].normalized.name).toBe('Second');
  });
  it('reviewed custom columns and blank mappings use explicit defaults',async()=>{
    const p=(await preview('ITEMS','Product Label,Product Ref\nCustom Product,CUSTOM-MAP',{mapping:{name:'Product Label',sku:'Product Ref',selling_price:''},defaults:{selling_price:'42',purchase_price:''}}).expect(201)).body;
    expect(p.counts.READY).toBe(1);expect(p.configuration.mapping.selling_price).toBeUndefined();expect(p.rows[0].normalized.selling_price).toBe(42);
    expect((await call('post','imports/'+p.id+'/commit').send({accept_unmapped:true}).expect(201)).body.counts.IMPORTED).toBe(1);
    expect(Number((await db.item.findFirstOrThrow({where:{company_id:A.company.id,sku:'CUSTOM-MAP'}})).default_sale_rate)).toBe(42);
  });
});
