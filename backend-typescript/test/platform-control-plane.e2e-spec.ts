import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, RequestMethod } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Platform control plane (real database and HTTP)', () => {
  let app: INestApplication; let db: PrismaService; let platformToken: string; let tenantToken: string;
  let tenant: any; let other: any; let actor: string; let planId: string; let paymentId: string;
  const suffix=Date.now().toString(); const password='TestOnly!Platform091';
  const api=(method: 'get'|'post'|'patch', route:string, token=platformToken) => request(app.getHttpServer())[method]('/api/v1/'+route).set('Authorization','Bearer '+token);
  const shop=(route:string, token=tenantToken) => api('get','retail/'+route,token).set('X-Company-Id',tenant.company.id).set('X-Branch-Id',tenant.branch.id).set('X-Financial-Year-Id',tenant.financialYear.id);
  const action=(body:object) => api('post','platform/admin/tenants/'+tenant.organization.id+'/actions').send({reason:'Control plane E2E verification',...body});
  beforeAll(async()=>{
    app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();
    app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
    await app.init();db=app.get(PrismaService);
    const role=await db.platformRole.upsert({where:{name:'SUPER_ADMIN'},create:{name:'SUPER_ADMIN',system_role:true},update:{}});
    const user=await db.platformUser.create({data:{username:'platform-test-'+suffix,display_name:'Platform E2E',password_hash:await bcrypt.hash(password,10),roles:{create:{role_id:role.id}}}});
    actor=user.id;
  });
  afterAll(async()=>{await app.close();});
  it('separate platform login persists a revocable session and strips credentials',async()=>{
    const res=await request(app.getHttpServer()).post('/api/v1/platform/auth/login').send({username:'platform-test-'+suffix,password}).expect(200);
    platformToken=res.body.access_token;expect(res.body.user.password_hash).toBeUndefined();
    expect(await db.platformSession.count({where:{user_id:actor,revoked_at:null}})).toBe(1);
    await api('get','platform/admin/dashboard').expect(200);
    await api('get','retail/items').expect(401);
  });
  it('provisions a shop with owner, FY, unit, stock location, accounts and subscription atomically',async()=>{
    const provision=async(name:string)=> (await api('post','platform/admin/tenants').send({organizationName:name,adminName:'Shop Owner',adminEmail:name+'@test.invalid',adminPassword:password,phone:'9876543210',city:'Pune',state:'Maharashtra',userLimit:4,deviceLimit:3}).expect(201)).body;
    tenant=await provision('shop'+suffix);other=await provision('other'+suffix);
    expect(tenant.user.password_hash).toBeUndefined();expect(tenant.godown.id).toBeTruthy();expect(tenant.financialYear.id).toBeTruthy();
    const accounts=await db.ledgerAccount.findMany({where:{company_id:tenant.company.id},select:{code:true}});
    expect(accounts.map(account=>account.code)).toEqual(expect.arrayContaining(['CASH_IN_HAND','DEFAULT_BANK','SALES_REVENUE','OUTPUT_GST','OWNER_CAPITAL']));
    expect(await db.expenseCategory.count({where:{company_id:tenant.company.id,ledger_id:{not:null}}})).toBe(10);
    const detail=await api('get','platform/admin/tenants/'+tenant.organization.id).expect(200);
    expect(detail.body.public_id).toMatch(/^EVX-\d{5,}$/);expect(detail.body.subscription.status).toBe('ACTIVE');expect(detail.body.effective.features.find((f:any)=>f.code==='RETAIL_POS').enabled).toBe(true);
    const login=await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:tenant.user.username,password}).expect(200);
    tenantToken=login.body.access_token;expect(login.body.tenant_context.company_id).toBe(tenant.company.id);
    await shop('items').expect(200);await api('get','platform/admin/tenants',tenantToken).expect(401);
  });
  it('rejects foreign company, branch, FY, users and sessions without leaking data',async()=>{
    await shop('items').set('X-Company-Id',other.company.id).expect(403);
    await shop('items').set('X-Branch-Id',other.branch.id).expect(403);
    await shop('items').set('X-Financial-Year-Id',other.financialYear.id).expect(403);
    await action({action:'disable_user',user_id:other.user.id}).expect(404);
    const foreign=await db.session.create({data:{user_id:other.user.id,expires_at:new Date(Date.now()+60000)}});
    await action({action:'revoke_session',session_id:foreign.id}).expect(404);
    expect((await db.user.findUnique({where:{id:other.user.id}}))?.is_active).toBe(true);
  });
  it('audits feature overrides, returns to plan defaults and enforces global rollout',async()=>{
    await action({action:'feature',feature_code:'RETAIL_POS',enabled:false}).expect(201);await shop('items').expect(403);
    await action({action:'clear_feature',feature_code:'RETAIL_POS'}).expect(201);await shop('items').expect(200);
    await api('post','platform/admin/features').send({code:'E2E_BETA_'+suffix,name:'Beta fixture',is_active:true,rollout_mode:'OFF',rollout_percent:100,beta_tenants:[]}).expect(201);
    await action({action:'feature',feature_code:'E2E_BETA_'+suffix,enabled:true}).expect(201);
    let detail=(await api('get','platform/admin/tenants/'+tenant.organization.id).expect(200)).body;
    expect(detail.effective.features.find((f:any)=>f.code==='E2E_BETA_'+suffix).enabled).toBe(false);
    await api('post','platform/admin/features').send({code:'E2E_BETA_'+suffix,name:'Beta fixture',is_active:true,rollout_mode:'BETA',rollout_percent:100,beta_tenants:[tenant.organization.id]}).expect(201);
    detail=(await api('get','platform/admin/tenants/'+tenant.organization.id).expect(200)).body;expect(detail.effective.features.find((f:any)=>f.code==='E2E_BETA_'+suffix).enabled).toBe(true);
  });
  it('changes plans, expiry, complimentary access and effective limits with validation',async()=>{
    const plan=(await api('get','platform/admin/plans').expect(200)).body.find((p:any)=>p.code==='SMART');planId=plan.id;
    await action({action:'subscription',plan_id:plan.id,free_days:10,complimentary:true}).expect(201);
    const detail=await action({action:'limits',limits:{users:2,devices:2}}).expect(201);expect(detail.body.effective.limits.users).toBe(2);expect(detail.body.subscription.complimentary).toBe(true);
    await action({action:'limits',limits:{users:-1}}).expect(400);await action({action:'limits',limits:{shell_command:1}}).expect(400);
    await action({action:'subscription',expires_at:'2000-01-01'}).expect(201);await shop('items').expect(200);
    await api('post','retail/items',tenantToken).set('X-Company-Id',tenant.company.id).send({name:'Expired write',selling_price:10}).expect(403);
    await action({action:'subscription',expires_at:new Date(Date.now()+30*86400_000).toISOString(),complimentary:false}).expect(201);await shop('items').expect(200);
  });
  it('records real subscription receipts, blocks duplicates and over-refunds; records separate platform expense',async()=>{
    const body={organization_id:tenant.organization.id,amount:1000,tax:180,discount:100,status:'PAID',method:'BANK',reference:'BANK-E2E-'+suffix,period_months:1,paid_at:new Date().toISOString()};
    const payment=await api('post','platform/admin/payments').send(body).expect(201);paymentId=payment.body.id;
    await api('post','platform/admin/payments').send(body).expect(400);
    await api('post','platform/admin/payments/'+paymentId+'/refund').send({amount:2000,reason:'Invalid over refund'}).expect(400);
    await api('post','platform/admin/payments/'+paymentId+'/refund').send({amount:80,reason:'Actual refund fixture'}).expect(201);
    await api('post','platform/admin/expenses').send({category:'SERVER',amount:500,expense_date:'2026-10-06',method:'BANK',note:'Platform cost fixture'}).expect(201);
    const dashboard=(await api('get','platform/admin/dashboard').expect(200)).body;
    expect(dashboard.subscription_revenue).toBeGreaterThanOrEqual(1000);expect(dashboard.refunds).toBeGreaterThanOrEqual(80);
    expect(dashboard.mrr).toBeGreaterThanOrEqual(820);expect(dashboard.arr).toBeCloseTo(dashboard.mrr*12,0);
    expect(dashboard.platform_expenses).toBeGreaterThanOrEqual(500);expect(dashboard.metric_notes.churn).toContain('Unavailable');
    expect(await db.expense.count({where:{company_id:tenant.company.id}})).toBe(0);
  });
  it('enforces effective device limits and replaces a session on the same browser device',async()=>{
    const deviceA=randomUUID(),deviceB=randomUUID();
    const login=(device_id:string)=>request(app.getHttpServer()).post('/api/v1/auth/login').send({username:tenant.user.username,password,device_id});
    await login(deviceA).expect(200);await login(deviceB).expect(403);
    const repeat=await login(deviceA).expect(200);tenantToken=repeat.body.access_token;await shop('items').expect(200);
    expect(await db.session.count({where:{user_id:tenant.user.id,revoked_at:null}})).toBe(2);
    await action({action:'logout'}).expect(201);tenantToken=(await login(deviceB).expect(200)).body.access_token;
  });
  it('shows measured database health and explicit provider limitations; no backup paths exposed',async()=>{
    const infra=(await api('get','platform/admin/infrastructure').expect(200)).body;
    expect(infra.database.status).toBe('CONNECTED');expect(infra.database.size_bytes).toBeGreaterThan(0);expect(infra.provider_metrics.status).toBe('UNAVAILABLE');
    const backups=(await api('get','platform/admin/backups').expect(200)).body;
    for(const b of backups.backups)expect(b.storage_key).toBeUndefined();
    await api('post','platform/admin/backups/00000000-0000-0000-0000-000000000000/restore').send({target_database:'evolix_trade_dev',reason:'Invalid live target',confirmation:'RESTORE evolix_trade_dev'}).expect(400);
  });
  it('creates support window, internal note, announcement and audit trail without impersonating',async()=>{
    const support=await action({action:'support_start'}).expect(201);expect(support.body.support_sessions).toHaveLength(1);
    await action({action:'support_end',support_id:support.body.support_sessions[0].id}).expect(201);
    await action({action:'note',reason:'Verified owner support request'}).expect(201);
    await api('post','platform/admin/announcements').send({title:'Scheduled maintenance',message:'Test announcement',audience:'SELECTED',tenant_ids:[tenant.organization.id],starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+86400_000).toISOString(),priority:1}).expect(201);
    const audit=(await api('get','platform/admin/audit').expect(200)).body;
    expect(audit.some((r:any)=>r.action==='TENANT_PROVISION'&&r.resource_id===tenant.organization.id)).toBe(true);
    expect(audit.some((r:any)=>r.action==='TENANT_SUPPORT_START')).toBe(true);expect(JSON.stringify(audit)).not.toContain('password_hash');
  });
  it('disabling users, revoking sessions and suspending tenants block previously issued tokens',async()=>{
    const signIn=async()=>{const res=await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:tenant.user.username,password}).expect(200);tenantToken=res.body.access_token;};
    await action({action:'disable_user',user_id:tenant.user.id}).expect(201);await shop('items').expect(401);
    await action({action:'enable_user',user_id:tenant.user.id}).expect(201);await signIn();
    const session=await db.session.findFirstOrThrow({where:{user_id:tenant.user.id,revoked_at:null},orderBy:{issued_at:'desc'}});
    await action({action:'revoke_session',session_id:session.id}).expect(201);await shop('items').expect(401);await signIn();
    await action({action:'status',status:'SUSPENDED'}).expect(201);await shop('items').expect(401);
    await action({action:'status',status:'ACTIVE'}).expect(201);await signIn();await shop('items').expect(200);
    await action({action:'logout'}).expect(201);await shop('items').expect(401);
  });
  it('rejects invalid payloads and logout invalidates platform session',async()=>{
    await action({action:'status',status:'SQL',password_hash:'secret'}).expect(400);
    await api('post','platform/auth/logout').send({}).expect(201);await api('get','platform/admin/dashboard').expect(401);
  });
});
