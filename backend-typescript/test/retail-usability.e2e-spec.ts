import { Test } from '@nestjs/testing';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { businessDate } from '../src/common/business-date';

describe('Retail usability: staff phone/password/session, credit calendar and scoped alerts',()=>{
  let app:INestApplication,db:PrismaService,A:any,B:any,token:string,other:string,staff:any,staffToken:string,cookie:string,customer:any,bill:any;
  const suffix=randomUUID(),ownerPassword='DisposableOwner!'+randomUUID(),phone='9'+String(Date.now()).slice(-9),date=businessDate();
  const call=(method:string,path:string,shop=A,t=token)=>(request(app.getHttpServer()) as any)[method]('/api/v1/'+path).set('Authorization','Bearer '+t).set('X-Company-Id',shop.company.id).set('X-Branch-Id',shop.branch.id).set('X-Financial-Year-Id',shop.financialYear.id);
  beforeAll(async()=>{
    app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication({logger:false});app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));await app.init();db=app.get(PrismaService);
    const planId=(await db.plan.findUniqueOrThrow({where:{code:'PRO'}})).id;
    for(const [name,set] of [['A',(s:any)=>A=s],['B',(s:any)=>B=s]] as const)set(await app.get(TenantProvisioningService).provisionTenant({planId,organizationName:'Usability '+name+suffix,adminEmail:'usability-'+name+suffix+'@test.invalid',adminName:'Disposable Owner',adminPassword:ownerPassword}));
    token=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:A.user.username,password:ownerPassword}).expect(200)).body.access_token;
    other=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:B.user.username,password:ownerPassword}).expect(200)).body.access_token;
  },60000);
  afterAll(async()=>{await app?.close();});
  it('requires a mobile number and rejects staff passwords shorter than 8',async()=>{
    await call('post','users').send({display_name:'Bad staff',phone,password:'short'}).expect(400);
    await call('post','users').send({display_name:'Bad phone',phone:'123',password:'abcdefgh'}).expect(400);
  });
  it('creates staff using phone as username and accepts a plain 8-character password',async()=>{
    staff=(await call('post','users').send({display_name:'Phone Staff',phone:'+91 '+phone,username:'discarded-custom-name',password:'abcdefgh'}).expect(201)).body;
    expect(staff.username).toBe(phone);expect(staff.phone).toBe(phone);expect(staff.password_hash).toBeUndefined();
    const first=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:phone,password:'abcdefgh'}).expect(200)).body;
    expect(first.user.must_change_password).toBe(true);expect(first.user.password_min_length).toBe(8);
    await call('post','auth/password/change',A,first.access_token).send({current_password:'abcdefgh',password:'ijklmnop'}).expect(201);
    await call('get','retail/items',A,first.access_token).expect(401);
  });
  it('persists staff cookie/JWT for 30 days and reconstructs the same account on reopen',async()=>{
    const login=await request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin',process.env.FRONTEND_ORIGIN!).set('X-Requested-With','XMLHttpRequest').send({username:phone,password:'ijklmnop',device_id:randomUUID()}).expect(200);
    const shopCookie=(login.headers['set-cookie'] as unknown as string[]).find(c=>c.startsWith('evolix_shop_session='))!;
    expect(shopCookie).toContain('HttpOnly');expect(Number(/Max-Age=(\d+)/.exec(shopCookie)![1])).toBeGreaterThan(29*86400);
    cookie=shopCookie.split(';')[0];staffToken=decodeURIComponent(cookie.slice(cookie.indexOf('=')+1));
    const jwt=app.get(JwtService).decode(staffToken);expect(jwt.exp-jwt.iat).toBe(30*86400);
    const persisted=(await request(app.getHttpServer()).get('/api/v1/auth/session').set('Cookie',cookie).expect(200)).body;
    expect(persisted.user.id).toBe(staff.id);expect(persisted.tenant_context.company_id).toBe(A.company.id);expect(persisted.user.password_min_length).toBe(8);
  });
  it('preserves owner password strength and 1-day sessions',async()=>{
    const before=(await db.user.findUniqueOrThrow({where:{id:A.user.id}})).password_hash;
    await call('post','auth/password/change').send({current_password:ownerPassword,password:'abcdefgh'}).expect(400);
    expect((await db.user.findUniqueOrThrow({where:{id:A.user.id}})).password_hash).toBe(before);
    const jwt=app.get(JwtService).decode(token);expect(jwt.exp-jwt.iat).toBe(86400);
  });
  it('allows unambiguous legacy staff phone login without renaming the saved account',async()=>{
    await db.user.update({where:{id:staff.id},data:{username:'legacy-staff-'+suffix}});
    const login=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:'+91'+phone,password:'ijklmnop'}).expect(200)).body;
    expect(login.user.id).toBe(staff.id);expect(login.user.username).toBe('legacy-staff-'+suffix);
    await db.session.updateMany({where:{user_id:staff.id,id:{not:app.get(JwtService).decode(staffToken).sid}},data:{revoked_at:new Date()}});
  });
  it('refuses ambiguous legacy phone aliases across businesses',async()=>{
    const second=(await call('post','users',B,other).send({display_name:'Other shop staff',phone:'8'+phone.slice(1),password:'qrstuvwx'}).expect(201)).body;
    await db.user.update({where:{id:second.id},data:{phone}});
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:'+91'+phone,password:'ijklmnop'}).expect(401);
    await call('patch','users/'+second.id+'/disable',B,other).send({}).expect(200);
  });
  it('shows every new Udhar bill on its sale date even without a due date',async()=>{
    customer=(await call('post','retail/customers').send({name:'Credit Customer',credit_allowed:true}).expect(201)).body;
    bill=(await call('post','retail/bills/amount-sale').send({amount:180,payment_method:'UDHAR',customer_id:customer.id,date}).expect(201)).body;
    // Older/imported Udhar can have no collection promise, unlike today's
    // amount-sale default. Reproduce that persisted case only in this test DB.
    await db.salesInvoice.update({where:{id:bill.id},data:{due_date:null}});
    const calendar=(await call('get','retail/calendar?month='+date.slice(0,7)).expect(200)).body;
    const row=calendar.credit_sales.find((r:any)=>r.id===bill.id);expect(row.date.slice(0,10)).toBe(date);expect(row.credit_amount).toBe(180);expect(Number(row.outstanding_amount)).toBe(180);expect(row.party.name).toBe('Credit Customer');
    expect(calendar.receivables.some((r:any)=>r.id===bill.id)).toBe(false);
    const foreign=(await call('get','retail/calendar?month='+date.slice(0,7),B,other).expect(200)).body;expect(foreign.credit_sales.some((r:any)=>r.id===bill.id)).toBe(false);
  });
  it('keeps original credit visible after collection while removing paid reminders',async()=>{
    await call('patch','retail/calendar/receivables/'+bill.id).send({title:'Collection',date}).expect(200);
    await call('post','retail/customers/'+customer.id+'/payments').send({amount:180,payment_method:'CASH',date}).expect(201);
    const calendar=(await call('get','retail/calendar?month='+date.slice(0,7)).expect(200)).body;
    const row=calendar.credit_sales.find((r:any)=>r.id===bill.id);expect(row.credit_amount).toBe(180);expect(Number(row.outstanding_amount)).toBe(0);expect(calendar.receivables.some((r:any)=>r.id===bill.id)).toBe(false);
  });
  it('produces stable notification IDs without exposing other shops or privileged staff updates',async()=>{
    const notificationItem=(await call('post','retail/items').send({name:'Notification test item',selling_price:90,inventory_tracking:false}).expect(201)).body;
    await call('post','retail/items/removal').send({ids:[notificationItem.id],action:'ARCHIVE'}).expect(201);
    await call('post','retail/needs').send({name:'Notification buying need',quantity:2}).expect(201);
    const first=(await call('get','retail/account/notifications').expect(200)).body.rows;
    expect(first.some((r:any)=>r.path==='/retail/bills/'+bill.id)).toBe(true);
    expect(first.some((r:any)=>r.body==='Item added'&&r.tone==='success')).toBe(true);
    expect(first.some((r:any)=>r.body==='Item archived'&&r.tone==='danger')).toBe(true);
    expect(first.some((r:any)=>r.path==='/retail/needs'&&r.body.startsWith('Notification buying need'))).toBe(true);
    const again=(await call('get','retail/account/notifications').expect(200)).body.rows;expect(again.map((r:any)=>r.id)).toEqual(first.map((r:any)=>r.id));
    expect((await call('get','retail/account/notifications',B,other).expect(200)).body.rows.some((r:any)=>r.path==='/retail/bills/'+bill.id)).toBe(false);
    const staffFeed=(await call('get','retail/account/notifications',A,staffToken).expect(200)).body.rows;
    expect(staffFeed.some((r:any)=>r.path==='/retail/more/staff')).toBe(false);expect(staffFeed.some((r:any)=>r.path==='/retail/bills/'+bill.id)).toBe(true);
  });
  it('still revokes persistent staff sessions immediately when the administrator disables access',async()=>{
    await call('patch','users/'+staff.id+'/disable').send({}).expect(200);
    await request(app.getHttpServer()).get('/api/v1/auth/session').set('Cookie',cookie).expect(401);
    await call('get','retail/account/notifications',A,staffToken).expect(401);
  });
  it('does not use the account endpoint to bypass shop suspension',async()=>{
    const previous=(await db.organization.findUniqueOrThrow({where:{id:B.organization.id}})).status;
    await db.organization.update({where:{id:B.organization.id},data:{status:'SUSPENDED'}});
    await call('get','retail/account/notifications',B,other).expect(403);
    await db.organization.update({where:{id:B.organization.id},data:{status:previous}});
  });
});
