import { Injectable, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { throttleSensitiveAuth } from './sensitive-auth-throttle';
import { validatePassword } from './password-policy';

@Injectable()
export class PlatformPasswordService {
  constructor(private readonly prisma: PrismaService) {}
  async change(userId: string, currentPassword: string, password: string) {
    await throttleSensitiveAuth('platform-password:' + userId, 10);
    validatePassword(password);
    if (password.length < 16) throw new BadRequestException('Platform administrator passwords need at least 16 characters.');
    if (!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||! /[^a-zA-Z0-9]/.test(password)) throw new BadRequestException('Platform administrator passwords need uppercase, lowercase, a number and a symbol.');
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM platform_users WHERE id=${userId}::uuid FOR UPDATE`;
      const user = await tx.platformUser.findUnique({ where: { id: userId } });
      if (!user?.is_active || user.is_locked || !await bcrypt.compare(currentPassword, user.password_hash)) throw new BadRequestException('Current password is incorrect.');
      if (await bcrypt.compare(password, user.password_hash)) throw new BadRequestException('Choose a different password.');
      await tx.platformUser.update({ where: { id: userId }, data: { password_hash: await bcrypt.hash(password, 12), failed_login_count: 0 } });
      await tx.platformSession.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: new Date() } });
      await tx.platformAuditLog.create({ data: { user_id: userId, action: 'PASSWORD_CHANGE', resource_type: 'PlatformUser', resource_id: userId } });
      return { success: true, message: 'Password changed. Sign in again on each device.' };
    }, { timeout: 30_000 });
  }
}
