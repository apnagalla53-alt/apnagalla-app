import { Test } from '@nestjs/testing';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { GoogleIdentityService } from '../src/auth/google-identity.service';

describe('Google owner to Super Admin access approval: real isolated HTTP/DB, test Google identity boundary',()=>{
  let app:INestApplication, db:PrismaService, admin:string, owner:any, paidOwner:any, foreignOwner:any, smart:any;
  const suffix=randomUUID(), password='DisposableApproval!'+randomUUID();
  const api=(method:string,path:string,token?:string)=>(request(app.getHttpServer()) as any)[method]('/api/v1/'+path).set('Authorization',token?'Bearer '+token:'');
  const platform=(method:string,path:string)=>api(method,'platform/admin/'+path,admin);
  const account=(method:string,path:string,who=owner)=>api(method,'auth/account/onboarding'+path,who.token);
  const approval=(who=owner,extra:any={})=>platform('post','tenants/'+who.org+'/actions').send({action:'approve_access',plan_id:smart.id,free_days:30,complimentary:true,reason:'Approve disposable test access',...extra});
  const newOwner=async(name:string)=>{
    const challenge=(await api('post','auth/google/signup-challenge').send({}).expect(201)).body;
    const response=(await api('post','auth/google/signup').send({challenge_id:challenge.challenge_id,credential:JSON.stringify({subject:name+suffix,email:name+suffix+'@gmail.com',emailAuthoritative:true,nonce:challenge.nonce}),terms_accepted:true}).expect(200)).body;
    const who={id:response.user.id,token:response.access_token,org:''};
    const business=(await account('post','/profile',who).send({owner_name:'Disposable Google owner',mobile:'9'+String(Math.floor(Math.random()*1e9)).padStart(9,'0'),name:name+suffix,business_type:'GROCERY',address:'Disposable test address'}).expect(201)).body;
    who.org=business.business.id;
    await account('post','/plan',who).send({choice:'REQUEST',plan_code:'SMART'}).expect(201);
    return who;
  };
  beforeAll(async()=>{
    const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(GoogleIdentityService).useValue({clientId:()=> 'test-only.apps.googleusercontent.com',verify:async(c:string)=>JSON.parse(c)}).compile();
    app=module.createNestApplication();app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
    const role=await db.platformRole.upsert({where:{name:'SUPER_ADMIN'},create:{name:'SUPER_ADMIN',system_role:true},update:{}});
    const user=await db.platformUser.create({data:{username:'Approval operator '+suffix,display_name:'Disposable approval operator',password_hash:await bcrypt.hash(password,10),roles:{create:{role_id:role.id}}}});
    admin=(await api('post','platform/auth/login').send({username:user.username,password}).expect(200)).body.access_token;
    smart=await db.plan.findUniqueOrThrow({where:{code:'SMART'}});
    owner=await newOwner('approval-free-');paidOwner=await newOwner('approval-paid-');foreignOwner=await newOwner('approval-other-');
  },60000);
  afterAll(async()=>{await app?.close();});
  it('exposes the requested Smart plan and a paginated pending access queue',async()=>{
    const pending=(await platform('get','tenants?access=pending&search=approval-&limit=2').expect(200)).body;
    expect(pending).toHaveLength(2);expect(pending.every((t:any)=>t.subscription.status==='PENDING')).toBe(true);
    const detail=(await platform('get','tenants/'+owner.org).expect(200)).body;
    expect(detail.users[0].onboarding_data.requested_plan_code).toBe('SMART');
    expect(detail.users[0].password_hash).toBeUndefined();expect(detail.users[0].google_subject).toBeUndefined();
    expect(await db.subscriptionPayment.count({where:{organization_id:owner.org}})).toBe(0);
  });
  it('organization activation alone cannot grant a pending subscription access',async()=>{
    await platform('post','tenants/'+owner.org+'/actions').send({action:'status',status:'ACTIVE',reason:'Prove status alone is insufficient'}).expect(201);
    expect((await account('get','').expect(200)).body.state).toBe('ACCESS_PENDING');
    expect((await account('post','/migration').send({choice:'FRESH'}).expect(201)).body.state).toBe('ACCESS_PENDING');
  });
  it('requires platform authorization and an audit reason for approval',async()=>{
    const body={action:'approve_access',plan_id:smart.id,free_days:30,complimentary:true,reason:'Unauthorized attempt'};
    await api('post','platform/admin/tenants/'+owner.org+'/actions',owner.token).send(body).expect(401);
    await api('post','platform/admin/tenants/'+owner.org+'/actions').send(body).expect(401);
    await approval(owner,{reason:''}).expect(400);await approval(owner,{reason:'   '}).expect(400);await approval(owner,{free_days:0}).expect(400);await approval(owner,{plan_id:randomUUID()}).expect(404);
    expect((await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:owner.org}})).status).toBe('PENDING');
  });
  it('grants the chosen plan and duration once under concurrent double clicks, without fake payment',async()=>{
    const results=await Promise.all([approval(),approval()]);expect(results.map(r=>r.status).sort()).toEqual([201,400]);
    const org=await db.organization.findUniqueOrThrow({where:{id:owner.org},include:{subscription:true}});
    expect(org.plan_id).toBe(smart.id);expect(org.status).toBe('ACTIVE');expect(org.is_active).toBe(true);
    expect(org.subscription?.status).toBe('COMPLIMENTARY');expect(org.subscription?.complimentary).toBe(true);
    expect(org.subscription!.expires_at.getTime()-org.subscription!.start_date.getTime()).toBe(30*86400000);
    expect(await db.subscriptionPayment.count({where:{organization_id:owner.org}})).toBe(0);
    expect(await db.platformAuditLog.count({where:{resource_id:owner.org,action:'TENANT_APPROVE_ACCESS'}})).toBe(1);
  });
  it('the existing Google session can check activation, complete onboarding and enter Retail',async()=>{
    expect((await account('get','').expect(200)).body.state).toBe('READY');
    const login=(await account('post','/migration').send({choice:'FRESH'}).expect(201)).body;
    expect(login.next).toBe('/retail/home');expect(login.tenant_context.company_id).toBeTruthy();expect(login.user.onboarding_state).toBe('READY');
    await api('get','retail/items',login.access_token).set('X-Company-Id',login.tenant_context.company_id).set('X-Branch-Id',login.tenant_context.branch_id).expect(200);
    const expiry=(await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:owner.org}})).expires_at;
    await approval().expect(400);expect((await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:owner.org}})).expires_at).toEqual(expiry);
  });
  it('paid access rejects absent, unpaid, refunded and cross-tenant receipts',async()=>{
    await approval(paidOwner,{complimentary:false}).expect(400);
    const base={amount:Number(smart.monthly_price),tax:0,discount:0,status:'PAID',method:'MANUAL',period_months:1,paid_at:new Date().toISOString()};
    const foreign=(await platform('post','payments').send({...base,organization_id:foreignOwner.org,reference:'Foreign '+suffix}).expect(201)).body;
    await approval(paidOwner,{complimentary:false,payment_id:foreign.id}).expect(400);
    const pending=(await platform('post','payments').send({...base,organization_id:paidOwner.org,status:'PENDING',reference:'Pending '+suffix}).expect(201)).body;
    await approval(paidOwner,{complimentary:false,payment_id:pending.id}).expect(400);
    const refunded=(await platform('post','payments').send({...base,organization_id:paidOwner.org,reference:'Refunded '+suffix}).expect(201)).body;
    await platform('post','payments/'+refunded.id+'/refund').send({amount:1,reason:'Disposable partial refund'}).expect(201);
    await approval(paidOwner,{complimentary:false,payment_id:refunded.id}).expect(400);
  });
  it('verified manual paid receipt grants only its tenant and records an explicit payment link in the audit',async()=>{
    const payment=(await platform('post','payments').send({organization_id:paidOwner.org,amount:Number(smart.monthly_price),tax:0,discount:0,status:'PAID',method:'BANK',reference:'Verified '+suffix,period_months:1,paid_at:new Date().toISOString()}).expect(201)).body;
    await approval(paidOwner,{complimentary:false,payment_id:payment.id,free_days:365}).expect(400);
    await approval(paidOwner,{complimentary:false,payment_id:payment.id}).expect(201);
    expect((await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:paidOwner.org}}))).toMatchObject({status:'ACTIVE',complimentary:false});
    expect((await db.tenantSubscription.findUniqueOrThrow({where:{organization_id:foreignOwner.org}})).status).toBe('PENDING');
    const audit=await db.platformAuditLog.findFirstOrThrow({where:{resource_id:paidOwner.org,action:'TENANT_APPROVE_ACCESS'}});
    expect(JSON.parse(audit.details!).request.payment_id).toBe(payment.id);
  });
  it('archived shops cannot bypass access approval safety',async()=>{
    await db.organization.update({where:{id:foreignOwner.org},data:{archived_at:new Date()}});
    await approval(foreignOwner).expect(400);
  });
});
