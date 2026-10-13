import { Test } from '@nestjs/testing';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';

describe('Commercial plans, shop preferences, export ownership and production boundaries',()=>{
  let app:INestApplication,db:PrismaService,platformToken:string;
  const shops:Record<string,any>={},plans:Record<string,any>={},suffix=randomUUID(),password='Disposable!Plan926';
  const call=(method:string,path:string,code='STARTER')=>{
    const s=shops[code];return (request(app.getHttpServer()) as any)[method]('/api/v1/'+path).set('Authorization','Bearer '+s.token).set('X-Company-Id',s.company.id).set('X-Branch-Id',s.branch.id).set('X-Financial-Year-Id',s.financialYear.id);
  };
  const platform=(path:string)=>request(app.getHttpServer()).post('/api/v1/platform/admin/'+path).set('Authorization','Bearer '+platformToken);
  const access=async(code:string)=>(await call('get','retail/account/subscription',code).expect(200)).body;
  const item=(code:string,extra:any={})=>call('post','retail/items',code).send({name:'Commercial Item '+suffix,selling_price:10,...extra});
  beforeAll(async()=>{
    app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();
    app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
    for(const code of ['STARTER','SMART','PRO']){
      plans[code]=await db.plan.findUniqueOrThrow({where:{code}});
      const s=await app.get(TenantProvisioningService).provisionTenant({planId:plans[code].id,organizationName:'Commercial '+code+' '+suffix,adminEmail:'plans-'+code+'-'+suffix+'@test.invalid',adminName:'Owner',adminPassword:password});
      shops[code]={...s,token:(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:s.user.username,password}).expect(200)).body.access_token};
      shops[code].item=(await item(code,{opening_stock:10,opening_cost:3}).expect(201)).body;
      shops[code].customer=(await call('post','retail/customers',code).send({name:'Own '+code,opening_balance:50,mobile:'9876543210'}).expect(201)).body;
      shops[code].supplier=(await call('post','retail/suppliers',code).send({name:'Vendor '+code}).expect(201)).body;
    }
    const role=await db.platformRole.upsert({where:{name:'SUPER_ADMIN'},create:{name:'SUPER_ADMIN'},update:{}});
    const u=await db.platformUser.create({data:{username:'plans-admin-'+suffix,display_name:'Plan Test',password_hash:await bcrypt.hash(password,10),roles:{create:{role_id:role.id}}}});
    platformToken=(await request(app.getHttpServer()).post('/api/v1/platform/auth/login').send({username:u.username,password}).expect(200)).body.access_token;
  },60000);
  afterAll(async()=>{await app?.close();});

  it.each([['STARTER',75,0,1],['SMART',120,2,1],['PRO',210,5,1]])('serves %s identity, real price, limits and all-tier backup inclusion',async(code,price,staff,locations)=>{
    const a=await access(code as string);expect(a.current.plan_code).toBe(code);expect(a.entitlements.plan.monthly_price).toBe(price);expect(a.entitlements.limits.staff).toBe(staff);expect(a.entitlements.limits.stock_locations).toBe(locations);
    expect(a.entitlements.features.find((f:any)=>f.code==='BACKUP')).toMatchObject({plan_entitled:true,core:true,shop_enabled:true});expect(a.backup_provider.included_in_all_paid_plans).toBe(true);expect(a.payment_provider.checkout_available).toBe(false);expect(a.voice_provider.available).toBe(false);
    await platform('tenants/'+shops[code as string].organization.id+'/actions').send({action:'feature',feature_code:'BACKUP',enabled:false,reason:'Commercial override cannot remove data protection'}).expect(201);
    try{expect((await access(code as string)).entitlements.features.find((f:any)=>f.code==='BACKUP')).toMatchObject({plan_entitled:true,core:true,shop_enabled:true});}finally{
      await platform('tenants/'+shops[code as string].organization.id+'/actions').send({action:'clear_feature',feature_code:'BACKUP',reason:'Remove backup coverage test override'}).expect(201);
    }
  });
  it('fresh tenants have internal billing structures without setup and Starter posts a balanced bill',async()=>{
    for(const s of Object.values(shops)){expect(s.godown.id).toBeTruthy();expect(s.financialYear.id).toBeTruthy();expect(await db.ledgerAccount.count({where:{company_id:s.company.id}})).toBeGreaterThan(5);}
    const s=shops.STARTER;
    const sale=(await call('post','retail/bills').send({items:[{item_id:s.item.id,quantity:1,rate:10}],payment_splits:[{method:'CASH',amount:10}]}).expect(201)).body;
    expect(sale.id).toBeTruthy();const vouchers=await db.voucher.findMany({where:{company_id:s.company.id},include:{lines:true}});
    for(const v of vouchers)expect(v.lines.reduce((n,l)=>n+Number(l.debit)-Number(l.credit),0)).toBeCloseTo(0,6);
  });
  it.each(['has_variants','track_batch','track_serial','is_bundle'])('Starter cannot bypass %s via direct item API',async(field)=>{const r=await item('STARTER',{[field]:true}).expect(403);expect(r.body.code).toBe('FEATURE_NOT_ENTITLED');});
  it.each(['WEIGHT','LENGTH','AREA','VOLUME'])('Starter cannot create %s selling modes',async(mode)=>{expect((await item('STARTER',{selling_mode:mode}).expect(403)).body.code).toBe('FEATURE_NOT_ENTITLED');});
  it('Starter can ask basic questions but diagnosis and profit are paid, before reading entities',async()=>{
    const basic=(await call('post','assistant/query').send({message:'aaj ki sale',language:'hi'}).expect(201)).body;expect(basic.status).toBe('SUCCESS');
    for(const message of ['sale kam kyu hai','profit kam kyu hua'])expect((await call('post','assistant/query').send({message}).expect(201)).body.status).toBe('FEATURE_NOT_ENTITLED');
    const r=await call('get','retail/reports/financial/summary').expect(403);expect(r.body.code).toBe('FEATURE_NOT_ENTITLED');
    expect((await call('put','retail/gst/profile').send({}).expect(403)).body.code).toBe('FEATURE_NOT_ENTITLED');
  });
  it('Smart enables paid inventory, profit and diagnosis while serials remain Pro and voice is future',async()=>{
    await item('SMART',{track_batch:true}).expect(201);await item('SMART',{has_variants:true}).expect(201);await call('get','retail/reports/financial/summary','SMART').expect(200);
    expect((await call('post','assistant/query','SMART').send({message:'sale kam kyu hai'}).expect(201)).body.status).toBe('SUCCESS');
    await item('SMART',{track_serial:true}).expect(403);
    const v=await call('post','assistant/query','SMART').send({message:'aaj ki sale',channel:'VOICE'}).expect(403);expect(v.body.code).toBe('FEATURE_NOT_ENTITLED');
  });
  it('Pro serials work; unsupported voice provider never fabricates a successful voice answer',async()=>{
    await item('PRO',{track_serial:true,warranty_days:365}).expect(201);
    await item('SMART',{compatibility_tags:'Models A/B'}).expect(403);
    await item('PRO',{compatibility_tags:'Models A/B'}).expect(201);
    const price={code:'PRO-'+suffix,name:'Authorized price list'};
    await call('post','pricing/price-lists','SMART').send(price).expect(403);
    await call('post','pricing/price-lists','PRO').send(price).expect(201);
    const r=await call('post','assistant/query','PRO').send({message:'aaj ki sale',channel:'VOICE'}).expect(403);expect(r.body.code).toBe('FEATURE_NOT_ENTITLED');
  });
  it('item image uploads enforce plan access while core bill proofs remain available',async()=>{
    const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC','base64');
    await call('post','attachments').field('entityType','ITEM').field('entityId',shops.STARTER.item.id).field('category','ITEM_IMAGE').attach('file',image,{filename:'item.png',contentType:'image/png'}).expect(403);
    await call('post','attachments','SMART').field('entityType','ITEM').field('entityId',shops.SMART.item.id).field('category','ITEM_IMAGE').attach('file',image,{filename:'item.png',contentType:'image/png'}).expect(201);
  });
  it('shop toggle immediately restricts new use and preserves preferences, inventory and accounting',async()=>{
    const before={stock:await db.stockMovement.count({where:{company_id:shops.SMART.company.id}}),journals:await db.voucher.count({where:{company_id:shops.SMART.company.id}})};
    await call('post','retail/account/features/BATCH_TRACKING','SMART').send({enabled:false}).expect(201);expect((await item('SMART',{track_batch:true}).expect(403)).body.code).toBe('SHOP_FEATURE_DISABLED');
    expect((await access('SMART')).entitlements.features.find((f:any)=>f.code==='BATCH_TRACKING').shop_enabled).toBe(false);
    const results=await Promise.all(['BATCH_TRACKING','VARIANTS'].map(key=>call('post','retail/account/features/'+key,'SMART').send({enabled:true}).expect(201)));expect(results).toHaveLength(2);
    await item('SMART',{track_batch:true}).expect(201);
    expect(await db.stockMovement.count({where:{company_id:shops.SMART.company.id}})).toBe(before.stock);expect(await db.voucher.count({where:{company_id:shops.SMART.company.id}})).toBe(before.journals);
    expect(await db.auditLog.count({where:{company_id:shops.SMART.company.id,action:'SHOP_FEATURE_DISABLED'}})).toBeGreaterThan(0);
  });
  it('locked toggles, core toggles, forged payloads and cross-tenant settings fail',async()=>{
    await call('post','retail/account/features/ASSISTANT_VOICE','SMART').send({enabled:true}).expect(403);
    await call('post','retail/account/features/BACKUP').send({enabled:false}).expect(400);
    await call('post','retail/account/features/BATCH_TRACKING','SMART').send({enabled:true,company_id:shops.PRO.company.id}).expect(403);
    await call('get','retail/account/subscription','SMART').set('X-Company-Id',shops.PRO.company.id).expect(403);
    await call('post','platform/admin/tenants/'+shops.SMART.organization.id+'/actions','SMART').send({action:'subscription',plan_id:plans.PRO.id,reason:'Forged upgrade'}).expect(401);
  });
  it('Smart staff limit allows two extra accounts and blocks the third',async()=>{
    for(let i=0;i<2;i++)await call('post','users','SMART').send({username:'commercial-staff-'+i+'-'+suffix,display_name:'Staff '+i,password}).expect(201);
    const r=await call('post','users','SMART').send({username:'commercial-staff-3-'+suffix,display_name:'Overflow',password}).expect(403);expect(r.body.message).toContain('limit');
    await call('post','users').send({username:'starter-staff-'+suffix,display_name:'No staff',password}).expect(403);
  });
  it('platform override can grant a capability but rollout OFF still wins',async()=>{
    const org=shops.SMART.organization.id;
    await platform('tenants/'+org+'/actions').send({action:'feature',feature_code:'SERIAL_TRACKING',enabled:true,reason:'Grant serial support test'}).expect(201);
    await item('SMART',{track_serial:true}).expect(201);
    const f=await db.feature.findUniqueOrThrow({where:{code:'SERIAL_TRACKING'}});
    try{await platform('features').send({code:f.code,name:f.name,is_active:true,rollout_mode:'OFF',rollout_percent:100,beta_tenants:[]}).expect(201);await item('SMART',{track_serial:true}).expect(403);}finally{
      await platform('features').send({code:f.code,name:f.name,is_active:f.is_active,rollout_mode:f.rollout_mode,rollout_percent:f.rollout_percent,beta_tenants:f.beta_tenants}).expect(201);
      await platform('tenants/'+org+'/actions').send({action:'clear_feature',feature_code:'SERIAL_TRACKING',reason:'Remove test override'}).expect(201);
    }
  });
  it('downgrade preserves physical and financial history, serials and locations and restricts new paid use',async()=>{
    const s=shops.PRO;
    await platform('tenants/'+s.organization.id+'/actions').send({action:'feature',feature_code:'MULTIPLE_STOCK_LOCATIONS',enabled:true,reason:'Historical location fixture'}).expect(201);
    await platform('tenants/'+s.organization.id+'/actions').send({action:'limits',limits:{stock_locations:2},reason:'Historical location fixture capacity'}).expect(201);
    const location=(await call('post','godowns','PRO').send({branch_id:s.branch.id,code:'SECOND',name:'Warehouse'}).expect(201)).body;
    await platform('tenants/'+s.organization.id+'/actions').send({action:'clear_feature',feature_code:'MULTIPLE_STOCK_LOCATIONS',reason:'Remove fixture grant before downgrade'}).expect(201);
    const serial=await db.item.findFirstOrThrow({where:{company_id:s.company.id,track_serial:true}});
    const before={stock:await db.stockMovement.count({where:{company_id:s.company.id}}),vouchers:await db.voucher.count({where:{company_id:s.company.id}})};
    await platform('tenants/'+s.organization.id+'/actions').send({action:'subscription',plan_id:plans.SMART.id,reason:'Safe downgrade test'}).expect(201);
    try{await item('PRO',{track_serial:true}).expect(403);await call('post','godowns','PRO').send({branch_id:s.branch.id,code:'THIRD',name:'Forbidden'}).expect(403);
      await call('get','godowns/'+location.id,'PRO').expect(200);await call('get','retail/items/'+serial.id+'/options','PRO').expect(200);
      expect(await db.stockMovement.count({where:{company_id:s.company.id}})).toBe(before.stock);expect(await db.voucher.count({where:{company_id:s.company.id}})).toBe(before.vouchers);
    }finally{await platform('tenants/'+s.organization.id+'/actions').send({action:'subscription',plan_id:plans.PRO.id,reason:'Restore Pro test'}).expect(201);}
    await platform('tenants/'+s.organization.id+'/actions').send({action:'limits',limits:{stock_locations:2},reason:'Check location limit'}).expect(201);
    await platform('tenants/'+s.organization.id+'/actions').send({action:'feature',feature_code:'MULTIPLE_STOCK_LOCATIONS',enabled:true,reason:'Test location capacity override'}).expect(201);
    try{const r=await call('post','godowns','PRO').send({branch_id:s.branch.id,code:'OVERFLOW',name:'Too many'}).expect(403);expect(r.body.message).toContain('limit');}finally{await platform('tenants/'+s.organization.id+'/actions').send({action:'limits',limits:{},reason:'Restore location limit'}).expect(201);await platform('tenants/'+s.organization.id+'/actions').send({action:'clear_feature',feature_code:'MULTIPLE_STOCK_LOCATIONS',reason:'Remove fixture grant'}).expect(201);}
  });
  it.each([
    ...['ITEMS','STOCK','SALES','RETURNS'].map(k=>['STARTER',k]),
    ...['ITEMS','STOCK','CUSTOMERS','SUPPLIERS','KHATA','SALES','RETURNS','PURCHASES','EXPENSES','GST','PROFIT'].map(k=>['SMART',k]),
    ...['ITEMS','STOCK','CUSTOMERS','SUPPLIERS','KHATA','SALES','RETURNS','PURCHASES','EXPENSES','GST','PROFIT','STAFF','DOCUMENTS'].map(k=>['PRO',k]),
  ])('%s authorizes its implemented %s export and audits it',async(code,kind)=>{
    const s=shops[code],query=kind==='KHATA'?'?party_id='+s.customer.id+'&party_type=CUSTOMER':'';
    const r=await call('get','retail/account/exports/'+kind+query,code).expect(200);expect(r.body.headers).toBeInstanceOf(Array);expect(r.body.rows).toBeInstanceOf(Array);expect(JSON.stringify(r.body)).not.toContain('password_hash');
    expect(await db.auditLog.count({where:{company_id:s.company.id,action:'TENANT_REPORT_EXPORTED'}})).toBeGreaterThan(0);
  });
  it.each(['CUSTOMERS','SUPPLIERS','KHATA','PURCHASES','EXPENSES','GST','PROFIT','STAFF','LOCATIONS','DOCUMENTS'])('Starter direct %s export is blocked with upgrade information',async(kind)=>{const r=await call('get','retail/account/exports/'+kind).expect(403);expect(r.body.code).toBe('FEATURE_NOT_ENTITLED');if(kind!=='LOCATIONS')expect(r.body.required_plan).toBeTruthy();else expect(r.body.required_plan).toBeNull();});
  it.each(['STAFF','DOCUMENTS'])('Smart direct %s export is blocked with Pro upgrade information',async(kind)=>{const r=await call('get','retail/account/exports/'+kind,'SMART').expect(403);expect(r.body.code).toBe('FEATURE_NOT_ENTITLED');expect(r.body.required_plan).toBe('PRO');});
  it('complete Pro export finishes, includes safe staff directory and never leaks credentials or foreign records',async()=>{
    for(const code of ['STARTER','SMART'])expect((await call('get','retail/account/export',code).expect(403)).body.code).toBe('FEATURE_NOT_ENTITLED');
    const r=await call('get','retail/account/export','PRO').expect(200);expect(r.text.trim().endsWith('{"complete":true}')).toBe(true);
    expect(r.text).toContain('"resource":"user"');expect(r.text).not.toMatch(/password_hash|storage_key|google_subject|token_hash/);expect(r.text).not.toContain(shops.SMART.company.id);
    await call('get','retail/account/exports/SCHEDULED','PRO').expect(404);
  });
  it('export pagination and cross-tenant IDs are checked by the server',async()=>{
    const a=(await call('get','retail/account/exports/ITEMS?limit=1','SMART').expect(200)).body;expect(a.rows).toHaveLength(1);expect(a.hasMore).toBe(true);expect(a.nextOffset).toBe(1);
    const b=(await call('get','retail/account/exports/ITEMS?limit=1&offset=1','SMART').expect(200)).body;expect(a.rows).not.toEqual(b.rows);
    await call('get','retail/account/exports/ITEMS?ids='+shops.PRO.item.id,'SMART').expect(404);
    await call('get','retail/account/exports/KHATA?party_id='+shops.PRO.customer.id+'&party_type=CUSTOMER','SMART').expect(404);
    await call('get','retail/account/exports/CUSTOMERS?limit=1001','SMART').expect(400);
    const customers=(await call('get','retail/account/exports/CUSTOMERS','SMART').expect(200)).body;expect(JSON.stringify(customers)).toContain('Own SMART');
  });
  it.each(['STARTER','SMART','PRO'])('recorded owner portability on %s never requires an upgrade or deletes business records',async(code)=>{
    const r=await call('post','retail/account/privacy-requests',code).send({type:'DATA_PORTABILITY',note:'Account-exit copy'}).expect(201);expect(r.body.status).toBe('PENDING');
    const download=await call('get','retail/account/export',code).expect(200);expect(download.text).toContain('"complete":true');expect(await db.company.count({where:{id:shops[code].company.id}})).toBe(1);
    expect(await db.auditLog.count({where:{company_id:shops[code].company.id,action:'BUSINESS_DATA_EXPORT',details:{contains:'ACCOUNT_EXIT_PORTABILITY'}}})).toBeGreaterThan(0);
  });
  it('expiration restricts new business use, preserves history and allows account-exit data on all tiers',async()=>{
    for(const code of ['STARTER','SMART','PRO']){
      const s=shops[code];await db.tenantSubscription.update({where:{organization_id:s.organization.id},data:{expires_at:new Date(Date.now()-86400000)}});
      try{expect((await access(code)).entitlements.subscription_active).toBe(false);await item(code).expect(403);await call('get','retail/items',code).expect(200);await call('get','retail/account/export',code).expect(200);await call('get','retail/account/exports/ITEMS',code).expect(403);
      }finally{await platform('tenants/'+s.organization.id+'/actions').send({action:'subscription',plan_id:plans[code].id,expires_at:new Date(Date.now()+30*86400000).toISOString(),reason:'Renew test'}).expect(201);}
      expect((await access(code)).entitlements.subscription_active).toBe(true);
    }
  });
});
