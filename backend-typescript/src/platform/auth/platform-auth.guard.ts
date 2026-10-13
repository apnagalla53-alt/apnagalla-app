import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { jwtSecret } from '../../auth/jwt-secret';
import {requestToken,verifyCookieCsrf} from '../../auth/browser-session';
import {platformMfaRequired} from './platform-mfa.service';

export interface PlatformRequest extends Request {
  user?: any;
  platformUser?: any;
}

@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PlatformRequest>();
    const token = requestToken(request,true);
    
    if (!token) {
      throw new UnauthorizedException('Missing platform authentication token');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret(true), algorithms:['HS256'],
      });

      if (!payload.is_platform) {
        throw new UnauthorizedException('Token is not a platform token');
      }
      if(platformMfaRequired()&&payload.mfa_verified!==true)throw new UnauthorizedException('Complete authenticator verification before using Platform administration.');

      const user = await this.prisma.platformUser.findUnique({
        where: { id: payload.sub },
        include: { roles: { include: { role: true } } }
      });

      if (!user || !user.is_active || user.is_locked || !user.roles.some(r => r.role.name === 'SUPER_ADMIN')) {
        throw new UnauthorizedException('Invalid platform user');
      }

      const session = payload.sid && await this.prisma.platformSession.findFirst({ where: {
        id: payload.sid, user_id: user.id, revoked_at: null, expires_at: { gt: new Date() },
      } });
      if (!session) throw new UnauthorizedException('Platform session expired or revoked');
      verifyCookieCsrf(request,session.id,true);
      if (Date.now() - session.last_active_at.getTime() > 60_000) {
        await this.prisma.$transaction([
          this.prisma.platformSession.update({ where: { id: session.id }, data: { last_active_at: new Date() } }),
          this.prisma.platformUser.update({ where: { id: user.id }, data: { last_active_at: new Date() } }),
        ]);
      }

      request['user'] = payload;
      request['platformUser'] = user;
      this.prisma.authorizePlatform();
    } catch (e) {
      if(e instanceof ForbiddenException)throw e;
      throw new UnauthorizedException('Invalid platform authentication token');
    }
    
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
