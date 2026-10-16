import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { mergeMap } from 'rxjs';
import { jwtSecret } from './jwt-secret';
import {
  allowedBrowserOrigin,
  csrfForSession,
  sessionCookie,
  retailerCookieDomain,
} from './browser-session';

@Injectable()
export class BrowserSessionInterceptor implements NestInterceptor {
  constructor(private jwt: JwtService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest(),
      res = context.switchToHttp().getResponse();
    if (
      req.headers.origin &&
      !allowedBrowserOrigin(req.headers.origin) &&
      /^\/(?:platform\/)?auth\//.test(req.path.replace(/^\/api\/v1/, '')) &&
      req.method === 'POST'
    )
      throw new ForbiddenException('This sign-in origin is not allowed.');
    return next.handle().pipe(
      mergeMap(async (body: any) => {
        const browser =
          req.headers['x-evolix-client'] !== 'native' &&
          (req.headers['x-requested-with'] === 'XMLHttpRequest' ||
            req.headers.origin);
        if (browser && body?.access_token) {
          const platform = req.path.includes('/platform/'),
            payload = await this.jwt.verifyAsync(body.access_token, {
              secret: jwtSecret(platform),
              algorithms: ['HS256'],
            });
          const csrf = csrfForSession(payload.sid, platform),
            secure = process.env.NODE_ENV === 'production';
          const maxAge = Math.max(
            0,
            Math.min(platform ? 86400_000 : 365 * 86400_000, payload.exp * 1000 - Date.now()),
          );
          res.cookie(sessionCookie(platform), body.access_token, {
            domain: retailerCookieDomain(platform),
            httpOnly: true,
            secure,
            sameSite: 'strict',
            path: '/api/v1',
            maxAge,
          });
          res.cookie(
            platform ? 'evolix_platform_csrf' : 'evolix_shop_csrf',
            csrf,
            { domain: retailerCookieDomain(platform), httpOnly: false, secure, sameSite: 'strict', path: '/', maxAge },
          );
          const { access_token, ...safe } = body;
          return { ...safe, session_mode: 'cookie', csrf_token: csrf };
        }
        if (
          /\/auth\/(?:account\/)?logout$/.test(req.path) ||
          req.path.endsWith('/password/change')
        ) {
          const platform = req.path.includes('/platform/');
          res.clearCookie(sessionCookie(platform), {
            domain: retailerCookieDomain(platform),
            path: '/api/v1',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
          });
          res.clearCookie(
            platform ? 'evolix_platform_csrf' : 'evolix_shop_csrf',
            { domain: retailerCookieDomain(platform), path: '/' },
          );
        }
        return body;
      }),
    );
  }
}
