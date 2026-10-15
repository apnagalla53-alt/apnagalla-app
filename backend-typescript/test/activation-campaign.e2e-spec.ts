import { Test } from '@nestjs/testing';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { GoogleIdentityService } from '../src/auth/google-identity.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { requestDatabaseScope } from '../src/database/request-scope';

describe('Website account → shop → automatic activation request → audited trial',()=>{
 let app:INestApplication,db:PrismaService,maintenance:PrismaClient,original:string,roleName:string,admin:string,owner:any,other:any,campaign:any,smart:any;
 const suffix=randomUUID().slice(0,8);
 const api=(method:'get'|'post'|'patch',path:string,token='')=>request(app.getHttpServer())[method]('/api/v1/'+path).set('Authorization',token?'Bearer '+token:'');
 const platform=(method:'get'|'post'|'patch',path:string)=>api(method,'platform/admin/'+path,admin);
 const account=(method:'get'|'post',path:string,who=owner)=>api(method,'auth/account/onboarding'+path,who.token);
 const campaignInput=(patch:any={})=>({code:'DEMO-'+suffix,name:'Synthetic launch demo',enabled:true,plan_code:'SMART',trial_days:30,max_redemptions:null,starts_at:'2020-01-01',ends_at:null,reason:'Synthetic campaign verification',...patch});
 const createCampaign=async(patch:any={})=>(await platform('post','activation-campaigns').send(campaignInput(patch)).expect(201)).body;
 async function signup(label:string,setup=true){
  const challenge=(await api('post','auth/google/signup-challenge').send({}).expect(201)).body;
  const response=(await api('post','auth/google/signup').send({challenge_id:challenge.challenge_id,credential:JSON.stringify({subject:label+suffix,email:label+suffix+'@gmail.com',emailAuthoritative:true,nonce:challenge.nonce}),terms_accepted:true}).expect(200)).body;
  const who={id:response.user.id,token:response.access_token,org:'',company:''};
  if(setup){const r=(await account('post','/profile',who).send({owner_name:'Synthetic owner',name:label+' demo shop',mobile:String(randomInt(6000000000,9999999999)),business_type:'GROCERY',address:'Synthetic address only'}).expect(201)).body;who.org=r.business.id;who.company=r.business.company_id;expect(r.state).toBe('ACCESS_PENDING');}
  return who;
 }
 beforeAll(async()=>{
  original=process.env.DATABASE_URL!;const checked=new URL(original);if(!['localhost','127.0.0.1'].includes(checked.hostname)||!checked.pathname.endsWith('_test'))throw Error('Dedicated local _test database required');
  maintenance=new PrismaClient({datasources:{db:{url:original}}});roleName='evx_activation_'+suffix;const password=randomBytes(32).toString('hex');
  await maintenance.$executeRawUnsafe(`CREATE ROLE "${roleName}" LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
  await maintenance.$executeRawUnsafe(`GRANT "${roleName}" TO CURRENT_USER WITH INHERIT TRUE`);
  await maintenance.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${roleName}"`);
  await maintenance.$executeRawUnsafe(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO "${roleName}"`);
  await maintenance.$executeRawUnsafe(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO "${roleName}"`);
  checked.username=roleName;checked.password=password;process.env.DATABASE_URL=checked.toString();
  const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(GoogleIdentityService).useValue({clientId:()=> 'test-only.apps.googleusercontent.com',verify:async(c:string)=>JSON.parse(c)}).compile();
  app=module.createNestApplication();app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
  const role=await db.platformRole.upsert({where:{name:'SUPER_ADMIN'},create:{name:'SUPER_ADMIN',system_role:true},update:{}}),secret='DisposableOnly!'+randomUUID();
  const user=await db.platformUser.create({data:{username:'campaign-test-'+suffix,display_name:'Disposable campaign administrator',password_hash:await bcrypt.hash(secret,10),roles:{create:{role_id:role.id}}}});
  admin=(await api('post','platform/auth/login').send({username:user.username,password:secret}).expect(200)).body.access_token;
  smart=await db.plan.findUniqueOrThrow({where:{code:'SMART'}});owner=await signup('first-');other=await signup('other-');campaign=await createCampaign();
 },90000);
 afterAll(async()=>{await app?.close();process.env.DATABASE_URL=original;if(maintenance){if(roleName){await maintenance.$executeRawUnsafe(`DROP OWNED BY "${roleName}"`);await maintenance.$executeRawUnsafe(`DROP ROLE "${roleName}"`);}await maintenance.$disconnect();}});
 it('shop setup submits one request; reload and concurrent retries never submit duplicates',async()=>{
  const requests=await Promise.all([account('post','/activation-request'),account('post','/activation-request'),account('post','/activation-request')]);expect(requests.every(r=>r.status===201)).toBe(true);
  expect(await db.auditLog.count({where:{company_id:owner.company,action:'PLAN_ACTIVATION_REQUESTED'}})).toBe(1);
  const state=(await account('get','').expect(200)).body;expect(state.data.activation_requested_at).toBeTruthy();expect(state.access_active).toBe(false);expect(state.subscription.status).toBe('PENDING');
  const pending=(await platform('get','tenants?access=pending&search=demo&limit=50').expect(200)).body;expect(pending.some((r:any)=>r.id===owner.org)).toBe(true);
  await api('get','retail/items',owner.token).set('X-Company-Id',owner.company).expect(403);
 });
 it('a customer and an unauthenticated caller cannot create or list campaigns',async()=>{
  await api('get','platform/admin/activation-campaigns',owner.token).expect(401);await api('post','platform/admin/activation-campaigns',owner.token).send(campaignInput()).expect(401);await api('get','platform/admin/activation-campaigns').expect(401);
 });
 it('codes require a completed owner profile and reject injected duration/tenant/plan',async()=>{
  const fresh=await signup('unconfigured-',false);await account('post','/activation-code',fresh).send({code:campaign.code}).expect(403);
  for(const extra of [{trial_days:365},{organization_id:other.org},{plan_code:'PRO'}])await account('post','/activation-code').send({code:campaign.code,...extra}).expect(400);
  await api('post','auth/account/onboarding/activation-code').send({code:campaign.code}).expect(401);
 });
 it('trial days, audit reason, dates, plan and unique code are server validated',async()=>{
  for(const extra of [{trial_days:0},{trial_days:61},{reason:' '},{plan_code:'ALL'},{ends_at:'2019-01-01'},{max_redemptions:0}])await platform('post','activation-campaigns').send(campaignInput({code:'BAD-'+randomUUID().slice(0,8),...extra})).expect(400);
  await platform('post','activation-campaigns').send(campaignInput()).expect(409);
 });
 it('disabled, future, expired and unknown codes grant no access',async()=>{
  const inactive=await createCampaign({code:'OFF-'+suffix,enabled:false}),future=await createCampaign({code:'FUT-'+suffix,starts_at:'2099-01-01'}),expired=await createCampaign({code:'OLD-'+suffix,ends_at:'2021-01-01'});
  for(const code of [inactive.code,future.code,expired.code,'UNKNOWN-'+suffix])await account('post','/activation-code',other).send({code}).expect(400);
  expect((await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:other.org}})).status).toBe('PENDING');
 });
 it('concurrent redemption grants exactly 30 Smart days, one redemption and no payments',async()=>{
  const results=await Promise.all([account('post','/activation-code').send({code:campaign.code.toLowerCase()}),account('post','/activation-code').send({code:campaign.code})]);expect(results.every(r=>r.status===201)).toBe(true);
  expect(results.every(r=>r.body.access_active&&r.body.state==='MIGRATION_OFFERED')).toBe(true);
  const sub=await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:owner.org}});expect(sub.status).toBe('TRIAL');expect(sub.complimentary).toBe(true);expect(sub.expires_at.getTime()-sub.start_date.getTime()).toBe(30*86400000);
  expect((await db.organization.findUniqueOrThrow({where:{id:owner.org}})).plan_id).toBe(smart.id);
  expect(await db.activationRedemption.count({where:{organization_id:owner.org}})).toBe(1);expect(await db.subscriptionPayment.count({where:{organization_id:owner.org}})).toBe(0);expect(await db.auditLog.count({where:{company_id:owner.company,action:'CAMPAIGN_TRIAL_STARTED'}})).toBe(1);
 });
 it('alternate codes cannot extend a used trial; campaign edits leave earlier grants unchanged',async()=>{
  const expiry=(await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:owner.org}})).expires_at;
  const second=await createCampaign({code:'TWO-'+suffix});await account('post','/activation-code').send({code:second.code}).expect(409);
  await platform('patch','activation-campaigns/'+campaign.id).send(campaignInput({trial_days:60})).expect(200);
  expect((await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:owner.org}})).expires_at).toEqual(expiry);
 });
 it('two shops racing the final available code produce only one trial',async()=>{
  const limited=await createCampaign({code:'LAST-'+suffix,max_redemptions:1}),a=await signup('limit-a-'),b=await signup('limit-b-');
  const responses=await Promise.all([account('post','/activation-code',a).send({code:limited.code}),account('post','/activation-code',b).send({code:limited.code})]);expect(responses.map(r=>r.status).sort()).toEqual([201,400]);
  expect(await db.activationRedemption.count({where:{campaign_id:limited.id}})).toBe(1);
 });
 it('the platform administrator grants 60 free days without inventing revenue',async()=>{
  await platform('post','tenants/'+other.org+'/actions').send({action:'approve_access',plan_id:smart.id,free_days:60,complimentary:true,reason:'Two-month synthetic demo'}).expect(201);
  const sub=await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:other.org}});expect(sub.expires_at.getTime()-sub.start_date.getTime()).toBe(60*86400000);expect(sub.status).toBe('COMPLIMENTARY');expect(await db.subscriptionPayment.count({where:{organization_id:other.org}})).toBe(0);
  await account('post','/activation-code',other).send({code:campaign.code}).expect(400);
  expect((await account('get','',other).expect(200)).body.state).toBe('MIGRATION_OFFERED');
 });
 it('approved access opens a new empty shop; trial expiry still blocks billing',async()=>{
  const result=(await account('post','/migration').send({choice:'FRESH'}).expect(201)).body;expect(result.next).toBe('/retail/home');expect(result.tenant_context.company_id).toBe(owner.company);
  await api('get','retail/items',result.access_token).set('X-Company-Id',owner.company).expect(200);
  expect(await db.item.count({where:{company_id:owner.company}})).toBe(0);
  await db.tenantSubscription.update({where:{organization_id:owner.org},data:{expires_at:new Date(Date.now()-1000)}});
  await api('post','retail/items',result.access_token).set('X-Company-Id',owner.company).send({name:'Expired trial item',unit:'PCS',selling_price:1}).expect(403);
 });
 it('blocked/archived shops cannot regain access with a code',async()=>{
  const blocked=await signup('blocked-');await db.organization.update({where:{id:blocked.org},data:{archived_at:new Date()}});await account('post','/activation-code',blocked).send({code:campaign.code}).expect(403);
 });
 it('customer referral codes retain tracking and do not silently activate the shop',async()=>{
  const referrer=await app.get(TenantProvisioningService).provisionTenant({organizationName:'Synthetic referrer '+suffix,adminName:'Synthetic referrer',adminEmail:'referrer'+suffix+'@example.invalid',adminPassword:'Disposable!'+randomUUID()});
  const code=(await app.get((await import('../src/auth/referral.service')).ReferralService).ownerSummary(referrer.user.id,referrer.organization.id)).code;
  const invited=await signup('invited-');const response=(await account('post','/activation-code',invited).send({code}).expect(201)).body;
  expect(response.code_result.kind).toBe('REFERRAL');expect(response.access_active).toBe(false);expect(await db.referralAttribution.count({where:{referred_user_id:invited.id,referred_organization_id:invited.org}})).toBe(1);
 });
 it('raw unverified/tenant database scope cannot read activation campaign records',async()=>{
  for(const scope of [{kind:'unverified' as const},{kind:'tenant' as const,companyId:other.company}]){
   const count=await requestDatabaseScope.run(scope,()=>db.activationCampaign.count());expect(count).toBe(0);
  }
 });
 it('code guessing is limited per authenticated account',async()=>{
  const guessing=await signup('guessing-');
  for(let attempt=0;attempt<10;attempt++)await account('post','/activation-code',guessing).send({code:'INVALID-GUESS'}).expect(400);
  await account('post','/activation-code',guessing).send({code:campaign.code}).expect(429);
  expect((await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:guessing.org}})).status).toBe('PENDING');
 });
});
