import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { throttleSensitiveAuth } from '../../auth/sensitive-auth-throttle';
import { matchingCounter, newTotpSecret } from './totp';
export function platformMfaRequired() {
  return !(
    ['development', 'test'].includes(process.env.NODE_ENV || 'development') &&
    process.env.PLATFORM_MFA_REQUIRED === 'false'
  );
}
const recoveryHash = (value: string) =>
  createHash('sha256').update(value.trim().toUpperCase()).digest('hex');
@Injectable()
export class PlatformMfaService {
  constructor(private db: PrismaService) {}
  private key() {
    const key = Buffer.from(process.env.MFA_ENCRYPTION_KEY || '', 'base64');
    if (key.length !== 32)
      throw new ServiceUnavailableException(
        'Platform authenticator encryption must be configured.',
      );
    return key;
  }
  private encrypt(secret: string, userId: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    cipher.setAAD(Buffer.from(userId));
    const bytes = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), bytes]
      .map((b) => b.toString('base64'))
      .join('.');
  }
  private decrypt(value: string, userId: string) {
    const [iv, tag, bytes] = value
      .split('.')
      .map((b) => Buffer.from(b, 'base64'));
    const cipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    cipher.setAAD(Buffer.from(userId));
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(bytes), cipher.final()]).toString(
      'utf8',
    );
  }
  async start(
    user: any,
    context: { deviceId?: string; ip?: string; userAgent?: string },
  ) {
    await throttleSensitiveAuth('platform-mfa-start:' + user.id, 10);
    let enroll = false,
      secret: string | null = null;
    const challenge = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM platform_users WHERE id=${user.id}::uuid FOR UPDATE`;
      const current = await tx.platformUser.findUniqueOrThrow({
        where: { id: user.id },
      });
      if (
        !current.is_active ||
        current.is_locked ||
        current.password_hash !== user.password_hash
      )
        throw new UnauthorizedException('Account is unavailable.');
      enroll = !current.mfa_enabled_at;
      secret = enroll ? newTotpSecret() : null;
      await tx.platformMfaChallenge.deleteMany({
        where: { expires_at: { lt: new Date(Date.now() - 86400000) } },
      });
      await tx.platformMfaChallenge.updateMany({
        where: { user_id: user.id, used_at: null },
        data: { used_at: new Date() },
      });
      return tx.platformMfaChallenge.create({
        data: {
          user_id: user.id,
          purpose: enroll ? 'ENROLL' : 'VERIFY',
          secret_encrypted: secret ? this.encrypt(secret, user.id) : null,
          expires_at: new Date(Date.now() + 300000),
          device_id: context.deviceId,
          ip_address: context.ip?.slice(0, 45),
          user_agent: context.userAgent?.slice(0, 512),
        },
      });
    });
    return {
      mfa_required: true,
      challenge_id: challenge.id,
      enrollment_required: enroll,
      ...(secret
        ? {
            authenticator_uri:
              'otpauth://totp/' +
              encodeURIComponent('EVOLIX Platform:' + user.username) +
              '?' +
              new URLSearchParams({
                secret,
                issuer: 'EVOLIX Platform',
                algorithm: 'SHA1',
                digits: '6',
                period: '30',
              }).toString(),
          }
        : {}),
      expires_in: 300,
    };
  }
  async verify(id: string, code: string, ip?: string) {
    await throttleSensitiveAuth('platform-mfa-verify:' + (ip || 'local'), 20);
    const result = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM platform_mfa_challenges WHERE id=${id}::uuid FOR UPDATE`;
      const challenge = await tx.platformMfaChallenge.findUnique({
        where: { id },
      });
      if (
        !challenge ||
        challenge.used_at ||
        challenge.expires_at <= new Date() ||
        challenge.attempts >= 5
      )
        return null;
      await tx.$queryRaw`SELECT id FROM platform_users WHERE id=${challenge.user_id}::uuid FOR UPDATE`;
      const user = await tx.platformUser.findUnique({
        where: { id: challenge.user_id },
        include: { roles: { include: { role: true } } },
      });
      if (
        !user?.is_active ||
        user.is_locked ||
        !user.roles.some((r) => r.role.name === 'SUPER_ADMIN')
      )
        return null;
      if (challenge.purpose === 'ENROLL' && user.mfa_enabled_at) {
        await tx.platformMfaChallenge.update({
          where: { id },
          data: { used_at: new Date() },
        });
        return null;
      }
      const encrypted =
        challenge.purpose === 'ENROLL'
          ? challenge.secret_encrypted
          : user.mfa_secret_encrypted;
      if (!encrypted) return null;
      const counter = matchingCounter(this.decrypt(encrypted, user.id), code);
      const recovery =
        challenge.purpose === 'VERIFY' && /^[A-Z0-9-]{16,40}$/i.test(code)
          ? recoveryHash(code)
          : null;
      const usedRecovery =
        recovery && user.mfa_recovery_hashes.includes(recovery);
      if (
        !usedRecovery &&
        (counter === null ||
          (user.mfa_last_counter !== null && counter <= user.mfa_last_counter))
      ) {
        await tx.platformMfaChallenge.update({
          where: { id },
          data: {
            attempts: { increment: 1 },
            ...(challenge.attempts === 4 ? { used_at: new Date() } : {}),
          },
        });
        return null;
      }
      const recoveryCodes =
        challenge.purpose === 'ENROLL'
          ? Array.from({ length: 8 }, () =>
              randomBytes(12)
                .toString('hex')
                .toUpperCase()
                .match(/.{1,6}/g)!
                .join('-'),
            )
          : [];
      await tx.platformUser.update({
        where: { id: user.id },
        data: {
          ...(challenge.purpose === 'ENROLL'
            ? {
                mfa_secret_encrypted: encrypted,
                mfa_enabled_at: new Date(),
                mfa_recovery_hashes: recoveryCodes.map(recoveryHash),
              }
            : {}),
          ...(usedRecovery
            ? {
                mfa_recovery_hashes: user.mfa_recovery_hashes.filter(
                  (h) => h !== recovery,
                ),
              }
            : { mfa_last_counter: counter! }),
        },
      });
      await tx.platformMfaChallenge.update({
        where: { id },
        data: { used_at: new Date() },
      });
      await tx.platformAuditLog.create({
        data: {
          user_id: user.id,
          action:
            challenge.purpose === 'ENROLL'
              ? 'MFA_ENROLLED'
              : usedRecovery
                ? 'MFA_RECOVERY_USED'
                : 'MFA_VERIFIED',
          resource_type: 'PlatformUser',
          resource_id: user.id,
        },
      });
      return {
        user: await tx.platformUser.findUniqueOrThrow({
          where: { id: user.id },
          include: { roles: { include: { role: true } } },
        }),
        context: {
          deviceId: challenge.device_id || undefined,
          ip: challenge.ip_address || undefined,
          userAgent: challenge.user_agent || undefined,
        },
        recoveryCodes,
      };
    });
    if (!result)
      throw new UnauthorizedException(
        'Code is invalid, already used or expired. Try a new code or sign in again.',
      );
    return result;
  }
}
