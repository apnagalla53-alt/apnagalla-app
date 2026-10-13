import { Test } from '@nestjs/testing';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { defaultPlanFeatures } from '../src/common/retail-plan-catalog';
import { AuthService } from '../src/auth/auth.service';

describe('Final launch plan direct API matrix',()=>{
  let app:INestApplication,db:PrismaService,platformToken:string;
  const shops:Record<string,any>={},plans:Record<string,any>={},suffix=randomUUID(),password='LaunchTest!926515';
  const call=(method:string,path:string,code='STARTER')=>{
    const s=shops[code];return (request(app.getHttpServer()) as any)[method]('/api/v1/'+path).set('Authorization','Bearer '+s.token).set('X-Company-Id',s.company.id).set('X-Branch-Id',s.branch.id).set('X-Financial-Year-Id',s.financialYear.id);
  };
  const action=(code:string,data:any)=>request(app.getHttpServer()).post('/api/v1/platform/admin/tenants/'+shops[code].organization.id+'/actions').set('Authorization','Bearer '+platformToken).send({...data,reason:'Disposable launch-plan acceptance'});
  const item=(code:string,extra:any={})=>call('post','retail/items',code).send({name:'Launch item '+randomUUID(),selling_price:10,...extra});
  const photo=(code:string,id:string)=>call('post','attachments',code).field('entityType','ITEM').field('entityId',id).field('category','ITEM_IMAGE').attach('file',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC','base64'),{filename:'item.png',contentType:'image/png'});
  beforeAll(async()=>{
    app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();
    app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
    for(const code of ['STARTER','SMART','PRO']){
      plans[code]=await db.plan.findUniqueOrThrow({where:{code}});
      const s=await app.get(TenantProvisioningService).provisionTenant({planId:plans[code].id,organizationName:'Launch '+code+' '+suffix,adminEmail:code+'-'+suffix+'@test.invalid',adminName:'Launch Owner',adminPassword:password});
      shops[code]={...s,token:(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:s.user.username,password}).expect(200)).body.access_token};
      shops[code].item=(await item(code,{opening_stock:20,opening_cost:3}).expect(201)).body;
    }
    const role=await db.platformRole.upsert({where:{name:'SUPER_ADMIN'},create:{name:'SUPER_ADMIN'},update:{}});
    const user=await db.platformUser.create({data:{username:'launch-admin-'+suffix,display_name:'Launch admin',password_hash:await bcrypt.hash(password,12),roles:{create:{role_id:role.id}}}});
    platformToken=(await request(app.getHttpServer()).post('/api/v1/platform/auth/login').send({username:user.username,password}).expect(200)).body.access_token;
  },60000);
  afterAll(async()=>{await app?.close();});

  it.each([['STARTER',75,16,1,0,2],['SMART',120,38,3,2,5],['PRO',210,45,6,5,10]])('%s: exact persisted public matrix, limits and future exclusion',async(code,price,count,users,staff,devices)=>{
    const a=(await call('get','retail/account/subscription',String(code)).expect(200)).body;
    expect(a.plans.map((p:any)=>p.code)).toEqual(['STARTER','SMART','PRO']);
    const p=a.plans.find((p:any)=>p.code===code);expect(p.monthly_price).toBe(price);expect(p.features).toHaveLength(count);expect(p.limits).toEqual({users,staff,devices,branches:1,stock_locations:1,companies:1});
    expect(p.features.map((f:any)=>f.code).sort()).toEqual(defaultPlanFeatures(String(code)).sort());
    for(const key of ['MULTIPLE_STOCK_LOCATIONS','ASSISTANT_VOICE','EXPORT_SCHEDULED','EXPORT_LOCATIONS'])expect(a.entitlements.features.find((f:any)=>f.code===key).plan_entitled).toBe(false);
    const v=await call('post','assistant/query',String(code)).send({message:'aaj ki sale',channel:'VOICE'}).expect(403);expect(v.body.required_plan).toBeNull();
  });
  it('STARTER: item photo creation denied, core bill proof not a photo upsell',async()=>{
    const result=await photo('STARTER',shops.STARTER.item.id).expect(403);expect(result.body.feature).toBe('ITEM_IMAGES');
  });
  it.each(['SMART','PRO'])('%s: item photo upload allowed',async(code)=>{
    shops[code].image=(await photo(code,shops[code].item.id).expect(201)).body;
  });
  it('STARTER: GST, profit and diagnostic insight deny direct access',async()=>{
    await call('put','retail/gst/profile').send({}).expect(403);await call('get','retail/reports/financial/summary').expect(403);
    expect((await call('post','assistant/query').send({message:'profit kam kyu hua'}).expect(201)).body.status).toBe('FEATURE_NOT_ENTITLED');
  });
  it('SMART: GST, profit and business insights have real backend access',async()=>{
    const gst=await call('put','retail/gst/profile','SMART').send({});expect(gst.status).toBe(400);expect(gst.body.code).not.toBe('FEATURE_NOT_ENTITLED');
    await call('get','retail/reports/financial/summary','SMART').expect(200);
    expect((await call('post','assistant/query','SMART').send({message:'sale kam kyu hai'}).expect(201)).body.status).toBe('SUCCESS');
  });
  it.each(['STARTER','SMART','PRO'])('%s: serial creation respects final plan minimum',async(code)=>{await item(code,{track_serial:true}).expect(code==='PRO'?201:403);});
  it('PRO: new locations, branches, transfers and second business are not included',async()=>{
    await call('post','godowns','PRO').send({branch_id:shops.PRO.branch.id,name:'Forbidden location',code:'NO'}).expect(403);
    await call('post','branches','PRO').send({company_id:shops.PRO.company.id,name:'Forbidden store',code:'NO'}).expect(403);
    await call('post','inventory/transfers','PRO').send({}).expect(403);
    await call('post','companies','PRO').send({organization_id:shops.PRO.organization.id,legal_name:'Second business',code:'SECOND'}).expect(403);
  });
  it('Overrides: Pro FORCE_ENABLE locations + explicit capacity grant is tenant-only and INHERIT removes it',async()=>{
    await action('PRO',{action:'feature',feature_code:'MULTIPLE_STOCK_LOCATIONS',enabled:true}).expect(201);
    await action('PRO',{action:'limits',limits:{stock_locations:2}}).expect(201);
    const location=(await call('post','godowns','PRO').send({branch_id:shops.PRO.branch.id,name:'Exceptional location',code:'EXTRA'}).expect(201)).body;shops.PRO.extra=location;
    const before=await db.planFeature.count({where:{plan_id:plans.PRO.id}});expect(before).toBe(45);
    await action('PRO',{action:'clear_feature',feature_code:'MULTIPLE_STOCK_LOCATIONS'}).expect(201);
    await call('get','godowns/'+location.id,'PRO').expect(200);await call('post','godowns','PRO').send({branch_id:shops.PRO.branch.id,name:'No third',code:'THIRD'}).expect(403);
    expect(await db.planFeature.count({where:{plan_id:plans.PRO.id}})).toBe(before);
    await action('PRO',{action:'clear_limits',limit_keys:['stock_locations']}).expect(201);
  });
  it('Overrides: Starter photos enabled for one tenant without changing the plan',async()=>{
    await action('STARTER',{action:'feature',feature_code:'ITEM_IMAGES',enabled:true}).expect(201);
    await photo('STARTER',shops.STARTER.item.id).expect(201);
    expect(await db.planFeature.count({where:{plan_id:plans.STARTER.id,feature:{code:'ITEM_IMAGES'}}})).toBe(0);
    await action('STARTER',{action:'clear_feature',feature_code:'ITEM_IMAGES'}).expect(201);
    await photo('STARTER',shops.STARTER.item.id).expect(403);
  });
  it('Overrides: denying profit also prevents cost leakage through business insight snapshots',async()=>{
    await action('SMART',{action:'feature',feature_code:'PROFIT_REPORTING',enabled:false}).expect(201);
    try {for(const message of ['sale kam kyu hai','profit kam kyu hua','paisa kidhar gaya'])expect((await call('post','assistant/query','SMART').send({message}).expect(201)).body.status).toBe('FEATURE_NOT_ENTITLED');}
    finally{await action('SMART',{action:'clear_feature',feature_code:'PROFIT_REPORTING'}).expect(201);}
  });
  it('STARTER: direct bill response/detail has no paid cost or profit fields',async()=>{
    const bill=(await call('post','retail/bills').send({items:[{item_id:shops.STARTER.item.id,quantity:1,rate:10}],payment_splits:[{method:'CASH',amount:10}]}).expect(201)).body;shops.STARTER.bill=bill;
    const detail=(await call('get','retail/bills/'+bill.id).expect(200)).body;
    for(const response of [bill,detail])expect(JSON.stringify(response)).not.toMatch(/"(?:cogs_total|cost_per_base_unit|gross_profit|cost_snapshot|cost_status|net_revenue)"/);
    expect(Number(detail.grand_total)).toBe(10);
    const movements=(await call('get','inventory/movements').expect(200)).body;
    expect(movements.length).toBeGreaterThan(0);
    expect(JSON.stringify(movements)).not.toMatch(/"(?:cost_rate|value_delta|cost_status|unknown_quantity_delta)"/);
    expect(movements.some((m:any)=>Number(m.base_quantity_delta)<0)).toBe(true);
  });
  it.each(['STARTER','SMART','PRO'])('%s: import measured and unmapped tracked fields obey plan without dropping data',async(code)=>{
    const measured=await call('post','retail/imports/preview',code).field('kind','ITEMS').field('preset','GENERIC').attach('file',Buffer.from('Name,Selling Price,Selling Mode,Unit\nMeasured,20,WEIGHT,KG'),{filename:'items.csv',contentType:'text/csv'});expect(measured.status).toBe(code==='STARTER'?403:201);
    const batch=await call('post','retail/imports/preview',code).field('kind','ITEMS').field('preset','GENERIC').attach('file',Buffer.from('Name,Selling Price,Batch Number\nTracked,20,LOT1'),{filename:'batch.csv',contentType:'text/csv'});expect(batch.status).toBe(code==='STARTER'?403:400);if(code!=='STARTER')expect(batch.body.message).toContain('will not be silently discarded');
    const serial=await call('post','retail/imports/preview',code).field('kind','ITEMS').field('preset','GENERIC').attach('file',Buffer.from('Name,Selling Price,Serial Number\nTracked,20,S1'),{filename:'serial.csv',contentType:'text/csv'});expect(serial.status).toBe(code==='PRO'?400:403);
  });
  it('Downgrade safety: old images/locations/serial configuration and journals retained; new paid use blocked',async()=>{
    const s=shops.PRO,serial=await db.item.findFirstOrThrow({where:{company_id:s.company.id,track_serial:true}});
    const counts=async()=>[await db.item.count({where:{company_id:s.company.id}}),await db.attachment.count({where:{company_id:s.company.id}}),await db.stockMovement.count({where:{company_id:s.company.id}}),await db.voucher.count({where:{company_id:s.company.id}}),await db.godown.count({where:{branch:{company_id:s.company.id}}})];const before=await counts();
    await action('PRO',{action:'subscription',plan_id:plans.STARTER.id}).expect(201);
    try{
      await call('get','attachments/'+s.image.id+'/content','PRO').expect(200);await photo('PRO',s.item.id).expect(403);await call('delete','attachments/'+s.image.id,'PRO').expect(403);
      await call('get','retail/items/'+serial.id+'/options','PRO').expect(200);await call('get','godowns/'+s.extra.id,'PRO').expect(200);await item('PRO',{track_serial:true}).expect(403);expect(await counts()).toEqual(before);
    }finally{await action('PRO',{action:'subscription',plan_id:plans.PRO.id}).expect(201);}
  });
  it('PRO: five additional staff allowed, sixth creation and reactivation above capacity blocked',async()=>{
    const users=[];for(let i=0;i<5;i++)users.push((await call('post','users','PRO').send({username:'launch-staff-'+i+'-'+suffix,display_name:'Staff '+i,password}).expect(201)).body);
    await call('post','users','PRO').send({username:'launch-overflow-'+suffix,display_name:'Overflow',password}).expect(403);
    await call('patch','users/'+users[0].id+'/disable','PRO').expect(200);
    await call('post','users','PRO').send({username:'launch-replacement-'+suffix,display_name:'Replacement',password}).expect(201);
    await call('patch','users/'+users[0].id+'/enable','PRO').expect(403);
  });
  it.each([['STARTER',2],['SMART',5],['PRO',10]])('%s: active session quota is enforced and the next device is denied',async(code,limit)=>{
    const shop=shops[String(code)],auth=app.get(AuthService),now=new Date();
    const existing=await db.session.findMany({where:{user_id:shop.user.id,revoked_at:null,expires_at:{gt:now}},select:{id:true}});
    try{
      for(let i=existing.length;i<Number(limit);i++)await auth.loginUser(shop.user.id,{deviceId:randomUUID()});
      expect(await db.session.count({where:{user:{organization_id:shop.organization.id},revoked_at:null,expires_at:{gt:now}}})).toBe(limit);
      await expect(auth.loginUser(shop.user.id,{deviceId:randomUUID()})).rejects.toThrow('device limit');
    }finally{
      await db.session.updateMany({where:{user_id:shop.user.id,id:{notIn:existing.map(s=>s.id)},revoked_at:null},data:{revoked_at:new Date()}});
    }
  });
});
