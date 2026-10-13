import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { jwtSecret } from './jwt-secret';
import { requestToken, verifyCookieCsrf } from './browser-session';

/** Existing user/session JWTs, without a company requirement during onboarding. */
@Injectable()
export class AccountSessionGuard implements CanActivate {
  constructor(
    private db: PrismaService,
    private jwt: JwtService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const token = requestToken(req);
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: jwtSecret(),
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Sign in again to continue.');
    }
    if (payload.is_platform)
      throw new UnauthorizedException('A customer account is required.');
    const now = new Date();
    const session =
      payload.sid &&
      (await this.db.session.findFirst({
        where: {
          id: payload.sid,
          user_id: payload.sub,
          revoked_at: null,
          expires_at: { gt: now },
        },
        include: { user: true },
      }));
    if (!session || !session.user.is_active || session.user.is_locked)
      throw new UnauthorizedException('Account session expired or revoked.');
    verifyCookieCsrf(req, session.id);
    if (session.user.must_change_password && !(req.method === 'GET' && req.path.endsWith('/auth/session')))
      throw new ForbiddenException(
        'Change your temporary password before continuing.',
      );
    req.account = {
      id: session.user.id,
      session_id: session.id,
      issued_at: session.issued_at,
      organization_id: session.user.organization_id,
    };
    // Onboarding may write the authenticated owner's migration preference before
    // Retail access is READY. Resolve this scope from membership, never headers.
    if (session.user.organization_id) {
      const memberships = await this.db.userRole.findMany({
        where: { user_id: session.user.id, company_id: { not: null } },
      });
      const company = await this.db.company.findFirst({
        where: {
          id: { in: memberships.map((member) => member.company_id!) },
          organization_id: session.user.organization_id,
        },
      });
      if (company) this.db.authorizeTenant(company.id);
    }
    return true;
  }
}
