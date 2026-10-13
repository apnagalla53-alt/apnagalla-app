import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { AuthEmailService } from './auth-email.service';
import { validatePassword } from './password-policy';
import { throttleSensitiveAuth } from './sensitive-auth-throttle';
import { auditIdentityChange } from './auth-audit';

export const authTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const RESET_MESSAGE = 'If this account has a verified recovery email, a reset link will arrive shortly.';

@Injectable()
export class PasswordLifecycleService {
  constructor(private readonly prisma: PrismaService, private readonly email: AuthEmailService) {}

  async requestReset(identifier: string, ip = 'local') {
    await throttleSensitiveAuth('reset-ip:' + ip, 10);
    await throttleSensitiveAuth('reset-account:' + authTokenHash(identifier.toLowerCase().trim()));
    if (!this.email.isConfigured()) throw new ServiceUnavailableException('Password recovery email is NOT CONFIGURED. Contact your shop administrator.');
    const normalized = identifier.trim();
    const users = await this.prisma.user.findMany({ where: { OR: [{ username: normalized }, { email: { equals: normalized, mode: 'insensitive' } }] }, take: 2 });
    // An email shared by two staff accounts cannot choose either account implicitly.
    const exactUsername = users.find(user => user.username === normalized);
    const user = exactUsername || (users.length === 1 ? users[0] : null);
    if (!user?.is_active || !user.email || !user.email_verified_at) return { message: RESET_MESSAGE };
    const token = randomBytes(32).toString('base64url');
    const record = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (!current?.is_active || !current.email_verified_at || current.email !== user.email) return null;
      await tx.authToken.updateMany({ where: { user_id: user.id, purpose: 'PASSWORD_RESET', used_at: null }, data: { used_at: new Date() } });
      return tx.authToken.create({ data: { user_id: user.id, purpose: 'PASSWORD_RESET', token_hash: authTokenHash(token), expires_at: new Date(Date.now() + 20 * 60_000) } });
    });
    if (!record) return { message: RESET_MESSAGE };
    try { await this.email.sendPasswordReset(user.email, token); }
    catch (error) { await this.prisma.authToken.deleteMany({ where: { id: record.id } }); throw error; }
    return { message: RESET_MESSAGE };
  }

  async resetPassword(token: string, password: string, ip = 'local') {
    await throttleSensitiveAuth('reset-consume:' + ip, 20);
    validatePassword(password);
    return this.prisma.$transaction(async tx => {
      const now = new Date();
      const record = await tx.authToken.findUnique({ where: { token_hash: authTokenHash(token) } });
      if (!record?.user_id || record.purpose !== 'PASSWORD_RESET' || record.used_at || record.expires_at <= now) throw new BadRequestException('This reset link expired or has already been used. Request a new link.');
      await tx.$queryRaw`SELECT id FROM users WHERE id=${record.user_id}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: record.user_id } });
      if (!user?.is_active) throw new BadRequestException('This reset link is invalid.');
      const consumed = await tx.authToken.updateMany({ where: { id: record.id, used_at: null, expires_at: { gt: now } }, data: { used_at: now } });
      if (consumed.count !== 1) throw new BadRequestException('This reset link expired or has already been used. Request a new link.');
      await this.ensureUnusedPassword(tx, user.id, user.password_hash, password);
      await this.replacePassword(tx, user.id, user.password_hash, password, now);
      await auditIdentityChange(tx, user.id, 'PASSWORD_RESET');
      return { success: true, message: 'Password changed. Sign in again on each device.' };
    }, { timeout: 30_000 });
  }

  async changePassword(userId: string, currentPassword: string, password: string) {
    await throttleSensitiveAuth('change-password:' + userId, 10);
    validatePassword(password);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user?.is_active || !await bcrypt.compare(currentPassword, user.password_hash)) throw new BadRequestException('Current password is incorrect.');
      await this.ensureUnusedPassword(tx, user.id, user.password_hash, password);
      await this.replacePassword(tx, user.id, user.password_hash, password, new Date());
      await auditIdentityChange(tx, user.id, 'PASSWORD_CHANGE');
      return { success: true, message: 'Password changed. Sign in again on each device.' };
    }, { timeout: 30_000 });
  }

  async requestEmailVerification(userId: string, email: string, currentPassword: string) {
    await throttleSensitiveAuth('verify-email:' + userId);
    if (!this.email.isConfigured()) throw new ServiceUnavailableException('Recovery email verification is NOT CONFIGURED. Contact your shop administrator.');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.is_active || !await bcrypt.compare(currentPassword, user.password_hash)) throw new BadRequestException('Current password is incorrect.');
    const token = randomBytes(32).toString('base64url');
    const record = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (!current?.is_active || current.password_hash !== user.password_hash) throw new BadRequestException('Your password changed. Please sign in again.');
      await tx.authToken.updateMany({ where: { user_id: user.id, purpose: 'EMAIL_VERIFY', used_at: null }, data: { used_at: new Date() } });
      return tx.authToken.create({ data: { user_id: user.id, purpose: 'EMAIL_VERIFY', pending_email: email.trim().toLowerCase(), token_hash: authTokenHash(token), expires_at: new Date(Date.now() + 20 * 60_000) } });
    });
    try { await this.email.sendEmailVerification(email.trim().toLowerCase(), token); }
    catch (error) { await this.prisma.authToken.deleteMany({ where: { id: record.id } }); throw error; }
    return { message: 'Verification link sent. Open it to enable password recovery.' };
  }

  async verifyEmail(token: string, ip = 'local') {
    await throttleSensitiveAuth('verify-email-consume:' + ip, 20);
    return this.prisma.$transaction(async tx => {
      const now = new Date();
      const record = await tx.authToken.findUnique({ where: { token_hash: authTokenHash(token) } });
      if (!record?.user_id || !record.pending_email || record.purpose !== 'EMAIL_VERIFY' || record.used_at || record.expires_at <= now) throw new BadRequestException('This verification link expired or has already been used.');
      await tx.$queryRaw`SELECT id FROM users WHERE id=${record.user_id}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: record.user_id } });
      if (!user?.is_active) throw new BadRequestException('This verification link is invalid.');
      const consumed = await tx.authToken.updateMany({ where: { id: record.id, used_at: null, expires_at: { gt: now } }, data: { used_at: now } });
      if (consumed.count !== 1) throw new BadRequestException('This verification link expired or has already been used.');
      await tx.user.update({ where: { id: record.user_id }, data: { email: record.pending_email, email_verified_at: now } });
      await tx.authToken.updateMany({ where: { user_id: record.user_id, purpose: 'PASSWORD_RESET', used_at: null }, data: { used_at: now } });
      await auditIdentityChange(tx, record.user_id, 'RECOVERY_EMAIL_VERIFIED');
      return { success: true, message: 'Recovery email verified. You can now reset your password by email.' };
    });
  }

  private async ensureUnusedPassword(tx: any, userId: string, previousHash: string, password: string) {
    const history = await tx.passwordHistory.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, take: 4 });
    if ((await Promise.all([previousHash, ...history.map((record: any) => record.password_hash)].map(hash => bcrypt.compare(password, hash)))).some(Boolean)) throw new BadRequestException('Choose a password you have not used recently.');
  }

  private async replacePassword(tx: any, userId: string, previousHash: string, password: string, now: Date) {
    const hash = await bcrypt.hash(password, 12);
    await tx.passwordHistory.create({ data: { user_id: userId, password_hash: previousHash } });
    await tx.user.update({ where: { id: userId }, data: { password_hash: hash, password_login_enabled:true, password_changed_at: now, must_change_password: false, temporary_password_expires_at: null, is_locked: false, failed_login_count: 0 } });
    await tx.session.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: now } });
    await tx.authToken.updateMany({ where: { user_id: userId, used_at: null }, data: { used_at: now } });
  }
}
