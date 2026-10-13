import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';

describe('Account portability, deletion request and publishing boundaries',()=>{
  let app:INestApplication,db:PrismaService,a:any,b:any,token:string,platformToken:string;
  const suffix=Date.now(),password='AccountTestOnly!839';
  const call=(method:'get'|'post',path:string,company=a.company.id)=>request(app.getHttpServer())[method](path).set('Authorization','Bearer '+token).set('X-Company-Id',company).set('X-Branch-Id',a.branch.id);
  beforeAll(async()=>{
    app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
    const provision=app.get(TenantProvisioningService);
    a=await provision.provisionTenant({planId:(await db.plan.findUniqueOrThrow({where:{code:'PRO'}})).id,organizationName:'Account A '+suffix,adminName:'Owner A',adminEmail:'account-a-'+suffix+'@test.invalid',adminPassword:password});
    b=await provision.provisionTenant({organizationName:'Account B '+suffix,adminName:'Owner B',adminEmail:'account-b-'+suffix+'@test.invalid',adminPassword:password});
    token=(await request(app.getHttpServer()).post('/auth/login').send({username:a.user.username,password}).expect(200)).body.access_token;
    const role=await db.platformRole.upsert({where:{name:'SUPER_ADMIN'},update:{},create:{name:'SUPER_ADMIN'}});
    const platform=await db.platformUser.create({data:{username:'publishing-'+suffix,display_name:'Publisher',password_hash:await bcrypt.hash(password,10),roles:{create:{role_id:role.id}}}});
    platformToken=(await request(app.getHttpServer()).post('/platform/auth/login').send({username:platform.username,password}).expect(200)).body.access_token;
  });
  afterAll(async()=>{await app.close();});
  it('exposes safe public publishing placeholders',async()=>{
    const r=await request(app.getHttpServer()).get('/public/app-information').expect(200);
    expect(r.body.developer_name).toBe('EVOLIX Studio');expect(r.body.published).toBe(false);expect(r.body).not.toHaveProperty('DATABASE_URL');
  });
  it('owner sees only their profile/business and real provider status',async()=>{
    const r=await call('get','/api/v1/retail/account').expect(200);
    expect(r.body.business.id).toBe(a.company.id);expect(r.body.profile.username).toBe(a.user.username);
    expect(r.body.profile.password_hash).toBeUndefined();expect(r.body.profile.google_subject).toBeUndefined();expect(r.body.backup.configured).toBe(false);
  });
  it('rejects cross-company account access',async()=>{await call('get','/api/v1/retail/account',b.company.id).expect(403);});
  it('streams a complete tenant export without credentials or foreign records',async()=>{
    await db.retailGstSequence.create({data:{company_id:a.company.id,financial_year:'2026-2027',last_number:2}});
    await db.retailGstSequence.create({data:{company_id:b.company.id,financial_year:'2026-2027',last_number:9}});
    const r=await call('get','/api/v1/retail/account/export').expect(200);
    const rows=r.text.trim().split('\n').map(line=>JSON.parse(line));
    expect(rows.at(-1)).toEqual({complete:true});
    expect(rows.some(row=>row.resource==='company'&&row.record.id===a.company.id)).toBe(true);
    expect(rows.filter(row=>row.resource==='retailGstSequence').map(row=>row.record)).toEqual([{company_id:a.company.id,financial_year:'2026-2027',last_number:2}]);
    expect(r.text).not.toContain(b.company.id);expect(r.text).not.toMatch(/password_hash|token_hash|storage_key|google_subject/);
  });
  it('concurrent deletion request retries produce one pending request without deleting the business',async()=>{
    const results=await Promise.all([1,2].map(()=>call('post','/api/v1/retail/account/privacy-requests').send({type:'DELETE_ACCOUNT'}).expect(201)));
    expect(results[0].body.id).toBe(results[1].body.id);expect(results[0].body.status).toBe('PENDING');
    expect(await db.company.count({where:{id:a.company.id}})).toBe(1);
    const list=await call('get','/api/v1/retail/account/privacy-requests').expect(200);expect(list.body).toHaveLength(1);
  });
  it('rejects ownership substitution and Platform publishing by a Retail owner',async()=>{
    await call('post','/api/v1/retail/account/privacy-requests').send({type:'DELETE_ACCOUNT',company_id:b.company.id}).expect(403);
    await call('post','/platform/admin/publishing').send({developer_name:'Attacker',policies_approved:true,reason:'Forbidden mutation'}).expect(401);
    await call('get','/platform/admin/publishing/privacy-requests').expect(401);
  });
  it('publishing save is validated and audited by persisted Super Admin',async()=>{
    const original=(await db.platformSetting.findUnique({where:{key:'APP_PUBLISHING'}}))?.value;
    try{
      const r=await request(app.getHttpServer()).post('/platform/admin/publishing').set('Authorization','Bearer '+platformToken).send({developer_name:'EVOLIX Studio',website:'https://evolix-studio.in',policies_approved:false,reason:'Publishing boundary test'}).expect(201);
      expect(r.body.reason).toBeUndefined();expect(await db.platformAuditLog.count({where:{action:'APP_PUBLISHING_UPDATE'}})).toBeGreaterThan(0);
      await request(app.getHttpServer()).post('/platform/admin/publishing').set('Authorization','Bearer '+platformToken).send({developer_name:'EVOLIX Studio',website:'javascript:alert(1)',policies_approved:true,reason:'Invalid website'}).expect(400);
    }finally{if(original)await db.platformSetting.update({where:{key:'APP_PUBLISHING'},data:{value:original}});else await db.platformSetting.deleteMany({where:{key:'APP_PUBLISHING'}});}
  });
  it('expired subscriptions retain access to account export and deletion requests',async()=>{
    await db.tenantSubscription.update({where:{organization_id:a.organization.id},data:{expires_at:new Date(Date.now()-86400000)}});
    await call('get','/api/v1/retail/account').expect(200);
    const exportResult=await call('get','/api/v1/retail/account/export').expect(200);expect(exportResult.text).toContain('"complete":true');
    await call('post','/api/v1/retail/account/privacy-requests').send({type:'DELETE_ACCOUNT'}).expect(201);
    await call('get','/api/v1/retail/items').expect(200);
    await call('post','/api/v1/retail/items').send({name:'Expired write',selling_price:1}).expect(403);
  });
});
