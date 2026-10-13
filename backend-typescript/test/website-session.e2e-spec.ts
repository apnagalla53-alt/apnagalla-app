import { Test } from '@nestjs/testing';
import { RequestMethod, ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { GoogleIdentityService } from '../src/auth/google-identity.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';

describe('Website and software share verified accounts and sessions',()=>{
  let app:INestApplication,db:PrismaService,shop:any,cookie:string,csrf:string,google:any;
  const original={...process.env},website='https://apnagalla.test',software='https://app.apnagalla.test',suffix=randomUUID(),password='WebsiteTest!'+randomUUID();
  const auth=(path:string,origin=website)=>request(app.getHttpServer()).post('/api/v1/auth/'+path).set('Origin',origin).set('X-Requested-With','XMLHttpRequest');
  const session=(origin=software)=>request(app.getHttpServer()).get('/api/v1/auth/session').set('Origin',origin).set('Cookie',cookie);
  beforeAll(async()=>{
    Object.assign(process.env,{NODE_ENV:'test',GOOGLE_CLIENT_ID:'website-test.apps.googleusercontent.com',FRONTEND_ORIGIN:software,WEBSITE_ORIGIN:website,RETAIL_COOKIE_DOMAIN:'.apnagalla.test'});
    const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(GoogleIdentityService).useValue({clientId:()=>process.env.GOOGLE_CLIENT_ID,verify:async(raw:string)=>JSON.parse(raw)}).compile();
    app=module.createNestApplication({logger:false});app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
    shop=await app.get(TenantProvisioningService).provisionTenant({organizationName:'Disposable Website '+suffix,adminName:'Website Owner',adminEmail:'website-'+suffix+'@test.invalid',adminPassword:password});
    // Test the actual production cookie attributes after safe test-only initialization.
    process.env.NODE_ENV='production';
  },60000);
  afterAll(async()=>{await app?.close();for(const key of ['NODE_ENV','GOOGLE_CLIENT_ID','FRONTEND_ORIGIN','WEBSITE_ORIGIN','RETAIL_COOKIE_DOMAIN']){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}});
  it('anonymous visitors cannot obtain a profile/session',async()=>{await request(app.getHttpServer()).get('/api/v1/auth/session').expect(401);});
  it('website password login sets a secure shared HttpOnly cookie without returning a JWT',async()=>{
    const result=await auth('login').send({username:shop.user.username,password}).expect(200);
    expect(result.body.access_token).toBeUndefined();expect(result.body.session_mode).toBe('cookie');
    const cookies=result.headers['set-cookie'] as unknown as string[];const sessionCookie=cookies.find(c=>c.startsWith('evolix_shop_session='))!;
    expect(sessionCookie).toContain('Domain=.apnagalla.test');expect(sessionCookie).toContain('Secure');expect(sessionCookie).toContain('HttpOnly');expect(sessionCookie).toContain('SameSite=Strict');cookie=sessionCookie.split(';')[0];csrf=result.body.csrf_token;
  });
  it('software reconstructs the same owner/business/year without another login or device slot',async()=>{
    const before=await db.session.count({where:{user_id:shop.user.id}}),result=(await session().expect(200)).body;
    expect(result.user.id).toBe(shop.user.id);expect(result.tenant_context.company_id).toBe(shop.company.id);expect(result.tenant_context.financial_year_id).toBe(shop.financialYear.id);expect(result.user.role).toBe('TENANT_ADMIN');expect(result.csrf_token).toBe(csrf);expect(result.access_token).toBeUndefined();expect(await db.session.count({where:{user_id:shop.user.id}})).toBe(before);
  });
  it('profile restoration ignores attacker-provided tenant headers',async()=>{const result=(await session().set('X-Company-Id',randomUUID()).set('X-Branch-Id',randomUUID()).expect(200)).body;expect(result.tenant_context.company_id).toBe(shop.company.id);});
  it('untrusted origins cannot perform login and cannot use the cookie for writes',async()=>{
    await auth('login','https://evil.apnagalla.test').send({username:shop.user.username,password}).expect(403);
    await auth('logout','https://evil.apnagalla.test').set('Cookie',cookie).set('X-CSRF-Token',csrf).expect(403);
  });
  it('missing CSRF proof cannot log the shared session out',async()=>{await auth('logout',software).set('Cookie',cookie).expect(403);await session().expect(200);});
  it('temporary-password accounts can restore identity for password change without getting onboarding access',async()=>{
    await db.user.update({where:{id:shop.user.id},data:{must_change_password:true}});
    try{expect((await session().expect(200)).body.user.must_change_password).toBe(true);await request(app.getHttpServer()).get('/api/v1/auth/account/onboarding').set('Cookie',cookie).expect(403);}finally{await db.user.update({where:{id:shop.user.id},data:{must_change_password:false}});}
  });
  it('Google signup on the website persists one pending account in the software database',async()=>{
    const challenge=(await auth('google/signup-challenge').send({}).expect(201)).body;
    const result=await auth('google/signup').send({challenge_id:challenge.challenge_id,credential:JSON.stringify({subject:'shared-'+suffix,email:'google-'+suffix+'@gmail.com',emailAuthoritative:true,displayName:'Shared Google Owner',nonce:challenge.nonce}),terms_accepted:true}).expect(200);
    google={id:result.body.user.id,subject:'shared-'+suffix,email:'google-'+suffix+'@gmail.com'};expect((await db.user.findUniqueOrThrow({where:{id:google.id}})).google_subject).toBe(google.subject);expect(result.body.user.onboarding_state).toBe('BUSINESS_PROFILE_REQUIRED');expect(result.body.access_token).toBeUndefined();
    const shared=(result.headers['set-cookie'] as unknown as string[]).find(c=>c.startsWith('evolix_shop_session='))!.split(';')[0];const profile=await request(app.getHttpServer()).get('/api/v1/auth/session').set('Origin',software).set('Cookie',shared).expect(200);expect(profile.body.user.id).toBe(google.id);expect(profile.body.tenant_context).toBeNull();
  });
  it('the same Google account signs into the software without another account',async()=>{
    const challenge=(await auth('google/challenge',software).send({}).expect(201)).body;
    const result=await auth('google/login',software).send({challenge_id:challenge.challenge_id,credential:JSON.stringify({...google,nonce:challenge.nonce,emailAuthoritative:true})}).expect(200);expect(result.body.user.id).toBe(google.id);expect(await db.user.count({where:{google_subject:google.subject}})).toBe(1);
  });
  it('Google signup still requires accepted terms',async()=>{
    const challenge=(await auth('google/signup-challenge').send({}).expect(201)).body;
    await auth('google/signup').send({challenge_id:challenge.challenge_id,credential:JSON.stringify({subject:'no-terms-'+suffix,email:'none-'+suffix+'@gmail.com',nonce:challenge.nonce}),terms_accepted:false}).expect(400);
  });
  it('logout from the software clears the shared cookie and revokes website access',async()=>{
    const result=await auth('logout',software).set('Cookie',cookie).set('X-CSRF-Token',csrf).expect(201);
    expect((result.headers['set-cookie'] as unknown as string[]).find(c=>c.startsWith('evolix_shop_session='))).toContain('Domain=.apnagalla.test');await session(website).expect(401);
  });
  it('the central API also supports host-only cookies with both trusted website/app origins',async()=>{
    const saved=process.env.RETAIL_COOKIE_DOMAIN;delete process.env.RETAIL_COOKIE_DOMAIN;
    try {
      const result=await auth('login').send({username:shop.user.username,password}).expect(200);
      const current=(result.headers['set-cookie'] as unknown as string[]).find(c=>c.startsWith('evolix_shop_session='))!;
      expect(current).not.toContain('Domain=');expect(current).toContain('HttpOnly');expect(current).toContain('Secure');
      const existing=current.split(';')[0];
      for(const origin of [website,software])expect((await request(app.getHttpServer()).get('/api/v1/auth/session').set('Cookie',existing).set('Origin',origin).expect(200)).body.user.id).toBe(shop.user.id);
      await auth('logout',software).set('Cookie',existing).set('X-CSRF-Token',result.body.csrf_token).expect(201);
    }finally{process.env.RETAIL_COOKIE_DOMAIN=saved;}
  });
});
