import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { jwtSecret } from './jwt-secret';

export const sessionCookie = (platform = false) =>
  platform ? 'evolix_platform_session' : 'evolix_shop_session';
export function cookies(req: any): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const equal = part.indexOf('=');
    if (equal < 1) continue;
    try {
      result[part.slice(0, equal).trim()] = decodeURIComponent(
        part.slice(equal + 1).trim(),
      );
    } catch {
      /* malformed cookies grant no access */
    }
  }
  return result;
}
export function allowedBrowserOrigin(origin: string): boolean {
  if (origin === process.env.FRONTEND_ORIGIN) return true;
  if (process.env.WEBSITE_ORIGIN && origin === process.env.WEBSITE_ORIGIN) return true;
  if (
    origin === 'https://localhost' &&
    process.env.ANDROID_APP_ENABLED === 'true'
  )
    return true;
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const url = new URL(origin);
    const configured = [process.env.FRONTEND_ORIGIN || 'http://localhost:5173',process.env.WEBSITE_ORIGIN].filter(Boolean).map(value=>new URL(value!).port);
    const privateHost =
      /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
        url.hostname,
      );
    return (
      privateHost &&
      url.protocol === 'http:' &&
      configured.includes(url.port) &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
/** Only the retailer session is shared between the explicitly configured website and app. */
export function retailerCookieDomain(platform = false) {
  return platform ? undefined : process.env.RETAIL_COOKIE_DOMAIN || undefined;
}
export function csrfForSession(sid: string, platform = false) {
  return createHmac('sha256', jwtSecret(platform))
    .update('EVOLIX_CSRF:' + sid)
    .digest('hex');
}
export function requestToken(req: any, platform = false): string {
  const header = req.headers.authorization;
  if (
    typeof header === 'string' &&
    header.startsWith('Bearer ') &&
    header !== 'Bearer cookie'
  ) {
    req.sessionTransport = 'bearer';
    return header.slice(7);
  }
  const token = cookies(req)[sessionCookie(platform)];
  if (!token) throw new UnauthorizedException('Sign in to continue.');
  req.sessionTransport = 'cookie';
  return token;
}
export function verifyCookieCsrf(req: any, sid: string, platform = false) {
  if (
    req.sessionTransport !== 'cookie' ||
    ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
  )
    return;
  const origin = req.headers.origin;
  if (origin && !allowedBrowserOrigin(origin))
    throw new ForbiddenException('This request origin is not allowed.');
  const supplied = req.headers['x-csrf-token'],
    expected = csrfForSession(sid, platform);
  if (
    typeof supplied !== 'string' ||
    !/^[0-9a-f]{64}$/.test(supplied) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    throw new ForbiddenException(
      'Refresh the page before submitting. Security token is missing or invalid.',
    );
}
