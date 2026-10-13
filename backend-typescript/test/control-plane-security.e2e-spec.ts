import { Test } from '@nestjs/testing';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomBytes, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { SmsOtpProvider } from '../src/auth/sms-otp.provider';
import { GoogleIdentityService } from '../src/auth/google-identity.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { LocalStorageService } from '../src/attachments/storage/local-storage.service';
import { authTokenHash } from '../src/auth/password-lifecycle.service';

describe('Platform identity security and private-file erasure (isolated real PostgreSQL)', () => {
  let app: INestApplication, db: PrismaService, token: string, tenant: any, other: any;
  const suffix = randomUUID();
  const password = 'Test!' + randomBytes(16).toString('hex');
  const delivered = new Map<string, string>();
  let phoneCounter = 0;
  const phone = () => '+919' + String(Date.now() + ++phoneCounter).slice(-9);
  const api = (method: string, path: string, access?: string) =>
    (request(app.getHttpServer()) as any)[method]('/api/v1/' + path).set('Authorization', access ? 'Bearer ' + access : '');
  const admin = (method: string, path: string) => api(method, 'platform/admin/' + path, token);
  const otp = async (p: string, purpose = 'SIGN_UP') => (await api('post', 'auth/account/otp/request').send({ phone: p, purpose, terms_accepted: true }).expect(200)).body;
  const verify = (id: string, code: string) => api('post', 'auth/account/otp/verify').send({ challenge_id: id, code });
  const google = async (email: string, subject = randomUUID(), nonceOverride?: string) => {
    const ch = (await api('post', 'auth/google/signup-challenge').expect(201)).body;
    return { challenge_id: ch.challenge_id, terms_accepted: true, credential: JSON.stringify({ subject, email, nonce: nonceOverride || ch.nonce, emailAuthoritative: true }) };
  };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SmsOtpProvider).useValue({ configured: () => true, send: async (p: string, c: string) => { delivered.set(p, c); } })
      .overrideProvider(GoogleIdentityService).useValue({ clientId: () => 'test-only.apps.googleusercontent.com', verify: async (c: string) => JSON.parse(c) }).compile();
    app = fixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: [{ path: 'api/v1/{*path}', method: RequestMethod.ALL }] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init(); db = app.get(PrismaService);
    const role = await db.platformRole.upsert({ where: { name: 'SUPER_ADMIN' }, create: { name: 'SUPER_ADMIN', system_role: true }, update: {} });
    const username = 'control-security-' + suffix;
    await db.platformUser.create({ data: { username, display_name: 'Disposable operator', password_hash: await bcrypt.hash(password, 10), roles: { create: { role_id: role.id } } } });
    token = (await api('post', 'platform/auth/login').send({ username, password }).expect(200)).body.access_token;
    const provision = app.get(TenantProvisioningService);
    tenant = await provision.provisionTenant({ organizationName: 'Security A ' + suffix, adminName: 'A owner', adminEmail: suffix + '@a.invalid', adminPassword: password });
    other = await provision.provisionTenant({ organizationName: 'Security B ' + suffix, adminName: 'B owner', adminEmail: suffix + '@b.invalid', adminPassword: password });
  }, 60000);
  afterAll(async () => { vi.restoreAllMocks(); if (db) await db.platformSetting.deleteMany({ where: { key: 'ACCOUNT_POLICY' } }); if (app) await app.close(); });

  it('rejects expired OTP and exhausts five attempts without accepting the correct code afterwards', async () => {
    const p = phone(), ch = await otp(p);
    for (let i = 0; i < 5; i++) await verify(ch.challenge_id, '000000').expect(401);
    await verify(ch.challenge_id, delivered.get(p)!).expect(401);
    const saved = await db.mobileOtpChallenge.findUniqueOrThrow({ where: { id: ch.challenge_id } });
    expect(saved.attempts).toBe(5); expect(saved.used_at).not.toBeNull();
    const p2 = phone(), expired = await otp(p2);
    await db.mobileOtpChallenge.update({ where: { id: expired.challenge_id }, data: { expires_at: new Date(Date.now() - 1000) } });
    await verify(expired.challenge_id, delivered.get(p2)!).expect(401);
    expect(await db.user.findUnique({ where: { phone_e164: p2 } })).toBeNull();
  });
  it('rejects formatted legacy contacts as implicit identity takeover', async () => {
    const p = phone(); await db.user.update({ where: { id: tenant.user.id }, data: { phone: p.slice(0, 3) + ' ' + p.slice(3, 8) + '-' + p.slice(8) } });
    const ch = await otp(p); await verify(ch.challenge_id, delivered.get(p)!).expect(401);
    expect(await db.user.findUnique({ where: { phone_e164: p } })).toBeNull();
  });
  it('reuses a verified mobile identity across canonical formats without another account', async () => {
    const p = phone(), ch = await otp(p); const first = (await verify(ch.challenge_id, delivered.get(p)!).expect(200)).body;
    await db.mobileOtpChallenge.update({ where: { id: ch.challenge_id }, data: { created_at: new Date(Date.now() - 61000) } });
    const next = await otp(p.slice(3), 'SIGN_IN'); const second = (await verify(next.challenge_id, delivered.get(p)!).expect(200)).body;
    expect(second.user.id).toBe(first.user.id); expect(await db.user.count({ where: { phone_e164: p } })).toBe(1);
  });
  it('binds Google signup to its nonce, consumes it once and reuses the same subject', async () => {
    const email = suffix + '@google.invalid', subject = randomUUID();
    const wrong = await google(email, subject, 'wrong-nonce');
    await api('post', 'auth/google/signup').send(wrong).expect(401);
    const body = await google(email, subject); const first = (await api('post', 'auth/google/signup').send(body).expect(200)).body;
    expect(first.user.onboarding_state).toBe('BUSINESS_PROFILE_REQUIRED'); expect(first.user.password_hash).toBeUndefined();
    expect(first.tenant_context).toBeNull();
    const saved = await db.user.findUniqueOrThrow({ where: { id: first.user.id } });
    expect(saved.password_login_enabled).toBe(false);
    expect(saved.onboarding_data).toMatchObject({ signup_provider: 'GOOGLE' });
    await api('post', 'auth/google/signup').send(body).expect(401);
    const repeat = await google(email, subject);
    const second = (await api('post', 'auth/google/signup').send(repeat).expect(200)).body;
    expect(second.user.id).toBe(first.user.id); expect(await db.user.count({ where: { google_subject: subject } })).toBe(1);
    const challenge = (await api('post', 'auth/google/challenge').expect(201)).body;
    const login = (await api('post', 'auth/google/login').send({ challenge_id: challenge.challenge_id,
      credential: JSON.stringify({ subject, email, nonce: challenge.nonce, emailAuthoritative: true }) }).expect(200)).body;
    expect(login.user.id).toBe(first.user.id);
    expect(login.user.onboarding_state).toBe('BUSINESS_PROFILE_REQUIRED');
    await api('get', 'platform/admin/tenants', login.access_token).expect(401);
  });
  it('requires signup consent without creating a Google account or consuming its challenge', async () => {
    const email = suffix + '@consent.google.invalid', subject = randomUUID(), body = await google(email, subject);
    await api('post', 'auth/google/signup').send({ ...body, terms_accepted: false }).expect(400);
    expect(await db.user.count({ where: { google_subject: subject } })).toBe(0);
    expect((await db.authToken.findUniqueOrThrow({ where: { id: body.challenge_id } })).used_at).toBeNull();
  });
  it('requires explicit existing-account linkage when a Google email matches a password account', async () => {
    const body = await google(tenant.user.email);
    await api('post', 'auth/google/signup').send(body).expect(409);
    expect((await db.user.findUniqueOrThrow({ where: { id: tenant.user.id } })).google_subject).toBeNull();
  });
  it('requires recent provider authentication to create the first password and revokes that session', async () => {
    const p = phone(), ch = await otp(p), login = (await verify(ch.challenge_id, delivered.get(p)!).expect(200)).body;
    await db.session.updateMany({ where: { user_id: login.user.id }, data: { issued_at: new Date(Date.now() - 360000) } });
    await api('post', 'auth/account/password/create', login.access_token).send({ password }).expect(400);
    await db.mobileOtpChallenge.update({ where: { id: ch.challenge_id }, data: { created_at: new Date(Date.now() - 61000) } });
    const fresh = await otp(p, 'SIGN_IN'), next = (await verify(fresh.challenge_id, delivered.get(p)!).expect(200)).body;
    await api('post', 'auth/account/password/create', next.access_token).send({ password }).expect(201);
    await api('get', 'auth/account/onboarding', next.access_token).expect(401);
    const saved = await db.user.findUniqueOrThrow({ where: { id: next.user.id } });
    expect(saved.password_login_enabled).toBe(true); expect(await bcrypt.compare(password, saved.password_hash)).toBe(true);
    await api('post', 'auth/login').send({ username: saved.username, password }).expect(200);
  });
  it('restricts user contact and role changes to the correct tenant and prevents platform promotion or last-owner demotion', async () => {
    const staffRole = await db.role.create({ data: { organization_id: tenant.organization.id, name: 'Acceptance staff ' + suffix } });
    const globalRole = await db.role.create({ data: { name: 'SUPER_ADMIN', organization_id: tenant.organization.id } });
    await admin('patch', `tenants/${other.organization.id}/users/${tenant.user.id}`).send({ display_name: 'Attack', reason: 'Cross-tenant rejection' }).expect(400);
    await admin('post', `tenants/${tenant.organization.id}/users/${tenant.user.id}/role`).send({ role_id: globalRole.id, company_id: tenant.company.id, reason: 'No platform promotion' }).expect(400);
    await admin('post', `tenants/${tenant.organization.id}/users/${tenant.user.id}/role`).send({ role_id: staffRole.id, company_id: other.company.id, reason: 'No cross-company role' }).expect(400);
    await admin('post', `tenants/${tenant.organization.id}/users/${tenant.user.id}/role`).send({ role_id: staffRole.id, company_id: tenant.company.id, reason: 'Keep the last owner' }).expect(400);
    const roles = (await admin('get', `tenants/${tenant.organization.id}/roles`).expect(200)).body;
    expect(roles.some((r: any) => r.name === 'SUPER_ADMIN')).toBe(false);
    await admin('patch', `tenants/${tenant.organization.id}/users/${tenant.user.id}`).send({ phone: '9876543210', reason: 'Contact data is not a verified identity' }).expect(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: tenant.user.id } })).phone_verified_at).toBeNull();
  });
  it('sets a temporary password without exposing it, invalidates recovery tokens and forces replacement', async () => {
    const oldSession = (await api('post', 'auth/login').send({ username: tenant.user.username, password }).expect(200)).body.access_token;
    const reset = await db.authToken.create({ data: { user_id: tenant.user.id, purpose: 'PASSWORD_RESET', token_hash: authTokenHash(randomBytes(32).toString('base64url')), expires_at: new Date(Date.now() + 60000) } });
    const temporary = 'Temporary!' + randomBytes(16).toString('hex');
    const result = (await admin('post', `tenants/${tenant.organization.id}/users/${tenant.user.id}/credentials`).send({ action: 'TEMPORARY', temporary_password: temporary, reason: 'Disposable credential acceptance' }).expect(201)).body;
    expect(JSON.stringify(result)).not.toContain(temporary);
    expect((await db.authToken.findUniqueOrThrow({ where: { id: reset.id } })).used_at).not.toBeNull();
    await api('get', 'auth/account/onboarding', oldSession).expect(401);
    const next = (await api('post', 'auth/login').send({ username: tenant.user.username, password: temporary }).expect(200)).body;
    expect(next.user.must_change_password).toBe(true);
    await api('get', 'retail/items', next.access_token).set('X-Company-Id', tenant.company.id).expect(403);
    const audits = await db.platformAuditLog.findMany({ where: { resource_id: tenant.organization.id } });
    expect(JSON.stringify(audits)).not.toContain(temporary);
  });
  it('removes only an inactive user without business history, retaining users with audit references', async () => {
    const staff = await db.user.create({ data: { organization_id: other.organization.id, username: 'erasable-' + suffix, display_name: 'Never transacted', password_hash: await bcrypt.hash(password, 10), is_active: false } });
    const preview = (await admin('get', `tenants/${other.organization.id}/users/${staff.id}/deletion-preview`).expect(200)).body;
    expect(preview.blockers).toHaveLength(0);
    await admin('post', `tenants/${other.organization.id}/users/${staff.id}/delete`).send({ confirmation: preview.confirmation, reason: 'Erase unused disabled test staff' }).expect(201);
    expect(await db.user.findUnique({ where: { id: staff.id } })).toBeNull();
    await db.user.update({ where: { id: other.user.id }, data: { is_active: false } });
    await db.auditLog.create({ data: { company_id: other.company.id, user_id: other.user.id, action: 'RETENTION_TEST' } });
    const blocked = (await admin('get', `tenants/${other.organization.id}/users/${other.user.id}/deletion-preview`).expect(200)).body;
    expect(blocked.counts.AuditLog).toBeGreaterThan(0);
    await admin('post', `tenants/${other.organization.id}/users/${other.user.id}/delete`).send({ confirmation: blocked.confirmation, reason: 'Preserve historical authorship' }).expect(400);
  });
  it('denies owner referrals to staff even when their custom role grants identity administration', async () => {
    const permission = await db.permission.upsert({ where: { code: 'identity.admin' }, update: {},
      create: { code: 'identity.admin', module: 'identity', resource: 'identity', action: 'admin' } });
    const role = await db.role.create({ data: { organization_id: other.organization.id, name: 'Identity staff ' + suffix, role_permissions: { create: { permission_id: permission.id } } } });
    const staff = await db.user.create({ data: { organization_id: other.organization.id, username: 'referral-staff-' + suffix, display_name: 'Privileged staff', password_hash: await bcrypt.hash(password, 10), roles: { create: { role_id: role.id, company_id: other.company.id, branch_id: other.branch.id } } } });
    const access = (await api('post', 'auth/login').send({ username: staff.username, password }).expect(200)).body.access_token;
    await api('get', 'retail/referrals', access).set('X-Company-Id', other.company.id).set('X-Branch-Id', other.branch.id).expect(403);
  });

  async function fileTenant(provider = 'local') {
    const t = await app.get(TenantProvisioningService).provisionTenant({ organizationName: 'Erasure ' + randomUUID(), adminName: 'Erasure owner', adminEmail: randomUUID() + '@erase.invalid', adminPassword: password });
    const key = t.company.id + '/ITEM_IMAGE/' + randomUUID() + '.png';
    if (provider === 'local') await app.get(LocalStorageService).save(key, Buffer.from('private disposable test attachment'));
    await db.attachment.create({ data: { organization_id: t.organization.id, company_id: t.company.id, entity_type: 'Item', entity_id: randomUUID(), category: 'ITEM_IMAGE', original_file_name: 'private.png', stored_file_name: 'private.png', mime_type: 'image/png', file_size: 34, storage_provider: provider, storage_key: key, created_by: t.user.id } });
    await admin('post', 'account-policy').send({ trial_enabled: false, trial_days: null, trial_plan: 'SMART', permanent_delete_enabled: true, retention_days: 0, delete_requires_backup: false, reason: 'Disposable test policy only; no real tenant removed' }).expect(201);
    await admin('post', `tenants/${t.organization.id}/archive`).send({ reason: 'Disposable attachment erasure' }).expect(201);
    return { ...t, key };
  }
  it('purges scoped database records and verifies physical local attachments are gone', async () => {
    const t = await fileTenant();
    const result = (await admin('post', `tenants/${t.organization.id}/permanent-delete`).send({ confirmation: 'DELETE ' + t.organization.code, reason: 'Erase isolated attachment fixture' }).expect(201)).body;
    expect(result.status).toBe('COMPLETED');
    await expect(app.get(LocalStorageService).get(t.key)).rejects.toMatchObject({ status: 404 });
    expect(await db.attachment.count({ where: { organization_id: t.organization.id } })).toBe(0);
    expect(await db.organization.findUnique({ where: { id: other.organization.id } })).not.toBeNull();
  });
  it('purges several variant and batch balances without collapsing their partial unique keys or touching another tenant', async () => {
    const t = await fileTenant();
    const unit = await db.unit.findFirstOrThrow({ where: { company_id: t.company.id } });
    const item = await db.item.create({ data: { company_id: t.company.id, name: 'Dimension erasure fixture', sku: randomUUID(), item_type: 'STOCK_ITEM', primary_unit_id: unit.id } });
    const variants = await Promise.all(['Red', 'Blue'].map(color => db.itemVariant.create({ data: { item_id: item.id, attributes: { color } } })));
    const batches = await Promise.all(['LOT-A', 'LOT-B'].map(batch_number => db.itemBatch.create({ data: { company_id: t.company.id, item_id: item.id, batch_number } })));
    const balances = [{ variant_id: null, batch_id: null },
      ...variants.map(v => ({ variant_id: v.id, batch_id: null })),
      ...batches.map(b => ({ variant_id: null, batch_id: b.id })),
      ...variants.flatMap(v => batches.map(b => ({ variant_id: v.id, batch_id: b.id })))];
    await db.stockBalanceProjection.createMany({ data: balances.map(dimensions => ({ ...dimensions, company_id: t.company.id, branch_id: t.branch.id, godown_id: t.godown.id, item_id: item.id, quantity: 2 })) });
    const protectedUnit = await db.unit.findFirstOrThrow({ where: { company_id: other.company.id } });
    const protectedItem = await db.item.create({ data: { company_id: other.company.id, name: 'Protected stock fixture', sku: randomUUID(), item_type: 'STOCK_ITEM', primary_unit_id: protectedUnit.id } });
    const protectedBalance = await db.stockBalanceProjection.create({ data: { company_id: other.company.id, branch_id: other.branch.id, godown_id: other.godown.id, item_id: protectedItem.id, quantity: 11 } });
    const before = await db.stockBalanceProjection.findUniqueOrThrow({ where: { id: protectedBalance.id } });
    const response = (await admin('post', `tenants/${t.organization.id}/permanent-delete`).send({ confirmation: 'DELETE ' + t.organization.code, reason: 'Disposable dimension-index erasure regression' }).expect(201)).body;
    expect(response.status).toBe('COMPLETED');
    expect(await db.stockBalanceProjection.count({ where: { company_id: t.company.id } })).toBe(0);
    expect(await db.itemVariant.count({ where: { item_id: item.id } })).toBe(0);
    expect(await db.itemBatch.count({ where: { item_id: item.id } })).toBe(0);
    expect(await db.stockBalanceProjection.findUniqueOrThrow({ where: { id: protectedBalance.id } })).toEqual(before);
    expect(await db.item.findUnique({ where: { id: protectedItem.id } })).not.toBeNull();
  });
  it('reports file erasure failure honestly and retries the durable scoped job', async () => {
    const t = await fileTenant(), storage = app.get(LocalStorageService);
    const failed = vi.spyOn(storage, 'delete').mockRejectedValueOnce(new Error('Simulated inaccessible disposable file'));
    const result = (await admin('post', `tenants/${t.organization.id}/permanent-delete`).send({ confirmation: 'DELETE ' + t.organization.code, reason: 'Verify partial erasure recovery' }).expect(201)).body;
    expect(result.status).toBe('STORAGE_RETRY'); expect(await storage.get(t.key)).toBeInstanceOf(Buffer); failed.mockRestore();
    const done = (await admin('post', `deletion-jobs/${result.job_id}/retry`).send({ reason: 'Private file access restored' }).expect(201)).body;
    expect(done.status).toBe('COMPLETED'); await expect(storage.get(t.key)).rejects.toMatchObject({ status: 404 });
    await admin('post', `deletion-jobs/${result.job_id}/retry`).send({ reason: 'Completed job is idempotent' }).expect(201);
    expect((await db.tenantDeletionJob.findUniqueOrThrow({ where: { id: result.job_id } })).error_code).toBeNull();
  });
  it('refuses provider objects requiring version-erasure tooling and leaves all tenant records intact', async () => {
    const t = await fileTenant('s3');
    const preview = (await admin('get', `tenants/${t.organization.id}/deletion-preview`).expect(200)).body;
    expect(preview.storage_erasure_supported).toBe(false);
    await admin('post', `tenants/${t.organization.id}/permanent-delete`).send({ confirmation: preview.confirmation, reason: 'No unverified object-store purge' }).expect(400);
    expect(await db.organization.findUnique({ where: { id: t.organization.id } })).not.toBeNull();
    expect(await db.attachment.count({ where: { organization_id: t.organization.id } })).toBe(1);
  });
});
