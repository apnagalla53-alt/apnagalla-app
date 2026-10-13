import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthEmailService {
  isConfigured() {
    return process.env.EMAIL_PROVIDER === 'smtp' && !!process.env.SMTP_HOST && !!process.env.EMAIL_FROM && !!process.env.PUBLIC_APP_URL;
  }

  async sendPasswordReset(email: string, token: string) {
    return this.sendLink(email, token, 'password');
  }

  async sendEmailVerification(email: string, token: string) {
    return this.sendLink(email, token, 'email');
  }

  private async sendLink(email: string, token: string, type: 'password' | 'email') {
    if (!this.isConfigured()) throw new ServiceUnavailableException('Password recovery email is NOT CONFIGURED. Contact your shop administrator.');
    const appUrl = new URL(process.env.PUBLIC_APP_URL!);
    const reset = new URL(type === 'password' ? '/reset-password' : '/verify-email', appUrl);
    // A fragment keeps the secret out of HTTP access logs and Referer headers.
    reset.hash = new URLSearchParams({ token }).toString();
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      requireTLS: process.env.SMTP_SECURE !== 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
      logger: false, debug: false,
    });
    try {
      const sent = await transport.sendMail({ from: process.env.EMAIL_FROM, to: email,
        subject: type === 'password' ? 'Reset your EVOLIX password' : 'Verify your EVOLIX recovery email',
        text: type === 'password'
          ? `You requested a password reset for your EVOLIX shop account.\n\nOpen this link within 20 minutes:\n${reset.toString()}\n\nThis link can be used once. If you did not request it, ignore this email. No password has changed.`
          : `Confirm this email as the recovery address for your EVOLIX shop account.\n\nOpen this link within 20 minutes:\n${reset.toString()}\n\nThis link can be used once. If you did not request it, ignore this email.`,
      });
      if (!sent.accepted?.length) throw new Error('No recipient accepted');
    } catch {
      // Never expose SMTP authentication details or the reset message/token.
      throw new ServiceUnavailableException('Password recovery email could not be delivered. Please try again later.');
    } finally { transport.close(); }
  }
}
