import { createHmac, randomBytes } from 'node:crypto';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newTotpSecret() {
  let bits = 0,
    value = 0,
    result = '';
  for (const byte of randomBytes(20)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return result;
}
function decode(secret: string) {
  let bits = 0,
    value = 0;
  const bytes: number[] = [];
  for (const character of secret) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw Error('Invalid authenticator key');
    value = (value << 5) | digit;
    bits += 5;
    while (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
/** RFC 6238 SHA-1 / 30 seconds. Counter returned for atomic replay protection. */
export function totpCode(secret: string, counter: bigint, digits = 6) {
  const time = Buffer.alloc(8);
  time.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', decode(secret)).update(time).digest(),
    offset = digest[19] & 15;
  return String(
    (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits,
  ).padStart(digits, '0');
}
export function matchingCounter(
  secret: string,
  code: string,
  now = Date.now(),
): bigint | null {
  if (!/^\d{6}$/.test(code)) return null;
  const counter = BigInt(Math.floor(now / 30000));
  for (const adjustment of [0n, -1n, 1n])
    if (
      counter + adjustment >= 0n &&
      totpCode(secret, counter + adjustment) === code
    )
      return counter + adjustment;
  return null;
}
