import { randomBytes, createHmac } from 'crypto';

const localSecret = randomBytes(48).toString('hex');
export function jwtSecret(platform = false): string {
  if(platform && process.env.PLATFORM_JWT_SECRET) return process.env.PLATFORM_JWT_SECRET;
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be configured in production');
  const base = secret || localSecret;
  return platform ? createHmac('sha256', base).update('EVOLIX_PLATFORM_AUTH').digest('hex') : base;
}
