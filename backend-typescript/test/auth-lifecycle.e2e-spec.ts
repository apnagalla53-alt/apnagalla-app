import { Test } from '@nestjs/testing';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantProvisioningService } from '../src/platform/provisioning/tenant-provisioning.service';
import { AuthEmailService } from '../src/auth/auth-email.service';
import { GoogleIdentityService, VerifiedGoogleIdentity } from '../src/auth/google-identity.service';
import { authTokenHash } from '../src/auth/password-lifecycle.service';

describe('Authentication lifecycle: HTTP, real isolated DB, deterministic external delivery boundary', () => {
  let app: INestApplication, db: PrismaService, A: any, B: any, tokenA: string, tokenB: string;
  const suffix = randomUUID(); const password = 'Disposable!Auth765'; const newPassword = 'Changed!Auth98765';
  let emailConfigured = true;
  const emails: { type: string; email: string; token: string }[] = [];
  const emailProvider = { isConfigured: () => emailConfigured,
    sendPasswordReset: async (email: string, token: string) => { emails.push({ type: 'reset', email, token }); },
    sendEmailVerification: async (email: string, token: string) => { emails.push({ type: 'verify', email, token }); } };
  const identityProvider = { clientId: () => 'disposable.apps.googleusercontent.com', verify: async (credential: string): Promise<VerifiedGoogleIdentity> => JSON.parse(credential) };
  const call = (method: string, path: string, shop = A, token = tokenA) => (request(app.getHttpServer()) as any)[method]('/api/v1/' + path)
    .set('Authorization', 'Bearer ' + token).set('X-Company-Id', shop.company.id).set('X-Branch-Id', shop.branch.id);
  const login = async (shop = A, pass = password) => (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: shop.user.username, password: pass }).expect(200)).body;
  const credential = (nonce: string, subject = 'google-' + suffix, email = 'verified@gmail.com') => JSON.stringify({ nonce, subject, email, emailAuthoritative: email.endsWith('@gmail.com') });
  const publicChallenge = async () => (await request(app.getHttpServer()).post('/api/v1/auth/google/challenge').send({}).expect(201)).body;
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(AuthEmailService).useValue(emailProvider)
      .overrideProvider(GoogleIdentityService).useValue(identityProvider).compile();
    app = fixture.createNestApplication(); app.setGlobalPrefix('api/v1', { exclude: [{ path: 'api/v1/{*path}', method: RequestMethod.ALL }] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })); await app.init(); db = app.get(PrismaService);
    const provision = (name: string) => app.get(TenantProvisioningService).provisionTenant({ organizationName: name, adminEmail: name + '@test.invalid', adminName: 'Owner', adminPassword: password });
    A = await provision('auth-a-' + suffix); B = await provision('auth-b-' + suffix);
    tokenA = (await login(A)).access_token; tokenB = (await login(B)).access_token;
  });
  afterAll(async () => { if (app) await app.close(); });

  it('publishes capabilities without provider secrets and security exposes only own connection state', async () => {
    const capabilities = (await request(app.getHttpServer()).get('/api/v1/auth/capabilities').expect(200)).body;
    expect(Object.keys(capabilities).sort()).toEqual(['google_client_id', 'mobile_otp_configured', 'password_recovery_configured', 'payment_provider_configured']);
    expect((await call('get', 'auth/security').expect(200)).body.google_connected).toBe(false);
    await call('get', 'auth/security').set('X-Company-Id', B.company.id).expect(403);
  });
  it('requires explicit password linking instead of taking over an email-matched account', async () => {
    const challenge = await publicChallenge();
    const response = await request(app.getHttpServer()).post('/api/v1/auth/google/login').send({ challenge_id: challenge.challenge_id, credential: credential(challenge.nonce, 'unlinked-' + suffix, A.user.email) }).expect(401);
    expect(response.body.code).toBe('GOOGLE_ACCOUNT_NOT_REGISTERED');
    expect((await db.user.findUnique({ where: { id: A.user.id } }))!.google_subject).toBeNull();
  });
  it('rejects nonce substitution, expired challenge and replay without creating a session', async () => {
    const before = await db.session.count({ where: { user_id: A.user.id } });
    const challenge = await publicChallenge();
    await request(app.getHttpServer()).post('/api/v1/auth/google/login').send({ challenge_id: challenge.challenge_id, credential: credential('wrong-nonce') }).expect(401);
    await db.authToken.update({ where: { id: challenge.challenge_id }, data: { expires_at: new Date(Date.now() - 1000) } });
    await request(app.getHttpServer()).post('/api/v1/auth/google/login').send({ challenge_id: challenge.challenge_id, credential: credential(challenge.nonce) }).expect(401);
    expect(await db.session.count({ where: { user_id: A.user.id } })).toBe(before);
  });
  it('password-verifies linking and enforces challenge purpose/user/unique subject across tenants', async () => {
    const challenge = (await call('post', 'auth/google/link-challenge').send({}).expect(201)).body;
    const body = { challenge_id: challenge.challenge_id, credential: credential(challenge.nonce), current_password: 'wrong' };
    await call('post', 'auth/google/link').send(body).expect(400);
    await call('post', 'auth/google/link', B, tokenB).send({ ...body, current_password: password }).expect(401);
    await call('post', 'auth/google/link').send({ ...body, current_password: password }).expect(201);
    await call('post', 'auth/google/link').send({ ...body, current_password: password }).expect(401);
    const other = (await call('post', 'auth/google/link-challenge', B, tokenB).send({}).expect(201)).body;
    await call('post', 'auth/google/link', B, tokenB).send({ challenge_id: other.challenge_id, credential: credential(other.nonce), current_password: password }).expect(409);
    expect((await db.user.findUnique({ where: { id: A.user.id } }))!.email_verified_at).not.toBeNull();
  });
  it('logs in the linked subject once with tenant-only authority and rejects Platform access', async () => {
    const challenge = await publicChallenge();
    const body = { challenge_id: challenge.challenge_id, credential: credential(challenge.nonce) };
    const response = (await request(app.getHttpServer()).post('/api/v1/auth/google/login').send(body).expect(200)).body;
    expect(response.user.id).toBe(A.user.id); expect(response.tenant_context.company_id).toBe(A.company.id);
    await call('get', 'platform/admin/tenants', A, response.access_token).expect(401);
    await request(app.getHttpServer()).post('/api/v1/auth/google/login').send(body).expect(401);
  });
  it('Google unlink requires password and revokes every device session', async () => {
    await call('post', 'auth/google/unlink').send({ current_password: 'wrong' }).expect(400);
    await call('post', 'auth/google/unlink').send({ current_password: password }).expect(201);
    await call('get', 'auth/security').expect(401);
    expect(await db.session.count({ where: { user_id: A.user.id, revoked_at: null } })).toBe(0);
    tokenA = (await login()).access_token;
  });
  it('returns NOT CONFIGURED without pretending a recovery email was delivered', async () => {
    emailConfigured = false;
    await request(app.getHttpServer()).post('/api/v1/auth/password/forgot').send({ identifier: A.user.username }).expect(503);
    emailConfigured = true;
  });
  it('unknown/unverified accounts return the same response and send no reset email', async () => {
    const before = emails.length;
    const unknown = (await request(app.getHttpServer()).post('/api/v1/auth/password/forgot').send({ identifier: 'missing-' + suffix }).expect(200)).body;
    const unverified = (await request(app.getHttpServer()).post('/api/v1/auth/password/forgot').send({ identifier: B.user.username }).expect(200)).body;
    expect(unknown).toEqual(unverified); expect(emails.length).toBe(before);
  });
  it('recovery email verification is password-protected, hashed, single use and invalidates stale reset links', async () => {
    await call('post', 'auth/email/request-verification').send({ email: 'new-' + suffix + '@test.invalid', current_password: 'wrong' }).expect(400);
    await call('post', 'auth/email/request-verification').send({ email: 'new-' + suffix + '@test.invalid', current_password: password }).expect(201);
    const sent = emails[emails.length - 1];
    const stored = await db.authToken.findUnique({ where: { token_hash: authTokenHash(sent.token) } });
    expect(stored?.purpose).toBe('EMAIL_VERIFY'); expect(stored?.token_hash).not.toBe(sent.token);
    await request(app.getHttpServer()).post('/api/v1/auth/email/verify').send({ token: sent.token }).expect(200);
    await request(app.getHttpServer()).post('/api/v1/auth/email/verify').send({ token: sent.token }).expect(400);
    expect((await call('get', 'auth/security').expect(200)).body.recovery_email_verified).toBe(true);
  });
  it('expired reset cannot change a password and newer reset replaces the prior link', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/password/forgot').send({ identifier: A.user.username }).expect(200);
    const first = emails[emails.length - 1];
    await db.authToken.update({ where: { token_hash: authTokenHash(first.token) }, data: { expires_at: new Date(Date.now() - 1000) } });
    await request(app.getHttpServer()).post('/api/v1/auth/password/reset').send({ token: first.token, password: newPassword }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/auth/password/forgot').send({ identifier: A.user.username }).expect(200);
    const second = emails[emails.length - 1];
    await request(app.getHttpServer()).post('/api/v1/auth/password/forgot').send({ identifier: A.user.username }).expect(200);
    expect((await db.authToken.findUnique({ where: { token_hash: authTokenHash(second.token) } }))!.used_at).not.toBeNull();
  });
  it('concurrent reset consumption has one winner, revokes sessions and rejects weak/reused passwords', async () => {
    const sent = emails[emails.length - 1];
    await request(app.getHttpServer()).post('/api/v1/auth/password/reset').send({ token: sent.token, password: 'weakpassword' }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/auth/password/reset').send({ token: sent.token, password }).expect(400);
    const responses = await Promise.all([1, 2].map(() => request(app.getHttpServer()).post('/api/v1/auth/password/reset').send({ token: sent.token, password: newPassword })));
    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
    await call('get', 'auth/security').expect(401);
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: A.user.username, password }).expect(401);
    tokenA = (await login(A, newPassword)).access_token;
  });
  it('self change is current-password protected, remembers prior passwords, revokes devices and is tenant-scoped', async () => {
    await call('post', 'auth/password/change').send({ current_password: 'wrong', password: 'Another!Auth654321' }).expect(400);
    await call('post', 'auth/password/change').set('X-Company-Id', B.company.id).send({ current_password: newPassword, password: 'Another!Auth654321' }).expect(403);
    await call('post', 'auth/password/change').send({ current_password: newPassword, password }).expect(400);
    await call('post', 'auth/password/change').send({ current_password: newPassword, password: 'Another!Auth654321' }).expect(201);
    expect(await db.session.count({ where: { user_id: A.user.id, revoked_at: null } })).toBe(0);
    expect(await db.passwordHistory.count({ where: { user_id: A.user.id } })).toBe(2);
  });
  it('temporary-password session cannot use Retail until changing, and expiry fails login', async () => {
    await db.user.update({ where: { id: B.user.id }, data: { must_change_password: true, temporary_password_expires_at: new Date(Date.now() + 60_000) } });
    const session = await login(B); expect(session.user.must_change_password).toBe(true);
    await call('get', 'retail/items', B, session.access_token).expect(403);
    await call('post', 'auth/password/change', B, session.access_token).send({ current_password: password, password: 'Staff!Secure987654' }).expect(201);
    expect((await db.user.findUnique({ where: { id: B.user.id } }))!.must_change_password).toBe(false);
    await db.user.update({ where: { id: B.user.id }, data: { must_change_password: true, temporary_password_expires_at: new Date(Date.now() - 1000) } });
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: B.user.username, password: 'Staff!Secure987654' }).expect(401);
  });
  it('tenant token cannot change a Platform password; platform password changes revoke and audit sessions', async () => {
    await call('post', 'platform/auth/password/change').send({ current_password: password, password: 'Platform!Secure987654321' }).expect(401);
    const role = await db.platformRole.findUnique({ where: { name: 'SUPER_ADMIN' } });
    const operator = await db.platformUser.create({ data: { username: 'auth-platform-' + suffix, display_name: 'Disposable Operator', password_hash: await bcrypt.hash(password, 12), roles: { create: { role_id: role!.id } } } });
    const session = (await request(app.getHttpServer()).post('/api/v1/platform/auth/login').send({ username: operator.username, password }).expect(200)).body;
    await request(app.getHttpServer()).post('/api/v1/platform/auth/password/change').set('Authorization', 'Bearer ' + session.access_token).send({ current_password: password, password: 'Platform!Secure987654321' }).expect(201);
    expect(await db.platformSession.count({ where: { user_id: operator.id, revoked_at: null } })).toBe(0);
    expect(await db.platformAuditLog.count({ where: { user_id: operator.id, action: 'PASSWORD_CHANGE' } })).toBe(1);
  });
});
