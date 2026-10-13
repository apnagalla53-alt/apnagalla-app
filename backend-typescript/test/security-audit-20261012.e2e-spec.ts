import { Test } from '@nestjs/testing';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { validateEnvironment } from '../src/common/environment';

describe('Independent security audit 2026-10-12 — safeguards and confirmed findings', () => {
  let app: INestApplication, db: PrismaService, shop: any, other: any, token: string, item: any;
  const password = 'Disposable!Security765', suffix = randomUUID();
  const marker = '<img src="data:," onerror="window.__evolixSecurityAuditMarker=true">';
  const call = (method: 'get'|'post'|'patch'|'delete', path: string) => request(app.getHttpServer())[method]('/api/v1/'+path)
    .set('Authorization','Bearer '+token).set('X-Company-Id',shop.company.id)
    .set('X-Branch-Id',shop.branch.id).set('X-Financial-Year-Id',shop.financialYear.id);
  beforeAll(async()=>{
    app=(await Test.createTestingModule({imports:[AppModule]}).compile()).createNestApplication();
    app.setGlobalPrefix('api/v1',{exclude:[{path:'api/v1/{*path}',method:RequestMethod.ALL}]});
    app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
    await app.init(); db=app.get(PrismaService);
    const provision=app.get(TenantProvisioningService);
    shop=await provision.provisionTenant({organizationName:'Security probe A '+suffix,adminEmail:suffix+'@a.invalid',adminName:'Audit owner',adminPassword:password});
    other=await provision.provisionTenant({organizationName:'Security probe B '+suffix,adminEmail:suffix+'@b.invalid',adminName:'Audit owner B',adminPassword:password});
    token=(await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:shop.user.username,password}).expect(200)).body.access_token;
    item=(await call('post','retail/items').send({name:'Security probe '+marker,selling_price:10}).expect(201)).body;
  },60000);
  afterAll(async()=>{if(app)await app.close();});

  it('saved item names are escaped in script-free label HTML',async()=>{
    const r=await call('post','barcodes/labels/product').send({item_id:item.id,quantity:1}).expect(201);
    expect(r.body.printable_html).not.toContain(marker);
    expect(r.body.printable_html).toContain('&lt;img');
    if(process.env.EVOLIX_AUDIT_HTML)writeFileSync(process.env.EVOLIX_AUDIT_HTML,r.body.printable_html);
  });
  it('SQL-shaped search remains data; it does not expose another tenant item',async()=>{
    const foreign=await db.item.create({data:{company_id:other.company.id,item_type:'PRODUCT',name:'Other security item',sku:'SEC-'+suffix,primary_unit_id:other.unit?.id|| (await db.unit.findFirstOrThrow({where:{company_id:other.company.id}})).id}});
    const r=await call('get','retail/items').query({search:"' OR 1=1; --"}).expect(200);
    expect(r.body).toEqual([]);
    const own=await call('get','retail/items').query({search:'Security probe'}).expect(200);
    expect(own.body.some((i:any)=>i.id===foreign.id)).toBe(false);
  });
  it('rejects a cookie-only CSRF-style write without a bearer authorization header',async()=>{
    await request(app.getHttpServer()).post('/api/v1/retail/items').set('Origin','https://attacker.invalid')
      .set('Cookie','session='+token).send({name:'CSRF probe',selling_price:1}).expect(401);
    expect(await db.item.count({where:{company_id:shop.company.id,name:'CSRF probe'}})).toBe(0);
  });
  it('rejects unsigned JWTs and tenant credentials on platform APIs',async()=>{
    const fake=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:shop.user.id,is_platform:true})).toString('base64url')+'.';
    await request(app.getHttpServer()).get('/api/v1/retail/items').set('Authorization','Bearer '+fake).expect(401);
    await request(app.getHttpServer()).get('/api/v1/platform/admin/tenants').set('Authorization','Bearer '+token).expect(401);
  });
  it('rejects SVG disguised as PNG and a foreign entity attachment',async()=>{
    const ownNeed=await db.needList.create({data:{organization_id:shop.organization.id,company_id:shop.company.id,branch_id:shop.branch.id,name:'Own security need'}});
    await call('post','attachments').field('entityType','NEED').field('entityId',ownNeed.id).field('category','NEED_PHOTO')
      .attach('file',Buffer.from('<svg onload="alert(1)"/>'),{filename:'fake.png',contentType:'image/png'}).expect(400);
    const foreign=await db.needList.create({data:{organization_id:other.organization.id,company_id:other.company.id,branch_id:other.branch.id,name:'Other need'}});
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC','base64');
    await call('post','attachments').field('entityType','NEED').field('entityId',foreign.id).field('category','NEED_PHOTO')
      .attach('file',png,{filename:'safe.png',contentType:'image/png'}).expect(404);
  });
  it('fresh tenant owner password uses bcrypt cost 12 and no plaintext response',async()=>{
    const owner=await db.user.findUniqueOrThrow({where:{id:shop.user.id}});
    expect(owner.password_hash).toMatch(/^\$2[aby]\$12\$/);
    const r=await request(app.getHttpServer()).post('/api/v1/auth/login').send({username:shop.user.username,password}).expect(200);
    expect(r.body.user.password_hash).toBeUndefined();expect(r.body.user.password).toBeUndefined();
  });
  it('production JWT validation rejects repeated-character keys',()=>{
    const config={NODE_ENV:'production',DATABASE_URL:'postgresql://operator:placeholder@database.invalid/app',
      JWT_SECRET:'a'.repeat(48),PLATFORM_JWT_SECRET:'b'.repeat(48),FRONTEND_ORIGIN:'https://shop.invalid',API_ORIGIN:'https://api.invalid',
      STORAGE_PROVIDER:'local',UPLOAD_DIR:'/private/uploads',BACKUP_PROVIDER:'none',APP_VERSION:'audit-only',MFA_ENCRYPTION_KEY:Buffer.from(Array.from({length:32},(_,n)=>n+1)).toString('base64')};
    expect(()=>validateEnvironment(config)).toThrow(/JWT_SECRET/);
  });
  it('business tables have PostgreSQL row-level security policies',async()=>{
    const tables=await db.$queryRaw<any[]>`SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('items','parties','sales_invoices','attachments')`;
    expect(tables).toHaveLength(4);expect(tables.every(t=>t.relrowsecurity)).toBe(true);
  });
});
