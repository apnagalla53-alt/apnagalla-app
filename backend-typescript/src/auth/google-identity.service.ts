import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export interface VerifiedGoogleIdentity { subject: string; email: string; nonce: string; emailAuthoritative: boolean; displayName?:string; }

@Injectable()
export class GoogleIdentityService {
  private readonly client = new OAuth2Client();
  clientId() { return process.env.GOOGLE_CLIENT_ID || null; }

  async verify(credential: string): Promise<VerifiedGoogleIdentity> {
    const audience = this.clientId();
    if (!audience) throw new ServiceUnavailableException('Google sign in is NOT CONFIGURED.');
    try {
      // Google's official library checks the signature, audience, issuer and expiry.
      const ticket = await this.client.verifyIdToken({ idToken: credential, audience });
      const payload = ticket.getPayload();
      const nonce = (payload as any)?.nonce;
      if (!payload?.sub || !payload.email || payload.email_verified !== true || typeof nonce !== 'string' || !nonce) {
        throw new Error('Missing verified identity or nonce');
      }
      return { subject: payload.sub, email: payload.email, nonce,
        displayName: typeof payload.name==='string'?payload.name.trim().slice(0,255):undefined,
        emailAuthoritative: payload.email.toLowerCase().endsWith('@gmail.com') || !!payload.hd };
    } catch {
      throw new UnauthorizedException('Google sign in could not be verified. Please try again.');
    }
  }
}
