import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { GoogleIdentityService } from './google-identity.service';

describe('Google identity: real Google-library JWT verification with disposable signing certificate', () => {
  const previous = process.env.GOOGLE_CLIENT_ID;
  const audience = 'test-web-client.apps.googleusercontent.com';
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' });
  let service: GoogleIdentityService;
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = audience;
    service = new GoogleIdentityService();
    // Replace certificate transport only; the real official library verifies the JWT.
    (service as any).client.getFederatedSignonCertsAsync = async () => ({ certs: { disposable: publicKey } });
  });
  afterEach(() => { if (previous === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = previous; });
  const token = (patch: Record<string, unknown> = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'disposable', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: audience, sub: 'google-subject', iat: now, exp: now + 600,
      email: 'owner@gmail.com', email_verified: true, nonce: 'disposable-challenge', ...patch })).toString('base64url');
    const signed = header + '.' + payload;
    return signed + '.' + sign('RSA-SHA256', Buffer.from(signed), keys.privateKey).toString('base64url');
  };
  it('accepts a verified signed identity with matching audience and nonce', async () => {
    expect(await service.verify(token())).toEqual({ subject: 'google-subject', email: 'owner@gmail.com', nonce: 'disposable-challenge', emailAuthoritative: true });
  });
  it('reads and trims the owner name only from a verified signed credential', async () => {
    expect((await service.verify(token({name:'  Aamir Khan  '}))).displayName).toBe('Aamir Khan');
    expect((await service.verify(token({name:'A'.repeat(300)}))).displayName).toHaveLength(255);
    expect((await service.verify(token({name:123}))).displayName).toBeUndefined();
  });
  it.each([
    ['wrong audience', { aud: 'attacker.apps.googleusercontent.com' }],
    ['wrong issuer', { iss: 'https://attacker.invalid' }],
    ['expired credential', { iat: Math.floor(Date.now() / 1000) - 2000, exp: Math.floor(Date.now() / 1000) - 1000 }],
    ['unverified email', { email_verified: false }],
    ['missing nonce', { nonce: undefined }],
  ])('rejects %s', async (_name, patch) => { await expect(service.verify(token(patch))).rejects.toThrow('could not be verified'); });
  it('rejects a modified payload without a valid signature', async () => {
    const parts = token().split('.'); parts[1] = Buffer.from(JSON.stringify({ sub: 'attacker' })).toString('base64url');
    await expect(service.verify(parts.join('.'))).rejects.toThrow('could not be verified');
  });
  it('reports NOT CONFIGURED without an OAuth client', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    await expect(service.verify(token())).rejects.toThrow('NOT CONFIGURED');
  });
  it('does not treat a third-party Google email as authoritative for recovery', async () => {
    expect((await service.verify(token({ email: 'owner@third-party.invalid' }))).emailAuthoritative).toBe(false);
  });
});
