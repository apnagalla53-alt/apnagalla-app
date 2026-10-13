import {
  Injectable,
  UnauthorizedException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { throttleLogin } from '../../auth/login-throttle';
import {
  PlatformMfaService,
  platformMfaRequired,
} from './platform-mfa.service';

@Injectable()
export class PlatformAuthService implements OnModuleInit {
  private readonly logger = new Logger(PlatformAuthService.name);
  private readonly invalidPasswordHash = bcrypt.hash(
    randomBytes(32).toString('hex'),
    12,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mfa: PlatformMfaService,
  ) {}

  async onModuleInit() {
    await this.bootstrapSuperAdmin();
  }

  private async bootstrapSuperAdmin() {
    try {
      const superAdminRole = await this.prisma.platformRole.upsert({
        where: { name: 'SUPER_ADMIN' },
        update: {},
        create: {
          name: 'SUPER_ADMIN',
          description: 'Master platform administrator',
          system_role: true,
        },
      });

      const existingAdmin = await this.prisma.platformUser.findUnique({
        where: { username: 'superadmin' },
      });

      if (
        !existingAdmin &&
        process.env.NODE_ENV !== 'production' &&
        process.env.PLATFORM_BOOTSTRAP_PASSWORD
      ) {
        const passwordHash = await bcrypt.hash(
          process.env.PLATFORM_BOOTSTRAP_PASSWORD,
          12,
        );
        const admin = await this.prisma.platformUser.create({
          data: {
            username: 'superadmin',
            display_name: 'Super Admin',
            password_hash: passwordHash,
            roles: {
              create: [{ role_id: superAdminRole.id }],
            },
          },
        });
        this.logger.log(
          `Bootstrap completed. Platform Super Admin user created: ${admin.username}`,
        );
      }
    } catch (e) {
      this.logger.error(
        JSON.stringify({
          event: 'platform_bootstrap_failed',
          error_type: e?.constructor?.name || 'Error',
        }),
      );
    }
  }

  async login(
    username: string,
    password: string,
    context: { ip?: string; userAgent?: string; deviceId?: string } = {},
  ): Promise<any> {
    await throttleLogin(`platform:${context.ip || 'local'}`);
    const user = await this.prisma.platformUser.findUnique({
      where: { username },
      include: { roles: { include: { role: true } } },
    });

    if (
      !user ||
      !user.is_active ||
      user.is_locked ||
      !user.roles.some((r) => r.role.name === 'SUPER_ADMIN')
    ) {
      await bcrypt.compare(password, await this.invalidPasswordHash);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM platform_users WHERE id=${user.id}::uuid FOR UPDATE`;
        const current = await tx.platformUser.findUniqueOrThrow({
          where: { id: user.id },
        });
        await tx.platformUser.update({
          where: { id: user.id },
          data: {
            failed_login_count: { increment: 1 },
            is_locked: current.is_locked || current.failed_login_count >= 9,
          },
        });
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (platformMfaRequired()) return this.mfa.start(user, context);
    return this.issueSession(user, context, false);
  }
  async verifyMfa(challengeId: string, code: string, ip?: string) {
    const verified = await this.mfa.verify(challengeId, code, ip);
    return {
      ...(await this.issueSession(verified.user, verified.context, true)),
      ...(verified.recoveryCodes.length
        ? { recovery_codes: verified.recoveryCodes }
        : {}),
    };
  }
  private async issueSession(
    user: any,
    context: { ip?: string; userAgent?: string; deviceId?: string },
    mfaVerified: boolean,
  ) {
    const now = new Date();
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM platform_users WHERE id=${user.id}::uuid FOR UPDATE`;
      const current = await tx.platformUser.findUniqueOrThrow({
        where: { id: user.id },
        include: { roles: { include: { role: true } } },
      });
      if (
        !current.is_active ||
        current.is_locked ||
        current.password_hash !== user.password_hash ||
        !current.roles.some((r) => r.role.name === 'SUPER_ADMIN') ||
        (mfaVerified &&
          (!current.mfa_enabled_at ||
            current.mfa_secret_encrypted !== user.mfa_secret_encrypted))
      )
        throw new UnauthorizedException(
          'Account changed during sign-in. Please sign in again.',
        );
      user = current;
      if (context.deviceId)
        await tx.platformSession.updateMany({
          where: {
            user_id: user.id,
            device_id: context.deviceId,
            revoked_at: null,
          },
          data: { revoked_at: now },
        });
      await tx.platformUser.update({
        where: { id: user.id },
        data: {
          last_login_at: now,
          last_active_at: now,
          failed_login_count: 0,
        },
      });
      const session = await tx.platformSession.create({
        data: {
          user_id: user.id,
          expires_at: new Date(now.getTime() + 86400_000),
          device_id: context.deviceId,
          ip_address: context.ip?.slice(0, 45),
          user_agent: context.userAgent?.slice(0, 512),
        },
      });
      await tx.platformAuditLog.create({
        data: {
          user_id: user.id,
          action: 'LOGIN',
          resource_type: 'PlatformSession',
          resource_id: session.id,
        },
      });
      return session;
    });

    const payload = {
      sub: user.id,
      sid: session.id,
      username: user.username,
      is_platform: true,
      mfa_verified: mfaVerified,
      roles: user.roles.map((r: any) => r.role.name),
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        username: user.username,
        name: user.display_name,
        display_name: user.display_name,
        is_platform: true,
      },
    };
  }

  async logout(userId: string, sessionId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.platformSession.updateMany({
        where: { id: sessionId, user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      await tx.platformAuditLog.create({
        data: {
          user_id: userId,
          action: 'LOGOUT',
          resource_type: 'PlatformSession',
          resource_id: sessionId,
        },
      });
      return { success: true };
    });
  }
}
