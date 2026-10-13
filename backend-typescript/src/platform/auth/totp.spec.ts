import { describe, it, expect } from 'vitest';
import { newTotpSecret, totpCode } from './totp';
describe('TOTP RFC 6238 vectors', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  for (const [time, code] of [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ] as const)
    it('matches published SHA-1 vector at ' + time, () =>
      expect(totpCode(secret, BigInt(Math.floor(time / 30)), 8)).toBe(code),
    );
  it('generates independent 160-bit Base32 secrets', () => {
    const first = newTotpSecret();
    expect(first).toMatch(/^[A-Z2-7]{32}$/);
    expect(newTotpSecret()).not.toBe(first);
  });
});
