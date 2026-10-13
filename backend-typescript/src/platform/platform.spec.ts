import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as bcrypt from 'bcrypt';

describe('Platform Phase 2 Tests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let testOrgId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    prisma = app.get<PrismaService>(PrismaService);
    const operator='legacy-platform-'+Date.now();const password='DisposablePlatform!521';
    const role=await prisma.platformRole.upsert({where:{name:'SUPER_ADMIN'},create:{name:'SUPER_ADMIN',system_role:true},update:{}});
    await prisma.platformUser.create({data:{username:operator,display_name:'Legacy Platform test',password_hash:await bcrypt.hash(password,10),roles:{create:{role_id:role.id}}}});
    
    // Ensure Super Admin exists
    const res = await request(app.getHttpServer())
      .post('/platform/auth/login')
      .send({
        username: operator,
        password,
      });
      
    superAdminToken = res.body.access_token;
  }, 60000);

  afterAll(async () => {
    // Cleanup provisioned tenant
    if (testOrgId) {
      // Due to Restrict onDelete, we must manually cascade test data
      const companies = await prisma.company.findMany({ where: { organization_id: testOrgId } });
      const cIds = companies.map(c => c.id);
      if (cIds.length > 0) {
        await prisma.branch.deleteMany({ where: { company_id: { in: cIds } } }).catch(() => {});
      }
      await prisma.user.deleteMany({ where: { organization_id: testOrgId } }).catch(() => {});
      await prisma.company.deleteMany({ where: { organization_id: testOrgId } }).catch(() => {});
      await prisma.organization.delete({
        where: { id: testOrgId }
      }).catch(() => {});
    }
    await app.close();
  });

  it('PROV-01: Should login as super admin', async () => {
    expect(superAdminToken).toBeDefined();
  });

  it('PROV-02: Should provision a new tenant atomically', async () => {
    const orgCode = `ORG-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/platform/admin/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        organizationName: 'Test Corp',
        organizationCode: orgCode,
        companyName: 'Test Corp LLC',
        companyCode: `COMP-${Date.now()}`,
        branchName: 'Main Branch',
        branchCode: `BR-${Date.now()}`,
        adminEmail: `admin@${orgCode}.com`,
        adminName: 'Tenant Admin',
        adminPassword: 'Password123!',
      });
      
    expect(res.status).toBe(201);
    expect(res.body.organization.code).toBe(orgCode);
    expect(res.body.company).toBeDefined();
    expect(res.body.branch).toBeDefined();
    expect(res.body.user.email).toBe(`admin@${orgCode}.com`);
    
    testOrgId = res.body.organization.id;
  });

  it('PROV-03: Should list tenants', async () => {
    const res = await request(app.getHttpServer())
      .get('/platform/admin/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`);
      
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length).toBeGreaterThan(0);
  });
  
  it('PROV-04: Should fetch tenant details including companies and branches', async () => {
    const res = await request(app.getHttpServer())
      .get(`/platform/admin/tenants/${testOrgId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testOrgId);
    expect(res.body.companies.length).toBeGreaterThan(0);
    expect(res.body.companies[0].branches.length).toBeGreaterThan(0);
  });

  it('PROV-05: Should reject tenant provisioning with duplicate code', async () => {
    const res = await request(app.getHttpServer())
      .get(`/platform/admin/tenants/${testOrgId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    const orgCode = res.body.code;

    const resFail = await request(app.getHttpServer())
      .post('/platform/admin/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        organizationName: 'Duplicate Corp',
        organizationCode: orgCode,
        companyName: 'Dup Corp LLC',
        companyCode: `COMP-DUP-${Date.now()}`,
        branchName: 'Main Branch',
        branchCode: `BR-DUP-${Date.now()}`,
        adminEmail: `admin2@${orgCode}.com`,
        adminName: 'Tenant Admin 2',
        adminPassword: 'Password123!',
      });
      
    expect(resFail.status).toBe(409); // Conflict
  });

  it('PROV-06: Unconfigured owner invitations fail clearly without returning a token', async () => {
    const res = await request(app.getHttpServer())
      .post(`/platform/admin/tenants/${testOrgId}/invite`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        email: 'new-owner@testcorp.com',
        name: 'New Owner'
      });
      
    expect(res.status).toBe(503);
    expect(res.body.token).toBeUndefined();
  });
});
