import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';

describe('Expenses (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let orgId: string;
  let compAId: string;
  let compBId: string;
  let branchId: string;
  let userAId: string;
  let userBId: string;
  let tokenA: string;
  let tokenB: string;
  let financialYearId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    
    prisma = app.get(PrismaService);
    
    // Test Setup
    orgId = uuidv4();
    await prisma.organization.create({ data: { id: orgId, name: 'Exp Org', code: `EXP-ORG-${Date.now()}` }});
    const expenseFeature=await prisma.feature.findUniqueOrThrow({where:{code:'EXPENSES'}});await prisma.tenantEntitlement.create({data:{organization_id:orgId,feature_id:expenseFeature.id,is_enabled:true}});
    
    const compA = await prisma.company.create({ data: { organization_id: orgId, legal_name: 'Exp Comp A', trade_name: 'Exp Comp A', code: `EXP-CA-${Date.now()}` }});
    compAId = compA.id;
    
    const compB = await prisma.company.create({ data: { organization_id: orgId, legal_name: 'Exp Comp B', trade_name: 'Exp Comp B', code: `EXP-CB-${Date.now()}` }});
    compBId = compB.id;
    
    const branch = await prisma.branch.create({ data: { company_id: compAId, name: 'Exp Branch', code: `EXP-BR-${Date.now()}` }});
    branchId = branch.id;
    
    const roleA = await prisma.role.create({ data: { organization_id: orgId, name: `ADMIN-${Date.now()}` }});
    const expensePermission=await prisma.permission.upsert({where:{code:'accounting.write'},update:{},create:{code:'accounting.write',module:'accounting',resource:'expenses',action:'write'}});
    await prisma.rolePermission.create({data:{role_id:roleA.id,permission_id:expensePermission.id}});
    const bcrypt = require('bcrypt');
    const hash = bcrypt.hashSync('password', 10);
    const userAName = `exp_a_${Date.now()}`;
    await prisma.user.create({
      data: {
        id: uuidv4(), organization_id: orgId, username: userAName, display_name: 'Exp A', password_hash: hash, is_active: true,
        roles: { create: { role_id: roleA.id, company_id: compAId, branch_id: branchId } }
      }
    });
    const userA = await prisma.user.findFirst({ where: { username: userAName }});
    userAId = userA!.id;

    const authRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: userAName, password: 'password' });
    tokenA = authRes.body?.access_token || 'fake';

    const fyRes = await prisma.financialYear.create({
      data: {
        company_id: compAId,
        start_date: new Date(Date.UTC(new Date().getUTCFullYear() - 1, 3, 1)),
        end_date: new Date(Date.UTC(new Date().getUTCFullYear() + 1, 2, 31)),
        label: 'FY 24-25'
      }
    });
    financialYearId = fyRes.id;
    
    const cashLedger = await prisma.ledgerAccount.create({ data: { company_id: compAId, branch_id: branchId, code: `CSH-${Date.now()}`, name: 'Cash', account_type: 'ASSET', normal_balance: 'DEBIT' }});
    await prisma.companyConfiguration.upsert({
      where: { company_id: compAId },
      update: { default_cash_ledger_id: cashLedger.id },
      create: { company_id: compAId, default_cash_ledger_id: cashLedger.id }
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('should prevent creating BUSINESS_EXPENSE without category', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/retail/expenses')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-financial-year-id', financialYearId)
      .send({ type: 'BUSINESS_EXPENSE', amount: 100, payment_method: 'CASH', date: new Date().toISOString() });
    
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('category_id is required for BUSINESS_EXPENSE');
  });

  it('should allow creating OWNER_WITHDRAWAL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/retail/expenses')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-financial-year-id', financialYearId)
      .send({ type: 'OWNER_WITHDRAWAL', amount: 500, payment_method: 'CASH', date: new Date().toISOString(), note: 'Personal use' });
    
    if (res.status !== 201) console.log('OWNER_WITHDRAWAL error:', res.body);
    expect(res.status).toBe(201);
    expect(Number(res.body.amount)).toBe(500);
    expect(res.body.voucher_id).toBeDefined();
  });
});
