import { BadRequestException, ConflictException, HttpException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { normalizeIndianPhone } from './phone';
import { SmsOtpProvider } from './sms-otp.provider';
import { AccountPolicyService } from './account-policy.service';
import { AuthService } from './auth.service';
import { ReferralService } from './referral.service';
import { jwtSecret } from './jwt-secret';
import { throttleSensitiveAuth } from './sensitive-auth-throttle';
import { auditIdentityChange } from './auth-audit';

@Injectable()
export class MobileOtpService {
  constructor(private db: PrismaService, private sms: SmsOtpProvider, private policy: AccountPolicyService, private auth: AuthService, private referrals: ReferralService) {}
  private hash(id: string, code: string) { return createHmac('sha256', jwtSecret()).update('mobile-otp:' + id + ':' + code).digest('hex'); }
  async request(phone: string, purpose: 'SIGN_IN'|'SIGN_UP'|'LINK', terms: boolean, referral: string | undefined, ip = 'local', userId?: string) {
    await throttleSensitiveAuth('otp-request:' + ip, 15);
    const canonical = normalizeIndianPhone(phone);
    if (!this.sms.configured()) throw new ServiceUnavailableException({ code: 'OTP_NOT_CONFIGURED', message: 'Mobile OTP is not configured. Use a connected Google account or your existing password.' });
    if (purpose === 'LINK' && !userId) throw new UnauthorizedException('Sign in before connecting a mobile number.');
    if (purpose === 'SIGN_UP') { if (!terms) throw new BadRequestException('Accept the terms and privacy policy to create an account.'); await this.policy.signupAllowed(); }
    const code = String(randomInt(100000, 1000000));
    const challenge = await this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${canonical}))`;
      const recent = await tx.mobileOtpChallenge.findMany({ where: { phone_e164: canonical, created_at: { gt: new Date(Date.now()-3600000) } }, orderBy: { created_at: 'desc' }, take: 7 });
      if (recent.length >= 6 || recent[0]?.created_at.getTime() > Date.now()-60000) throw new HttpException('Wait before requesting another code.', 429);
      await tx.mobileOtpChallenge.updateMany({ where: { phone_e164: canonical, used_at: null }, data: { used_at: new Date() } });
      const row = await tx.mobileOtpChallenge.create({ data: { phone_e164: canonical, purpose, user_id: userId || null, otp_hash: '', expires_at: new Date(Date.now()+300000), referral_code: referral?.trim().toUpperCase(), terms_accepted_at: purpose === 'SIGN_UP' ? new Date() : null } });
      return tx.mobileOtpChallenge.update({ where: { id: row.id }, data: { otp_hash: this.hash(row.id, code) } });
    });
    try { await this.sms.send(canonical, code); } catch (error) { await this.db.mobileOtpChallenge.update({ where: { id: challenge.id }, data: { used_at: new Date() } }); throw error; }
    return { challenge_id: challenge.id, expires_in_seconds: 300, resend_after_seconds: 60, message: 'Code requested. Delivery depends on your SMS provider and network.' };
  }
  async verify(id: string, code: string, context: { ip?: string; userAgent?: string; deviceId?: string } = {}, userId?: string, password?: string) {
    await throttleSensitiveAuth('otp-verify:' + (context.ip || 'local'), 30);
    // Hashing outside the transaction avoids holding locks during expensive password work.
    const unusableHash = await bcrypt.hash(randomBytes(48).toString('hex'), 12);
    const result = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM mobile_otp_challenges WHERE id=${id}::uuid FOR UPDATE`;
      const challenge = await tx.mobileOtpChallenge.findUnique({ where: { id } });
      if (!challenge || challenge.used_at || challenge.expires_at <= new Date() || challenge.attempts >= 5) return { error: 'Code expired or was already used. Request a new code.' };
      const valid = timingSafeEqual(Buffer.from(challenge.otp_hash, 'hex'), Buffer.from(this.hash(id, code), 'hex'));
      if (!valid) { await tx.mobileOtpChallenge.update({ where: { id }, data: { attempts: { increment: 1 }, ...(challenge.attempts >= 4 ? { used_at: new Date() } : {}) } }); return { error: 'Incorrect code.' }; }
      await tx.mobileOtpChallenge.update({ where: { id }, data: { used_at: new Date(), attempts: { increment: 1 } } });
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${challenge.phone_e164}))`;
      let user = await tx.user.findUnique({ where: { phone_e164: challenge.phone_e164 } });
      if (challenge.purpose === 'LINK') {
        if (!userId || challenge.user_id !== userId) return { error: 'This code belongs to a different account.' };
        const account = await tx.user.findUnique({ where: { id: userId } });
        if (!account?.is_active || !account.password_login_enabled || !password || !await bcrypt.compare(password, account.password_hash)) return { error: 'Confirm your current password to connect this number.' };
        if (user && user.id !== userId) return { error: 'This mobile number is already connected to another account.' };
        await tx.user.update({ where: { id: userId }, data: { phone_e164: challenge.phone_e164, phone_verified_at: new Date(), phone: challenge.phone_e164 } });
        await auditIdentityChange(tx, userId, 'MOBILE_CONNECTED');
        return { userId, linked: true };
      }
      if (!user) {
        // Legacy contact numbers are not verified identities. Never take over that account.
        const local=challenge.phone_e164.slice(3);
        const legacy=await tx.$queryRaw<any[]>`SELECT id FROM users WHERE regexp_replace(phone, '[^0-9]', '', 'g') IN (${local},${'91'+local},${'0'+local}) LIMIT 1`;
        if (legacy.length) return { error: 'This number is on an existing account. Sign in with its password and connect the mobile number in Security.' };
        if (challenge.purpose !== 'SIGN_UP' || !challenge.terms_accepted_at) return { error: 'No account is connected to this mobile number. Choose Sign up.' };
        await this.policy.signupAllowed(tx);
        user = await tx.user.create({ data: { username: 'account-' + randomBytes(16).toString('hex'), display_name: 'New shop owner', phone: challenge.phone_e164, phone_e164: challenge.phone_e164, phone_verified_at: new Date(), password_hash: unusableHash, password_login_enabled: false, onboarding_state: 'OWNER_PROFILE_REQUIRED', onboarding_data: { terms_accepted_at: challenge.terms_accepted_at.toISOString(), signup_provider: 'MOBILE' } } });
        await this.referrals.attachSignup(tx, user, challenge.referral_code || undefined);
        await auditIdentityChange(tx, user.id, 'MOBILE_SIGNUP');
      }
      return { userId: user.id, linked: false };
    }, { timeout: 30000 });
    if (result.error) throw new UnauthorizedException(result.error);
    if (result.linked) return { success: true, message: 'Mobile number connected.' };
    return this.auth.loginUser(result.userId!, context);
  }
}
