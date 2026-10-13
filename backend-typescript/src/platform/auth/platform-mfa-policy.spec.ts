import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { platformMfaRequired } from './platform-mfa.service';
import { validateEnvironment } from '../../common/environment';

afterEach(() => vi.unstubAllEnvs());

describe('Platform authenticator environment policy', () => {
  it.each([
    ['development', 'false', false],
    ['development', 'true', true],
    ['development', undefined, true],
    ['test', 'false', false],
    ['production', 'false', true],
    ['production', 'true', true],
    ['invalid', 'false', true],
  ])('%s / %s requires authenticator: %s', (mode, flag, expected) => {
    vi.stubEnv('NODE_ENV', mode!);
    vi.stubEnv('PLATFORM_MFA_REQUIRED', flag);
    expect(platformMfaRequired()).toBe(expected);
  });

  it('refuses an explicit production opt-out during startup validation', () => {
    expect(() => validateEnvironment({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://test.invalid/app',
      JWT_SECRET: randomBytes(48).toString('base64url'),
      PLATFORM_JWT_SECRET: randomBytes(48).toString('base64url'),
      PLATFORM_MFA_REQUIRED: 'false',
    })).toThrow('Platform MFA cannot be disabled in production');
  });
});
