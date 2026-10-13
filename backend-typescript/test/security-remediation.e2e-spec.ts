import { Test } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Get,
  Inject,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import * as bcrypt from 'bcrypt';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { SecurityRateStore } from '../src/common/security-rate.module';
import { requestDatabaseScope } from '../src/database/request-scope';
import { totpCode } from '../src/platform/auth/totp';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { AuthService } from '../src/auth/auth.service';
import { PlatformAuthService } from '../src/platform/auth/platform-auth.service';

class UnverifiedScopeProbe {
  constructor(private db: PrismaService) {}
  async probe() {
    return {
      scope: requestDatabaseScope.getStore()?.kind,
      rows: await this.db.item.findMany(),
    };
  }
}
Controller('scope-probe')(UnverifiedScopeProbe);
Inject(PrismaService)(UnverifiedScopeProbe, undefined, 0);
Get()(
  UnverifiedScopeProbe.prototype,
  'probe',
  Object.getOwnPropertyDescriptor(UnverifiedScopeProbe.prototype, 'probe')!,
);
describe('Security remediation — real restricted database, cookies, CSRF, RLS, MFA and uploads', () => {
  let app: INestApplication,
    db: PrismaService,
    A: any,
    B: any,
    tokenA: string,
    tokenB: string,
    owner: any,
    platformName: string,
    platformUserId: string;
  let maint: PrismaClient,
    runtime: PrismaClient,
    originalUrl: string,
    roleName: string,
    uri: string,
    recoveryCode: string;
  const password = 'Disposable!Security765',
    suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const browser = () => request.agent(app.getHttpServer());
  const api = (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    tenant = A,
    token = tokenA,
  ) =>
    request(app.getHttpServer())
      [method]('/api/v1/' + path)
      .set('Authorization', 'Bearer ' + token)
      .set('X-Company-Id', tenant.company.id)
      .set('X-Branch-Id', tenant.branch.id)
      .set('X-Financial-Year-Id', tenant.financialYear.id);
  beforeAll(async () => {
    originalUrl = process.env.DATABASE_URL!;
    const url = new URL(originalUrl);
    if (!url.pathname.includes('_test')) throw Error('Disposable DB only');
    maint = new PrismaClient({ datasources: { db: { url: originalUrl } } });
    roleName = 'evx_security_' + suffix;
    const rolePassword = randomBytes(32).toString('hex');
    await maint.$executeRawUnsafe(
      `CREATE ROLE "${roleName}" LOGIN PASSWORD '${rolePassword}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
    );
    await maint.$executeRawUnsafe(
      `GRANT "${roleName}" TO CURRENT_USER WITH INHERIT TRUE`,
    );
    await maint.$executeRawUnsafe(
      `GRANT USAGE ON SCHEMA public TO "${roleName}"`,
    );
    await maint.$executeRawUnsafe(
      `GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO "${roleName}"`,
    );
    await maint.$executeRawUnsafe(
      `GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO "${roleName}"`,
    );
    url.username = roleName;
    url.password = rolePassword;
    process.env.DATABASE_URL = url.toString();
    process.env.PLATFORM_MFA_REQUIRED = 'true';
    runtime = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });
    app = (
      await Test.createTestingModule({
        imports: [AppModule],
        controllers: [UnverifiedScopeProbe],
      }).compile()
    ).createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'api/v1/{*path}', method: RequestMethod.ALL }],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    db = app.get(PrismaService);
    const provision = app.get(TenantProvisioningService);
    A = await provision.provisionTenant({
      organizationName: 'Restricted A ' + suffix,
      adminEmail: suffix + '@a.invalid',
      adminName: 'A owner',
      adminPassword: password,
    });
    B = await provision.provisionTenant({
      organizationName: 'Restricted B ' + suffix,
      adminEmail: suffix + '@b.invalid',
      adminName: 'B owner',
      adminPassword: password,
    });
    const login = async (s: any) =>
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ username: s.user.username, password })
          .expect(200)
      ).body.access_token;
    tokenA = await login(A);
    tokenB = await login(B);
    for (const [shop, token] of [
      [A, tokenA],
      [B, tokenB],
    ])
      await api('post', 'retail/items', shop, token)
        .send({
          name: 'RLS private ' + shop.company.id,
          selling_price: 25,
          opening_stock: 3,
          purchase_price: 10,
        })
        .expect(201);
    platformName = 'secure-operator-' + suffix;
    const role = await db.platformRole.findUniqueOrThrow({
      where: { name: 'SUPER_ADMIN' },
    });
    const user = await db.platformUser.create({
      data: {
        username: platformName,
        display_name: 'Disposable secure operator',
        password_hash: await bcrypt.hash(password, 12),
        roles: { create: { role_id: role.id } },
      },
    });
    platformUserId = user.id;
  }, 90000);
  afterAll(async () => {
    if (app) await app.close();
    if (runtime) await runtime.$disconnect();
    process.env.DATABASE_URL = originalUrl;
    process.env.PLATFORM_MFA_REQUIRED = 'false';
    if (maint && roleName) {
      await maint.$executeRawUnsafe(`DROP OWNED BY "${roleName}"`);
      await maint.$executeRawUnsafe(`DROP ROLE "${roleName}"`);
    }
    if (maint) await maint.$disconnect();
  });
  it('restricted role cannot bypass RLS, and plain unscoped queries return no business rows', async () => {
    const [role] = await runtime.$queryRaw<
      any[]
    >`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
    expect(role.rolsuper).toBe(false);
    expect(role.rolbypassrls).toBe(false);
    expect(await runtime.item.findMany()).toEqual([]);
    const tables = await runtime.$queryRaw<
      any[]
    >`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('items','parties','sales_invoices','attachments')`;
    expect(tables).toHaveLength(4);
    expect(tables.every((t) => t.relrowsecurity && t.relforcerowsecurity)).toBe(
      true,
    );
  });
  it('unguarded HTTP code remains unverified and cannot accidentally read tenant rows', async () => {
    const r = await request(app.getHttpServer())
      .get('/api/v1/scope-probe')
      .expect(200);
    expect(r.body.scope).toBe('unverified');
    expect(r.body.rows).toEqual([]);
  });
  it('authorized company queries see only their rows, including a deliberately missing predicate', async () => {
    const rowsA = await requestDatabaseScope.run(
      { kind: 'tenant', companyId: A.company.id },
      () => db.item.findMany(),
    );
    expect(rowsA.length).toBeGreaterThan(0);
    expect(rowsA.every((row) => row.company_id === A.company.id)).toBe(true);
    const rowsB = await api('get', 'retail/items', B, tokenB).expect(200);
    expect(
      rowsB.body.some((row: any) => row.name === 'RLS private ' + A.company.id),
    ).toBe(false);
    const privateB = rowsB.body.find(
      (row: any) => row.name === 'RLS private ' + B.company.id,
    );
    expect(privateB).toBeDefined();
    await requestDatabaseScope.run(
      { kind: 'tenant', companyId: A.company.id },
      () =>
        expect(
          db.item.update({
            where: { id: privateB.id },
            data: { name: 'stolen' },
          }),
        ).rejects.toThrow(),
    );
  });
  it('web login sets HttpOnly cookies and returns CSRF metadata without a bearer token', async () => {
    owner = browser();
    const r = await owner
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: A.user.username, password })
      .expect(200);
    expect(r.body.access_token).toBeUndefined();
    expect(r.body.session_mode).toBe('cookie');
    expect(r.body.csrf_token).toMatch(/^[a-f0-9]{64}$/);
    expect(
      r.headers['set-cookie'].some(
        (cookie: string) =>
          cookie.startsWith('evolix_shop_session=') &&
          cookie.includes('HttpOnly') &&
          cookie.includes('SameSite=Strict'),
      ),
    ).toBe(true);
    await owner
      .get('/api/v1/retail/items')
      .set('X-Company-Id', A.company.id)
      .expect(200);
    const create = (agent: any) =>
      agent
        .post('/api/v1/retail/needs')
        .set('X-Company-Id', A.company.id)
        .set('X-Branch-Id', A.branch.id);
    await create(owner).send({ name: 'Missing CSRF' }).expect(403);
    await create(owner)
      .set('X-CSRF-Token', r.body.csrf_token)
      .set('Origin', 'https://attacker.invalid')
      .send({ name: 'Cross origin' })
      .expect(403);
    await create(owner)
      .set('X-CSRF-Token', r.body.csrf_token)
      .send({ name: 'Valid cookie write' })
      .expect(201);
  });
  it('row policies reject moving a row to another company and adding a foreign child', async () => {
    const own = await db.item.findFirstOrThrow({
      where: { company_id: A.company.id, name: { startsWith: 'RLS private' } },
    });
    const foreign = await db.item.findFirstOrThrow({
      where: { company_id: B.company.id, name: { startsWith: 'RLS private' } },
    });
    await requestDatabaseScope.run(
      { kind: 'tenant', companyId: A.company.id },
      async () => {
        await expect(
          db.item.update({
            where: { id: own.id },
            data: { company_id: B.company.id },
          }),
        ).rejects.toThrow();
        await expect(
          db.itemVariant.create({
            data: { item_id: foreign.id, attributes: { size: 'unauthorized' } },
          }),
        ).rejects.toThrow();
      },
    );
  });
  it('web login rejects an untrusted origin even with correct credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://attacker.invalid')
      .send({ username: A.user.username, password })
      .expect(403);
  });
  it('image decoding rejects corrupt signature-only images and safely removes appended markup', async () => {
    const need = (
      await api('post', 'retail/needs')
        .send({ name: 'Image validation probe' })
        .expect(201)
    ).body;
    const upload = (buffer: Buffer) =>
      api('post', 'attachments')
        .field('entityType', 'NEED')
        .field('entityId', need.id)
        .field('category', 'NEED_PHOTO')
        .attach('file', buffer, {
          filename: '../../malicious.png',
          contentType: 'image/png',
        });
    const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    await upload(
      Buffer.concat([header, Buffer.from('<script>bad</script>')]),
    ).expect(400);
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    const saved = await upload(
      Buffer.concat([png, Buffer.from('<script>bad</script>')]),
    ).expect(201);
    const content = await api(
      'get',
      'attachments/' + saved.body.id + '/content',
    ).expect(200);
    expect(content.body.includes(Buffer.from('<script>'))).toBe(false);
    expect((await sharp(content.body).metadata()).width).toBe(2);
  });
  it('rate quotas are shared across independent stores and enforce concurrent requests atomically', async () => {
    const one = app.get(SecurityRateStore),
      two = new SecurityRateStore(db),
      key = 'concurrent-audit:' + suffix;
    const attempts = await Promise.allSettled(
      Array.from({ length: 16 }, (_, i) =>
        (i % 2 ? one : two).consume(key, 5, 60000),
      ),
    );
    expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    expect(attempts.filter((r) => r.status === 'rejected')).toHaveLength(11);
  });
  it('tenant storage quotas stop further uploads while another tenant remains unaffected', async () => {
    const previous = process.env.TENANT_UPLOAD_QUOTA_BYTES;
    process.env.TENANT_UPLOAD_QUOTA_BYTES = '5242880';
    const item = await db.item.findFirstOrThrow({
      where: { company_id: A.company.id },
    });
    const fake = await db.attachment.create({
      data: {
        organization_id: A.organization.id,
        company_id: A.company.id,
        branch_id: A.branch.id,
        entity_type: 'ITEM',
        entity_id: item.id,
        category: 'ITEM_IMAGE',
        original_file_name: 'quota-fixture.png',
        stored_file_name: 'quota-fixture.png',
        mime_type: 'image/png',
        file_size: 5242879,
        storage_provider: 'local',
        storage_key: 'quota-fixture',
        created_by: A.user.id,
      },
    });
    try {
      const png = await sharp({
        create: { width: 2, height: 2, channels: 3, background: '#fff' },
      })
        .png()
        .toBuffer();
      const needA = (
        await api('post', 'retail/needs').send({ name: 'Quota A' }).expect(201)
      ).body;
      const needB = (
        await api('post', 'retail/needs', B, tokenB)
          .send({ name: 'Quota B' })
          .expect(201)
      ).body;
      const upload = (shop: any, token: string, id: string) =>
        api('post', 'attachments', shop, token)
          .field('entityType', 'NEED')
          .field('entityId', id)
          .field('category', 'NEED_PHOTO')
          .attach('file', png, {
            filename: 'quota.png',
            contentType: 'image/png',
          });
      await upload(A, tokenA, needA.id).expect(400);
      await upload(B, tokenB, needB.id).expect(201);
    } finally {
      await db.attachment.delete({ where: { id: fake.id } });
      if (previous === undefined) delete process.env.TENANT_UPLOAD_QUOTA_BYTES;
      else process.env.TENANT_UPLOAD_QUOTA_BYTES = previous;
    }
  });
  it('platform password alone cannot grant access; enrollment secret is encrypted after verified TOTP', async () => {
    const agent = browser();
    const start = await agent
      .post('/api/v1/platform/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ username: platformName, password })
      .expect(200);
    expect(start.body.access_token).toBeUndefined();
    expect(start.body.mfa_required).toBe(true);
    expect(start.body.enrollment_required).toBe(true);
    await agent.get('/api/v1/platform/admin/dashboard').expect(401);
    uri = start.body.authenticator_uri;
    const secret = new URL(uri).searchParams.get('secret')!;
    const code = totpCode(secret, BigInt(Math.floor(Date.now() / 30000)));
    const verified = await agent
      .post('/api/v1/platform/auth/mfa/verify')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ challenge_id: start.body.challenge_id, code })
      .expect(200);
    expect(verified.body.access_token).toBeUndefined();
    expect(verified.body.recovery_codes).toHaveLength(8);
    expect(verified.body.session_mode).toBe('cookie');
    recoveryCode = verified.body.recovery_codes[0];
    const stored = await db.platformUser.findUniqueOrThrow({
      where: { id: platformUserId },
    });
    expect(stored.mfa_enabled_at).not.toBeNull();
    expect(stored.mfa_secret_encrypted).not.toContain(secret);
    expect(stored.mfa_recovery_hashes).not.toContain(
      verified.body.recovery_codes[0],
    );
    await agent.get('/api/v1/platform/admin/dashboard').expect(200);
    await agent
      .post('/api/v1/platform/auth/mfa/verify')
      .send({ challenge_id: start.body.challenge_id, code })
      .expect(401);
  });
  it('enrolled administrator requires a code, rejects TOTP replay and exhausts five failures', async () => {
    const start = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({ username: platformName, password })
      .expect(200);
    expect(start.body.authenticator_uri).toBeUndefined();
    expect(start.body.enrollment_required).toBe(false);
    const secret = new URL(uri).searchParams.get('secret')!;
    const [stored] = await db.platformUser.findMany({
      where: { id: platformUserId },
    });
    await request(app.getHttpServer())
      .post('/api/v1/platform/auth/mfa/verify')
      .send({
        challenge_id: start.body.challenge_id,
        code: totpCode(secret, stored.mfa_last_counter!),
      })
      .expect(401);
    for (let i = 0; i < 4; i++)
      await request(app.getHttpServer())
        .post('/api/v1/platform/auth/mfa/verify')
        .send({ challenge_id: start.body.challenge_id, code: '000000' })
        .expect(401);
    const challenge = await db.platformMfaChallenge.findUniqueOrThrow({
      where: { id: start.body.challenge_id },
    });
    expect(challenge.attempts).toBe(5);
    expect(challenge.used_at).not.toBeNull();
  });
  it('a recovery code is consumed once and cannot be reused for a later login', async () => {
    const start = async () =>
      (
        await request(app.getHttpServer())
          .post('/api/v1/platform/auth/login')
          .send({ username: platformName, password })
          .expect(200)
      ).body;
    const first = await start();
    await request(app.getHttpServer())
      .post('/api/v1/platform/auth/mfa/verify')
      .send({ challenge_id: first.challenge_id, code: recoveryCode })
      .expect(200);
    const second = await start();
    await request(app.getHttpServer())
      .post('/api/v1/platform/auth/mfa/verify')
      .send({ challenge_id: second.challenge_id, code: recoveryCode })
      .expect(401);
    expect(
      (
        await db.platformUser.findUniqueOrThrow({
          where: { id: platformUserId },
        })
      ).mfa_recovery_hashes,
    ).toHaveLength(7);
  });
  it('operator MFA recovery requires maintenance ownership, audits reset and revokes sessions', async () => {
    const previous = await db.platformUser.findUniqueOrThrow({
      where: { id: platformUserId },
      include: { roles: { include: { role: true } } },
    });
    const cli = path.resolve('scripts/platform-mfa-reset.cjs');
    const denied = spawnSync(
      process.execPath,
      [cli, platformName, 'Disposable lost-device recovery drill'],
      {
        env: {
          ...process.env,
          EVOLIX_MAINTENANCE_DATABASE_URL: process.env.DATABASE_URL!,
        },
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    expect(denied.status).toBe(1);
    const reset = spawnSync(
      process.execPath,
      [cli, platformName, 'Disposable lost-device recovery drill'],
      {
        env: { ...process.env, EVOLIX_MAINTENANCE_DATABASE_URL: originalUrl },
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    expect(reset.status).toBe(0);
    const user = await db.platformUser.findUniqueOrThrow({
      where: { id: platformUserId },
    });
    expect(user.mfa_secret_encrypted).toBeNull();
    expect(user.mfa_enabled_at).toBeNull();
    expect(user.mfa_recovery_hashes).toEqual([]);
    expect(
      await db.platformSession.count({
        where: { user_id: platformUserId, revoked_at: null },
      }),
    ).toBe(0);
    expect(
      await db.platformMfaChallenge.count({
        where: { user_id: platformUserId, used_at: null },
      }),
    ).toBe(0);
    expect(
      await db.platformAuditLog.count({
        where: { user_id: platformUserId, action: 'MFA_OPERATOR_RESET' },
      }),
    ).toBe(1);
    await expect(
      (app.get(PlatformAuthService) as any).issueSession(previous, {}, true),
    ).rejects.toThrow();
  });
  it('a password changed after verification cannot authorize a newly issued shop session', async () => {
    const before = await db.user.findUniqueOrThrow({
      where: { id: A.user.id },
    });
    await db.user.update({
      where: { id: A.user.id },
      data: { password_hash: await bcrypt.hash('Changed!Disposable765', 12) },
    });
    try {
      await expect(
        app.get(AuthService).loginUser(A.user.id, {}, before.password_hash),
      ).rejects.toThrow('Account changed during sign-in');
    } finally {
      await db.user.update({
        where: { id: A.user.id },
        data: { password_hash: before.password_hash },
      });
    }
  });
  it('ten concurrent bad Platform passwords lock the account without a lost counter update', async () => {
    const role = await db.platformRole.findUniqueOrThrow({
      where: { name: 'SUPER_ADMIN' },
    });
    const user = await db.platformUser.create({
      data: {
        username: 'lockout-' + suffix,
        display_name: 'Concurrent lockout probe',
        password_hash: await bcrypt.hash(password, 12),
        roles: { create: { role_id: role.id } },
      },
    });
    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/platform/auth/login')
          .send({ username: user.username, password: 'Wrong!Disposable765' }),
      ),
    );
    expect(attempts.every((attempt) => attempt.status === 401)).toBe(true);
    const saved = await db.platformUser.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(saved.is_locked).toBe(true);
    expect(saved.failed_login_count).toBe(10);
    await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({ username: user.username, password })
      .expect(401);
  });
});
