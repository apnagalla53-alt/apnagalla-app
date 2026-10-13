import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';
import { GoogleIdentityService, VerifiedGoogleIdentity } from './google-identity.service';
import { authTokenHash } from './password-lifecycle.service';
import { throttleSensitiveAuth } from './sensitive-auth-throttle';
import { auditIdentityChange } from './auth-audit';
import { AccountPolicyService } from './account-policy.service';
import { ReferralService } from './referral.service';
import { OnboardingService } from './onboarding.service';

@Injectable()
export class GoogleAuthService {
  constructor(private readonly prisma: PrismaService, private readonly identity: GoogleIdentityService, private readonly auth: AuthService, private readonly policy: AccountPolicyService, private readonly referrals: ReferralService,private readonly onboarding:OnboardingService) {}

  async challenge(userId?: string, ip = 'local', signup = false) {
    await throttleSensitiveAuth('google-challenge:' + ip, 30);
    if (!this.identity.clientId()) throw new ServiceUnavailableException('Google sign in is NOT CONFIGURED.');
    const nonce = randomBytes(32).toString('base64url');
    if (signup) await this.policy.signupAllowed();
    const challenge = await this.prisma.authToken.create({ data: { user_id: userId, purpose: userId ? 'GOOGLE_LINK' : signup ? 'GOOGLE_SIGNUP' : 'GOOGLE_LOGIN', token_hash: authTokenHash(nonce), expires_at: new Date(Date.now() + 5 * 60_000) } });
    return { challenge_id: challenge.id, nonce, client_id: this.identity.clientId() };
  }

  async signup(challengeId: string, credential: string, terms: boolean, referral: string | undefined, context: { ip?: string; userAgent?: string; deviceId?: string } = {}) {
    await throttleSensitiveAuth('google-signup:' + (context.ip || 'local'), 15);
    if (!terms) throw new BadRequestException('Accept the terms and privacy policy to create an account.');
    await this.policy.signupAllowed();
    const identity = await this.identity.verify(credential);
    const passwordHash = await bcrypt.hash(randomBytes(48).toString('hex'), 12);
    const result = await this.prisma.$transaction(async tx => {
      await this.consumeChallenge(tx, challengeId, identity, 'GOOGLE_SIGNUP');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identity.subject}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'signup-email:'+identity.email.toLowerCase()}))`;
      const existing = await tx.user.findUnique({ where: { google_subject: identity.subject } });
      if (existing) return existing;
      const emailAccount = await tx.user.findFirst({ where: { email: { equals: identity.email, mode: 'insensitive' } } });
      if (emailAccount) throw new ConflictException('An account already uses this email. Sign in to that account and connect Google in Security.');
      const user = await tx.user.create({ data: { username: 'account-' + randomBytes(16).toString('hex'), display_name: identity.displayName||'New shop owner', email: identity.email.toLowerCase(), email_verified_at: identity.emailAuthoritative ? new Date() : null, google_subject: identity.subject, password_hash: passwordHash, password_login_enabled: false, onboarding_state: 'BUSINESS_PROFILE_REQUIRED', onboarding_data: { terms_accepted_at: new Date().toISOString(), signup_provider: 'GOOGLE' } } });
      await this.referrals.attachSignup(tx, user, referral);
      await auditIdentityChange(tx, user.id, 'GOOGLE_SIGNUP');
      return user;
    });
    if(result.onboarding_state!=='READY')await this.onboarding.state(result.id);
    return this.auth.loginUser(result.id, context);
  }

  async login(challengeId: string, credential: string, context: { ip?: string; userAgent?: string; deviceId?: string } = {}) {
    await throttleSensitiveAuth('google-login:' + (context.ip || 'local'), 30);
    const identity = await this.identity.verify(credential);
    await this.prisma.$transaction(tx => this.consumeChallenge(tx, challengeId, identity, 'GOOGLE_LOGIN'));
    const user = await this.prisma.user.findUnique({ where: { google_subject: identity.subject } });
    if (!user) throw new UnauthorizedException({
      code: 'GOOGLE_ACCOUNT_NOT_REGISTERED',
      message: 'This Google account is not connected to EVOLIX yet. Create a new account, or sign in with your existing shop password and connect Google in Security.',
    });
    if(user.onboarding_state!=='READY')await this.onboarding.state(user.id);
    return this.auth.loginUser(user.id, context);
  }

  async link(userId: string, challengeId: string, credential: string, password: string) {
    await throttleSensitiveAuth('google-link:' + userId, 10);
    const identity = await this.identity.verify(credential);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user?.is_active || !await bcrypt.compare(password, user.password_hash)) throw new BadRequestException('Current password is incorrect.');
      if (user.google_subject && user.google_subject !== identity.subject) throw new ConflictException('Disconnect the current Google account before connecting another one.');
      const other = await tx.user.findUnique({ where: { google_subject: identity.subject } });
      if (other && other.id !== userId) throw new ConflictException('This Google account is already connected to another shop account.');
      await this.consumeChallenge(tx, challengeId, identity, 'GOOGLE_LINK', userId);
      try {
        await tx.user.update({ where: { id: userId }, data: {
          google_subject: identity.subject,
          ...(identity.emailAuthoritative ? { email: identity.email.toLowerCase(), email_verified_at: new Date() } : {}),
        } });
      } catch (error: any) {
        if (error?.code === 'P2002') throw new ConflictException('This Google account is already connected to another shop account.');
        throw error;
      }
      if (identity.emailAuthoritative) await tx.authToken.updateMany({ where: { user_id: userId, purpose: { in: ['PASSWORD_RESET', 'EMAIL_VERIFY'] }, used_at: null }, data: { used_at: new Date() } });
      await auditIdentityChange(tx, userId, 'GOOGLE_LINKED');
      return { success: true, message: 'Google connected. You can now use Google to sign in to this shop account.' };
    }, { timeout: 30_000 });
  }

  async unlink(userId: string, password: string) {
    await throttleSensitiveAuth('google-unlink:' + userId, 10);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user?.is_active || !await bcrypt.compare(password, user.password_hash)) throw new BadRequestException('Current password is incorrect.');
      const now = new Date();
      await tx.user.update({ where: { id: userId }, data: { google_subject: null } });
      await tx.session.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: now } });
      await tx.authToken.updateMany({ where: { user_id: userId, purpose: 'GOOGLE_LINK', used_at: null }, data: { used_at: now } });
      await auditIdentityChange(tx, userId, 'GOOGLE_UNLINKED');
      return { success: true, message: 'Google disconnected. Sign in again with your password.' };
    }, { timeout: 30_000 });
  }

  private async consumeChallenge(tx: any, id: string, identity: VerifiedGoogleIdentity, purpose: string, userId?: string) {
    const consumed = await tx.authToken.updateMany({ where: { id, purpose, user_id: userId || null, token_hash: authTokenHash(identity.nonce), used_at: null, expires_at: { gt: new Date() } }, data: { used_at: new Date() } });
    if (consumed.count !== 1) throw new UnauthorizedException('Google sign in expired or was already used. Please try again.');
  }
}
