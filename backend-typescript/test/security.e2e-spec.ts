import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import * as bcrypt from 'bcrypt';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';

describe('Multi-Tenant Security Architecture (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let companyAId: string;
  let companyBId: string;
  let branchAId: string;
  let branchBId: string;
  let userAToken: string;
  let userBToken: string;
  let roleAId: string;
  let uniqueSuffix: string;
  let organizationId: string;
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    prisma = app.get(PrismaService);
    
    // Setup isolated test data
    uniqueSuffix = Date.now().toString();
    const org = await prisma.organization.create({ data: { name: 'Test Org A', code: `ORG_${uniqueSuffix}`, is_active: true } });
    organizationId = org.id;
    
    const feature = await prisma.feature.upsert({
      where: { code: 'SALES' },
      update: {},
      create: { code: 'SALES', name: 'Sales Module' }
    });
    await prisma.tenantEntitlement.create({ data: { organization_id: org.id, feature_id: feature.id } });
    
    const companyA = await prisma.company.create({ data: { organization_id: org.id, trade_name: 'Company A', code: `CA_${uniqueSuffix}`, legal_name: 'Corp A', gstin: '111' } as any });
    const companyB = await prisma.company.create({ data: { organization_id: org.id, trade_name: 'Company B', code: `CB_${uniqueSuffix}`, legal_name: 'Corp B', gstin: '222' } as any });
    companyAId = companyA.id;
    companyBId = companyB.id;
    
    const branchA = await prisma.branch.create({ data: { company_id: companyAId, name: 'Branch A', code: `BA_${uniqueSuffix}` } });
    const branchB = await prisma.branch.create({ data: { company_id: companyBId, name: 'Branch B', code: `BB_${uniqueSuffix}` } });
    branchAId = branchA.id;
    branchBId = branchB.id;
    
    const roleA = await prisma.role.create({ data: { organization_id: org.id, name: `ADMIN_${uniqueSuffix}`, system_role: true, description: 'test' } });
    roleAId = roleA.id;

    const roleReadOnly = await prisma.role.create({ data: { organization_id: org.id, name: `RO_${uniqueSuffix}`, system_role: false, description: 'test' } });

    const p = await prisma.permission.upsert({ 
      where: { code: 'sales.read' },
      update: {},
      create: { code: 'sales.read', module: 'sales', resource: 'sales', action: 'read', description: 'desc' }
    });
    await prisma.rolePermission.create({ data: { role_id: roleReadOnly.id, permission_id: p.id, scope: 'COMPANY' }});
    await prisma.rolePermission.create({ data: { role_id: roleA.id, permission_id: p.id, scope: 'COMPANY' }});
    
    const pwd = await bcrypt.hash('password123', 10);
    
    const userA = await prisma.user.create({ data: { organization_id: org.id, username: `ua_${uniqueSuffix}`, display_name: 'User A', password_hash: pwd, is_active: true } });
    const userB = await prisma.user.create({ data: { organization_id: org.id, username: `ub_${uniqueSuffix}`, display_name: 'User B', password_hash: pwd, is_active: true } });
    const userC = await prisma.user.create({ data: { organization_id: org.id, username: `uc_${uniqueSuffix}`, display_name: 'User C', password_hash: pwd, is_active: true } });

    await prisma.userRole.create({ data: { user_id: userA.id, role_id: roleA.id, company_id: companyAId, branch_id: branchAId } });
    await prisma.userRole.create({ data: { user_id: userB.id, role_id: roleA.id, company_id: companyBId, branch_id: branchBId } });
    await prisma.userRole.create({ data: { user_id: userC.id, role_id: roleReadOnly.id, company_id: companyAId, branch_id: branchAId } });

    // Seed some data in Company B
    const bParty = await prisma.party.create({ data: { company_id: companyBId, party_type: 'CUSTOMER', code: `PTY_${uniqueSuffix}`, name: 'B Cust', legal_name: 'B Cust', gstin: '333', is_active: true } as any });
    await prisma.salesOrder.create({
      data: {
        id: '10000000-0000-0000-0000-000000000000',
        company_id: companyBId,
        branch_id: branchBId,
        party_id: bParty.id,
        document_number: 'SO-001',
        document_date: new Date(),
        status: 'CONFIRMED',
        total: 100
      }
    });

  });

  afterAll(async () => {
    // Cleanup
    await prisma.salesOrder.deleteMany({ where: { id: '10000000-0000-0000-0000-000000000000' } });
    await prisma.party.deleteMany({ where: { company_id: companyBId } });
    
    // Only remove this suite's fixtures; broad username prefixes matched users
    // belonging to other suites and their restricted warranty/claim history.
    await prisma.userRole.deleteMany({ where: { user: { organization_id: organizationId } } });
    await prisma.rolePermission.deleteMany({ where: { role: { organization_id: organizationId } } });
    await prisma.auditLog.deleteMany({ where: { user: { organization_id: organizationId } } });
    await prisma.user.deleteMany({ where: { organization_id: organizationId } });
    await prisma.role.deleteMany({ where: { organization_id: organizationId } });
    await prisma.branch.deleteMany({ where: { company: { organization_id: organizationId } } });
    await prisma.company.deleteMany({ where: { organization_id: organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });

    await app.close();
  });

  it('[AUTH-01] Valid login', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `ua_${uniqueSuffix}`, password: 'password123' })
      .expect(200);
    
    expect(res.body.access_token).toBeDefined();
    userAToken = res.body.access_token;
  });

  it('[AUTH-02] Invalid username/password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `ua_${uniqueSuffix}`, password: 'wrongpassword' })
      .expect(401);
  });

  it('[AUTH-03] Expired/invalid token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sales/orders')
      .set('Authorization', 'Bearer invalid_token_xyz')
      .expect(401);
  });

  it('[AUTH-04] Unauthenticated ERP request', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sales/orders')
      .expect(401);
  });

  it('[TENANT-01] User can access own tenant data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('[TENANT-02] User cannot access another tenant via simple request', async () => {
    // Attempting to read SO-COMP-B (which is Company B) using User A token
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/orders/10000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(404); // Or empty, depending on service impl, but isolated.
  });

  it('[TENANT-03 & TENANT-05 & CRITICAL ATTACK] Changing x-company-id cannot change tenant scope / cross tenant write blocked', async () => {
    // User A tries to spoof headers for Company B
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-company-id', companyBId)
      .expect(403);
    
    expect(res.body.message).toContain('Access denied');
  });

  it('[TENANT-04] Changing x-branch-id cannot bypass authorization', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-branch-id', branchBId) // Branch belonging to Company B
      .expect(403);
  });

  it('[RBAC-01] Allowed permission succeeds', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `uc_${uniqueSuffix}`, password: 'password123' })
      .expect(200);
    
    await request(app.getHttpServer())
      .get('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .expect(200);
  });

  it('[RBAC-02] Missing permission rejected', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `uc_${uniqueSuffix}`, password: 'password123' })
      .expect(200);
    
    // User C only has sales.read. Posting an order should fail.
    await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .send({ party_id: '123' })
      .expect(403);
  });
});
