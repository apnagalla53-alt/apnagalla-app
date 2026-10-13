import { Test } from '@nestjs/testing';
import { INestApplication,RequestMethod,ValidationPipe } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomBytes,randomInt,randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { GoogleIdentityService } from '../src/auth/google-identity.service';
import { SmsOtpProvider } from '../src/auth/sms-otp.provider';
import { BUSINESS_TYPES } from '../src/auth/business-types';
import { DEFAULT_EXPENSE_CATEGORIES } from '../src/retail/expenses/categories/default-expense-categories';

describe('Google business profile: real restricted DB, trusted test-only Google identity boundary',()=>{
 let app:INestApplication,db:PrismaService,maintenance:PrismaClient,originalUrl:string,roleName:string,owner:any,other:any,profile:any,companyId:string,orgId:string;
 let smsCalls=0;const suffix=randomUUID().replaceAll('-','').slice(0,12);
 const phone=()=>String(randomInt(6000000000,9999999999));
 const devices=new Map<string,string>();
 const device=(subject:string)=>{if(!devices.has(subject))devices.set(subject,randomUUID());return devices.get(subject);};
 const endpoint=(method:'get'|'post',path:string,who=owner)=>request(app.getHttpServer())[method]('/api/v1/'+path).set('Authorization','Bearer '+who.token);
 const state=(who=owner)=>endpoint('get','auth/account/onboarding',who);
 const save=(body:any,who=owner)=>endpoint('post','auth/account/onboarding/profile',who).send(body);
 async function googleSignup(subject:string,displayName='Aamir Khan'){
  const ch=(await request(app.getHttpServer()).post('/api/v1/auth/google/signup-challenge').expect(201)).body;
  const result=(await request(app.getHttpServer()).post('/api/v1/auth/google/signup').send({challenge_id:ch.challenge_id,terms_accepted:true,credential:JSON.stringify({subject,email:subject+'@gmail.com',displayName,emailAuthoritative:true,nonce:ch.nonce}),device_id:device(subject)}).expect(200)).body;
  return {id:result.user.id,subject,token:result.access_token,result};
 }
 async function googleLogin(who:any){
  const ch=(await request(app.getHttpServer()).post('/api/v1/auth/google/challenge').expect(201)).body;
  const result=(await request(app.getHttpServer()).post('/api/v1/auth/google/login').send({challenge_id:ch.challenge_id,credential:JSON.stringify({subject:who.subject,email:who.subject+'@gmail.com',emailAuthoritative:true,nonce:ch.nonce}),device_id:device(who.subject)}).expect(200)).body;
  who.token=result.access_token;return result;
 }
 beforeAll(async()=>{
  originalUrl=process.env.DATABASE_URL!;if(!new URL(originalUrl).pathname.includes('_test'))throw Error('Disposable test DB required');
  maintenance=new PrismaClient({datasources:{db:{url:originalUrl}}});roleName='evx_onboard_'+suffix;const secret=randomBytes(32).toString('hex');
  await maintenance.$executeRawUnsafe(`CREATE ROLE "${roleName}" LOGIN PASSWORD '${secret}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
  await maintenance.$executeRawUnsafe(`GRANT "${roleName}" TO CURRENT_USER WITH INHERIT TRUE`);
  await maintenance.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${roleName}"`);
  await maintenance.$executeRawUnsafe(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO "${roleName}"`);
  await maintenance.$executeRawUnsafe(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO "${roleName}"`);
  const url=new URL(originalUrl);url.username=roleName;url.password=secret;process.env.DATABASE_URL=url.toString();
  const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(GoogleIdentityService).useValue({clientId:()=> 'test-only.apps.googleusercontent.com',verify:async(token:string)=>JSON.parse(token)}).overrideProvider(SmsOtpProvider).useValue({configured:()=>false,send:async()=>{smsCalls++;throw Error('No SMS in profile setup');}}).compile();
  app=module.createNestApplication();app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
  owner=await googleSignup('onboard-'+suffix);other=await googleSignup('other-'+suffix);
  profile={owner_name:' Aamir Owner ',name:' Shree Ganesh General Store ',mobile:phone(),business_type:'GROCERY',address:' Main Market, Khargone, Madhya Pradesh '};
 },90000);
 afterAll(async()=>{if(app)await app.close();process.env.DATABASE_URL=originalUrl;if(maintenance){if(roleName){await maintenance.$executeRawUnsafe(`DROP OWNED BY "${roleName}"`);await maintenance.$executeRawUnsafe(`DROP ROLE "${roleName}"`);}await maintenance.$disconnect();}});
 it('new Google user starts at one Business Profile screen with the verified Google name and no shop',async()=>{
  expect(owner.result.user.onboarding_state).toBe('BUSINESS_PROFILE_REQUIRED');expect(owner.result.user.display_name).toBe('Aamir Khan');expect(owner.result.tenant_context).toBeNull();
  const result=(await state().expect(200)).body;expect(result.owner_name).toBe('Aamir Khan');expect(result.business).toBeNull();expect(result.state).toBe('BUSINESS_PROFILE_REQUIRED');
  expect((await db.user.findUniqueOrThrow({where:{id:owner.id}})).organization_id).toBeNull();
 });
 it('category master covers every required group and search alias with stable unique keys',async()=>{
  const types=(await state().expect(200)).body.business_types;expect(types).toHaveLength(59);expect(new Set(types.map((t:any)=>t.code)).size).toBe(59);
  for(const q of ['grocery','medical','garments','hardware','electrical','cosmetics','mobile','sanitary','optical','other'])expect(types.some((t:any)=>(t.name+' '+t.keywords.join(' ')).toLowerCase().includes(q))).toBe(true);
  expect(types.filter((t:any)=>t.keywords.includes('hardware')).map((t:any)=>t.code)).toEqual(['HARDWARE','ELECTRICAL','TOOLS']);
  expect(types.find((t:any)=>t.code==='PHARMACY').suggested_features).toContain('BATCH_TRACKING');expect(BUSINESS_TYPES.every(t=>t[0].length<=50)).toBe(true);
 });
 it('rejects empty/invalid fields and injected ownership/verification fields before provisioning',async()=>{
  for(const changes of [{owner_name:'   '},{name:'   '},{address:'   '},{mobile:'123'},{business_type:'FAKE'},{mobileVerified:true},{company_id:randomUUID()},{latitude:4}])await save({...profile,...changes}).expect(400);
  expect(await db.userRole.count({where:{user_id:owner.id}})).toBe(0);
 });
 it('concurrent repeated profile saves reuse one business and initialize internal defaults once',async()=>{
  const responses=await Promise.all([save(profile),save(profile),save(profile)]);expect(responses.every(r=>r.status===201)).toBe(true);
  orgId=responses[0].body.business.id;companyId=responses[0].body.business.company_id;
  expect(responses.every(r=>r.body.business.id===orgId)).toBe(true);expect(responses.every(r=>r.body.state==='PLAN_REQUIRED')).toBe(true);
  expect(await db.company.count({where:{organization_id:orgId}})).toBe(1);expect(await db.branch.count({where:{company_id:companyId}})).toBe(1);
  expect(await db.godown.count({where:{branch:{company_id:companyId}}})).toBe(1);expect(await db.financialYear.count({where:{company_id:companyId}})).toBe(1);expect(await db.companyConfiguration.count({where:{company_id:companyId}})).toBe(1);
  expect(await db.tenantSubscription.count({where:{organization_id:orgId}})).toBe(1);expect(await db.userRole.count({where:{user_id:owner.id}})).toBe(1);
  expect((await db.expenseCategory.findMany({where:{company_id:companyId},orderBy:{created_at:'asc'}})).map(c=>c.name).sort()).toEqual([...DEFAULT_EXPENSE_CATEGORIES].sort());
 });
 it('trims fields, stores normalized unverified contact and never invokes OTP or grants an SMS identity',async()=>{
  const user=await db.user.findUniqueOrThrow({where:{id:owner.id}}),company=await db.company.findUniqueOrThrow({where:{id:companyId}});
  expect(user.display_name).toBe('Aamir Owner');expect(user.phone).toBe('+91'+profile.mobile);expect(user.phone_e164).toBeNull();expect(user.phone_verified_at).toBeNull();expect(company.phone).toBe(user.phone);expect(company.trade_name).toBe('Shree Ganesh General Store');expect(company.address).toBe('Main Market, Khargone, Madhya Pradesh');expect(company.country).toBe('India');expect(smsCalls).toBe(0);
  expect((await state().expect(200)).body.mobile_verified).toBe(false);expect((await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:orgId}})).status).toBe('PENDING');
 });
 it('another account cannot reuse a normalized/legacy contact, with no silent merging',async()=>{
  const r=await save({...profile,owner_name:'Another owner',name:'Another shop',mobile:'+91 '+profile.mobile},other).expect(409);expect(r.body.code).toBe('MOBILE_ALREADY_LINKED');
  expect((await db.user.findUniqueOrThrow({where:{id:other.id}})).organization_id).toBeNull();expect(await db.user.count({where:{google_subject:owner.subject}})).toBe(1);
 });
 it('one contested number cannot provision two different Google accounts concurrently',async()=>{
  const a=await googleSignup('race-a-'+suffix),b=await googleSignup('race-b-'+suffix),mobile=phone();
  const results=await Promise.all([save({...profile,mobile,name:'Race A'},a),save({...profile,mobile,name:'Race B'},b)]);
  expect(results.map(r=>r.status).sort()).toEqual([201,409]);expect(await db.user.count({where:{phone:'+91'+mobile}})).toBe(1);
 });
 it('edit and browser retry preserve identities, settings and prior category defaults',async()=>{
  profile={...profile,owner_name:'Aamir corrected',name:'Corrected shop',business_type:'OTHER',custom_business_type:'Horse accessories',latitude:22.2,longitude:75.4};
  const result=(await save(profile).expect(201)).body;expect(result.business.id).toBe(orgId);expect(result.data.custom_business_type).toBe('Horse accessories');expect(result.data.profile.owner_name).toBe('Aamir corrected');expect(result.data.location).toEqual({latitude:22.2,longitude:75.4});
  expect(await db.expenseCategory.count({where:{company_id:companyId}})).toBe(10);expect(await db.branch.count({where:{company_id:companyId}})).toBe(1);
 });
 it('resume and repeated Google signup reuse the same account at Subscription',async()=>{
  const login=await googleLogin(owner);expect(login.user.onboarding_state).toBe('PLAN_REQUIRED');expect(login.user.id).toBe(owner.id);
  const repeat=await googleSignup(owner.subject);owner.token=repeat.token;expect(repeat.id).toBe(owner.id);expect(repeat.result.user.display_name).toBe('Aamir corrected');expect(repeat.result.user.onboarding_state).toBe('PLAN_REQUIRED');
  expect(await db.user.count({where:{google_subject:owner.subject}})).toBe(1);expect(await db.company.count({where:{organization_id:orgId}})).toBe(1);
 });
 it('prices and keys are server authoritative, Smart request proceeds to migration without paid access',async()=>{
  expect((await state().expect(200)).body.plans.map((p:any)=>[p.code,Number(p.monthly_price)])).toEqual([['STARTER',75],['SMART',120],['PRO',210]]);
  const r=(await endpoint('post','auth/account/onboarding/plan').send({choice:'REQUEST',plan_code:'SMART'}).expect(201)).body;
  expect(r.state).toBe('MIGRATION_OFFERED');expect(r.access_active).toBe(false);expect(r.subscription.status).toBe('PENDING');
  await endpoint('get','retail/items').set('X-Company-Id',companyId).expect(403);
  expect(await db.subscriptionPayment.count({where:{organization_id:orgId}})).toBe(0);
 });
 it('a pending migration choice is durable but never opens Retail before real activation',async()=>{
  const r=(await endpoint('post','auth/account/onboarding/migration').send({choice:'FRESH'}).expect(201)).body;expect(r.state).toBe('ACCESS_PENDING');expect(r.access_token).toBeUndefined();
  const login=await googleLogin(owner);expect(login.user.onboarding_state).toBe('ACCESS_PENDING');expect((await state().expect(200)).body.data.migration_choice).toBe('FRESH');
 });
 it('can change pending plan/profile/data choices without duplicate subscriptions or invented entitlement',async()=>{
  await endpoint('post','auth/account/onboarding/plan').send({choice:'REQUEST',plan_code:'PRO'}).expect(201);
  await save({...profile,business_type:'PHARMACY'}).expect(201);
  const result=(await endpoint('post','auth/account/onboarding/migration').send({choice:'IMPORT'}).expect(201)).body;expect(result.state).toBe('ACCESS_PENDING');
  expect(result.data.suggested_features).toContain('BATCH_TRACKING');expect(await db.tenantEntitlement.count({where:{organization_id:orgId}})).toBe(0);
  expect(await db.tenantSubscription.count({where:{organization_id:orgId}})).toBe(1);expect(await db.expenseCategory.count({where:{company_id:companyId}})).toBe(10);
 });
 it('configured Smart trial and Start Fresh reach a usable shop once, returning Google skips setup',async()=>{
  const fresh=await googleSignup('fresh-'+suffix);
  const configured={trial_enabled:true,trial_days:7,trial_plan:'SMART',permanent_delete_enabled:false,retention_days:null,delete_requires_backup:true};
  await db.platformSetting.upsert({where:{key:'ACCOUNT_POLICY'},create:{key:'ACCOUNT_POLICY',value:configured},update:{value:configured}});
  const result=(await save({...profile,mobile:phone(),business_type:'GROCERY',name:'Fresh trial shop'},fresh).expect(201)).body;
  await endpoint('post','auth/account/onboarding/plan',fresh).send({choice:'TRIAL'}).expect(201);
  const entered=(await endpoint('post','auth/account/onboarding/migration',fresh).send({choice:'FRESH'}).expect(201)).body;expect(entered.next).toBe('/retail/home');expect(entered.user.onboarding_state).toBe('READY');
  await request(app.getHttpServer()).get('/api/v1/retail/items').set('Authorization','Bearer '+entered.access_token).set('X-Company-Id',result.business.company_id).expect(200);
  const returning=await googleLogin(fresh);expect(returning.user.onboarding_state).toBe('READY');expect(returning.tenant_context.company_id).toBe(result.business.company_id);
  await save({...profile,mobile:phone()},fresh).expect(400);expect(await db.company.count({where:{organization_id:result.business.id}})).toBe(1);
 });
 it('real manual activation resumes saved Import choice and opens the existing importer',async()=>{
  await db.organization.update({where:{id:orgId},data:{is_active:true,status:'ACTIVE'}});await db.tenantSubscription.update({where:{organization_id:orgId},data:{status:'COMPLIMENTARY',complimentary:true,expires_at:new Date(Date.now()+86400000)}});
  const r=(await state().expect(200)).body;expect(r.state).toBe('READY');expect(r.tenant_context.company_id).toBe(companyId);
  const entered=(await endpoint('post','auth/account/onboarding/migration').send({choice:'IMPORT'}).expect(201)).body;expect(entered.next).toBe('/retail/more/import');expect(entered.user.onboarding_state).toBe('READY');
  expect(await db.company.count({where:{organization_id:orgId}})).toBe(1);
 });
});
