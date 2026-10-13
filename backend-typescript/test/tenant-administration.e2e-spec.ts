import { Test } from '@nestjs/testing';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';

describe('Tenant administration: real CRUD, devices, RBAC and cross-tenant attacks', () => {
  let app: INestApplication, db: PrismaService, A: any, B: any, tokenA: string, tokenB: string, sessionB: string, staff: any, staffToken: string, customRole: any, foreignRole: any, addedLocation: any, ownedBusiness: any;
  const suffix = Date.now(), password = 'Disposable!Admin765', staffPassword = 'Disposable!Staff765';
  const call = (method: string, path: string, tenant = A, token = tokenA) => (request(app.getHttpServer()) as any)[method]('/api/v1/' + path)
    .set('Authorization', 'Bearer ' + token).set('X-Company-Id', tenant.company.id).set('X-Branch-Id', tenant.branch.id).set('X-Financial-Year-Id', tenant.financialYear.id);

  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: [{ path: 'api/v1/{*path}', method: RequestMethod.ALL }] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init(); db = app.get(PrismaService);
    const provision = async (name: string) => app.get(TenantProvisioningService).provisionTenant({planId:(await db.plan.findUniqueOrThrow({where:{code:'PRO'}})).id, organizationName: name, adminEmail: name + '@test.invalid', adminName: 'Owner', adminPassword: password });
    A = await provision('admin-a-' + suffix); B = await provision('admin-b-' + suffix);
    const loginA = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: A.user.username, password }).expect(200); tokenA = loginA.body.access_token;
    const loginB = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: B.user.username, password }).expect(200); tokenB = loginB.body.access_token;
    sessionB = (await db.session.findFirstOrThrow({ where: { user_id: B.user.id, revoked_at: null } })).id;
    foreignRole = await db.role.findFirst({ where: { organization_id: B.organization.id } });
  }, 60000);
  afterAll(async () => {
    if (A && B) {
      const ids = (await db.company.findMany({ where: { organization_id: { in: [A.organization.id, B.organization.id] } }, select: { id: true } })).map(company => company.id);
      const scope = { company_id: { in: ids } };
      await db.auditLog.deleteMany({ where: scope });
      await db.requestIdempotency.deleteMany({ where: scope });
      await db.dailyCashCount.deleteMany({ where: scope });
      await db.stockMovement.deleteMany({ where: scope });
      await db.stockBalanceProjection.deleteMany({ where: scope });
      await db.openingStock.deleteMany({ where: scope });
      await db.item.deleteMany({ where: scope });
      await db.companyConfiguration.deleteMany({ where: scope });
      await db.expenseCategory.deleteMany({ where: scope });
      await db.ledgerAccount.deleteMany({ where: scope });
      await db.user.deleteMany({ where: { organization_id: { in: [A.organization.id, B.organization.id] } } });
      await db.role.deleteMany({ where: { organization_id: { in: [A.organization.id, B.organization.id] } } });
      await db.unit.deleteMany({ where: scope });
      await db.financialYear.deleteMany({ where: scope });
      await db.godown.deleteMany({ where: { branch: scope } });
      await db.branch.deleteMany({ where: scope });
      await db.company.deleteMany({ where: { id: { in: ids } } });
      await db.organization.deleteMany({ where: { id: { in: [A.organization.id, B.organization.id] } } });
    }
    await app.close();
  });

  it('returns only owned bounded directories without credential or internal subscription leakage', async () => {
    for (const [path, ownId, foreignId] of [['users', A.user.id, B.user.id], ['organizations', A.organization.id, B.organization.id], ['companies', A.company.id, B.company.id], ['branches', A.branch.id, B.branch.id], ['godowns', A.godown.id, B.godown.id], ['financial-years', A.financialYear.id, B.financialYear.id]]) {
      const response = await call('get', path + '?limit=1').expect(200);
      expect(response.body).toHaveLength(1); expect(response.body[0].id).toBe(ownId);
      expect(JSON.stringify(response.body)).not.toContain(foreignId);
      expect(JSON.stringify(response.body)).not.toMatch(/password_hash|internal_notes|google_subject/);
    }
    await call('get', 'users?limit=101').expect(400);
    await call('get', 'users?offset=-1').expect(400);
  });

  it('supports real staff search without searching another tenant', async () => {
    const own = await call('get', 'users?q=' + encodeURIComponent(A.user.username)).expect(200); expect(own.body[0].id).toBe(A.user.id);
    const foreign = await call('get', 'users?q=' + encodeURIComponent(B.user.username)).expect(200); expect(foreign.body).toEqual([]);
  });

  for (const resource of ['users', 'roles', 'organizations', 'companies', 'branches', 'godowns', 'financial-years']) {
    it('rejects GET and PATCH attacks against Tenant B ' + resource, async () => {
      const id = ({ users: B.user.id, roles: foreignRole.id, organizations: B.organization.id, companies: B.company.id, branches: B.branch.id, godowns: B.godown.id, 'financial-years': B.financialYear.id } as any)[resource];
      await call('get', resource + '/' + id).expect(404);
      const update = resource === 'users' ? { display_name: 'Stolen' } : resource === 'companies' ? { legal_name: 'Stolen' } : resource === 'roles' ? { name: 'Stolen', description: 'Attack' } : { name: 'Stolen' };
      const patchPath = resource === 'financial-years' ? resource + '/' + id + '/close' : resource + '/' + id;
      await call('patch', patchPath).send(resource === 'financial-years' ? {} : update).expect(404);
    });
  }

  it('rejects DELETE attacks on supported archival and role APIs', async () => {
    for (const [resource, id] of [['users', B.user.id], ['roles', foreignRole.id], ['companies', B.company.id], ['branches', B.branch.id], ['godowns', B.godown.id]]) await call('delete', resource + '/' + id).expect(404);
    expect((await db.company.findUnique({ where: { id: B.company.id } }))?.is_active).toBe(true);
    expect((await db.godown.findUnique({ where: { id: B.godown.id } }))?.is_active).toBe(true);
  });

  it('rejects foreign ownership fields and tenant creation/suspension escalation', async () => {
    await call('post', 'organizations').send({ name: 'Illicit tenant', code: 'ILLICIT-' + suffix }).expect(403);
    await call('patch', 'organizations/' + A.organization.id + '/disable').send({}).expect(403);
    await call('post', 'companies').send({ organization_id: B.organization.id, code: 'STOLEN', legal_name: 'Stolen' }).expect(403);
    await call('post', 'branches').send({ company_id: B.company.id, code: 'STOLEN', name: 'Stolen' }).expect(403);
    const response = await call('post', 'godowns').send({ branch_id: B.branch.id, code: 'STOLEN', name: 'Stolen' }); expect([400, 403]).toContain(response.status);
    await call('get', 'branches?company_id=' + B.company.id).expect(403);
    await call('get', 'godowns?branch_id=' + B.branch.id).expect(404);
    await call('post', 'financial-years').send({ company_id: B.company.id, label: 'Stolen', start_date: '2040-04-01', end_date: '2041-03-31' }).expect(403);
  });

  it('does not allow tenant staff roles to manufacture owner or Platform authorization', async () => {
    for (const name of ['ADMIN', 'owner', 'TENANT_ADMIN ', 'SUPER_ADMIN', 'BUSINESS_ADMIN_attack']) await call('post', 'roles').send({ name, description: 'Escalation' }).expect(400);
    customRole = (await call('post', 'roles').send({ name: 'Counter ' + suffix, description: 'Counter lookup only' }).expect(201)).body;
    await call('post', 'roles/' + customRole.id + '/permissions?permission_code=identity.admin').send({}).expect(403);
    await call('post', 'roles/' + customRole.id + '/permissions?permission_code=platform.tenants.write').send({}).expect(403);
    await call('post', 'roles/' + foreignRole.id + '/permissions?permission_code=inventory.read').send({}).expect(404);
    await call('patch', 'roles/' + customRole.id).send({ name: 'ADMIN', description: 'Escalation' }).expect(400);
    const role = await call('post', 'roles/' + customRole.id + '/permissions?permission_code=inventory.read').send({}).expect(201);
    expect(role.body.permissions.some((permission: any) => permission.code === 'inventory.read')).toBe(true);
  });

  it('creates staff with a temporary password, company membership and no verified-email claim', async () => {
    staff = (await call('post', 'users').send({ username: 'staff-' + suffix, password: staffPassword, display_name: 'Counter Staff', email: 'unverified-' + suffix + '@test.invalid', roles: [customRole.id] }).expect(201)).body;
    expect(staff.password_hash).toBeUndefined(); expect(staff.roles[0].id).toBe(customRole.id);
    const record = await db.user.findUnique({ where: { id: staff.id } });
    expect(record?.must_change_password).toBe(true); expect(record?.temporary_password_expires_at).toBeInstanceOf(Date); expect(record?.email_verified_at).toBeNull();
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: staff.username, password: staffPassword }).expect(200);
    expect(login.body.user.must_change_password || login.body.must_change_password).toBeTruthy();
    await request(app.getHttpServer()).post('/api/v1/auth/password/change').set('Authorization', 'Bearer ' + login.body.access_token).set('X-Company-Id', A.company.id).set('X-Branch-Id', A.branch.id)
      .send({ current_password: staffPassword, password: 'Changed!StaffPassword766' }).expect(201);
    staffToken = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: staff.username, password: 'Changed!StaffPassword766' }).expect(200)).body.access_token;
  });

  it('ordinary staff cannot manage users, roles, business settings or another user device', async () => {
    for (const path of ['users', 'roles', 'permissions', 'organizations', 'companies', 'branches', 'godowns', 'financial-years']) await call('get', path, A, staffToken).expect(403);
    const sessions = await call('get', 'sessions', A, staffToken).expect(200); expect(sessions.body.every((session: any) => session.user_id === staff.id)).toBe(true);
    await call('get', 'sessions?user_id=' + A.user.id, A, staffToken).expect(403);
    await call('post', 'sessions/' + sessionB + '/revoke', A, staffToken).send({}).expect(404);
  });

  it('isolates devices and revocations and exposes the current session truthfully', async () => {
    const sessions = await call('get', 'sessions').expect(200);
    expect(sessions.body.some((session: any) => session.current)).toBe(true); expect(sessions.body.every((session: any) => session.user_id === A.user.id)).toBe(true);
    await call('get', 'users/' + B.user.id + '/sessions').expect(404);
    await call('post', 'sessions/' + sessionB + '/revoke').send({}).expect(404);
    await call('post', 'users/' + B.user.id + '/sessions/revoke-all').send({}).expect(404);
    await call('get', 'sessions', B, tokenB).expect(200);
    await call('post', 'users/' + staff.id + '/sessions/revoke-all').send({}).expect(201);
    await call('get', 'sessions', A, staffToken).expect(401);
  });

  it('protects owner access, archives staff access and keeps identity for historical records', async () => {
    await call('delete', 'users/' + A.user.id).expect(409);
    await call('patch', 'users/' + A.user.id + '/disable').send({}).expect(409);
    await call('post', 'users/' + staff.id + '/roles?role_id=' + foreignRole.id).send({}).expect(404);
    const ownerRole = await db.role.findFirst({ where: { organization_id: A.organization.id, name: 'TENANT_ADMIN' } });
    await call('post', 'users/' + staff.id + '/roles?role_id=' + ownerRole!.id).send({}).expect(403);
    await call('delete', 'users/' + staff.id).expect(200);
    expect((await db.user.findUnique({ where: { id: staff.id } }))?.is_active).toBe(false);
  });

  it('requires effective backend location entitlement and preserves a default active location', async () => {
    const feature = await db.feature.findUniqueOrThrow({ where: { code: 'MULTIPLE_STOCK_LOCATIONS' } });
    await db.tenantEntitlement.upsert({where:{uix_tenant_entitlements:{organization_id:A.organization.id,feature_id:feature.id}},create:{organization_id:A.organization.id,feature_id:feature.id,is_enabled:false},update:{is_enabled:false}});
    await call('post', 'godowns').send({ branch_id: A.branch.id, code: 'SECOND', name: 'Second location' }).expect(403);
    await call('delete', 'godowns/' + A.godown.id).expect(409);
    await db.tenantEntitlement.update({where:{uix_tenant_entitlements:{organization_id:A.organization.id,feature_id:feature.id}},data:{is_enabled:true}});
    const org=await db.organization.findUniqueOrThrow({where:{id:A.organization.id}});
    await db.organization.update({where:{id:org.id},data:{limit_overrides:{...(org.limit_overrides as object),stock_locations:2}}});
    addedLocation = (await call('post', 'godowns').send({ branch_id: A.branch.id, code: 'SECOND', name: 'Second location' }).expect(201)).body;
    await call('patch', 'godowns/' + addedLocation.id).send({ name: 'Warehouse' }).expect(200);
    await call('delete', 'godowns/' + addedLocation.id).expect(200);
    expect((await db.godown.findUnique({ where: { id: addedLocation.id } }))?.is_active).toBe(false);
  });

  it('creates an owned business with default store, location, financial year, ledgers and membership', async () => {
    // Current launch plans are single-business; only an explicit capacity exception permits this legacy admin operation.
    await call('post','companies').send({organization_id:A.organization.id,code:'DENIED-'+suffix,legal_name:'Not included'}).expect(403);
    const org=await db.organization.findUniqueOrThrow({where:{id:A.organization.id}});
    await db.organization.update({where:{id:org.id},data:{limit_overrides:{...(org.limit_overrides as object),companies:2}}});
    ownedBusiness = (await call('post', 'companies').send({ organization_id: A.organization.id, code: 'OWNED-' + suffix, legal_name: 'Second owned business', country: 'India', timezone: 'Asia/Kolkata', fy_start_month: 4 }).expect(201)).body;
    expect(await db.branch.count({ where: { company_id: ownedBusiness.id } })).toBe(1);
    expect(await db.godown.count({ where: { branch: { company_id: ownedBusiness.id } } })).toBe(1);
    expect(await db.financialYear.count({ where: { company_id: ownedBusiness.id, is_active: true } })).toBe(1);
    expect(await db.ledgerAccount.count({ where: { company_id: ownedBusiness.id } })).toBe(7);
    expect(await db.userRole.count({ where: { user_id: A.user.id, company_id: ownedBusiness.id } })).toBe(1);
    await call('get', 'companies/' + ownedBusiness.id).expect(200);
    await call('get', 'companies/' + ownedBusiness.id, B, tokenB).expect(404);
  });

  it('rejects overlapping financial years atomically and isolates activation/closure', async () => {
    const year = (await call('post', 'financial-years').send({ company_id: A.company.id, label: '2040-41', start_date: '2040-04-01', end_date: '2041-03-31' }).expect(201)).body;
    await call('post', 'financial-years').send({ company_id: A.company.id, label: 'Overlap', start_date: '2040-10-01', end_date: '2041-09-30' }).expect(409);
    await call('patch', 'financial-years/' + B.financialYear.id + '/activate').send({}).expect(404);
    await call('patch', 'financial-years/' + year.id + '/activate').send({}).expect(200);
    expect(await db.financialYear.count({ where: { company_id: A.company.id, is_active: true } })).toBe(1);
    await call('patch', 'financial-years/' + year.id + '/close').send({}).expect(200);
    await call('patch', 'financial-years/' + year.id + '/activate').send({}).expect(409);
  });
});
