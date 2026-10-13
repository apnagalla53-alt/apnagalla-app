import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class SmsOtpProvider {
  configured() {
    return process.env.SMS_PROVIDER === 'twilio' && !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!(process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM);
  }
  async send(phone: string, otp: string) {
    if (!this.configured()) throw new ServiceUnavailableException({ code: 'OTP_NOT_CONFIGURED', message: 'Mobile OTP is not configured. Use an existing password account or contact support.' });
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const body = new URLSearchParams({ To: phone, Body: `Your EVOLIX verification code is ${otp}. It expires in 5 minutes. Do not share this code.` });
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) body.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
    else body.set('From', process.env.TWILIO_FROM!);
    try {
      const result = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(sid + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body, signal: AbortSignal.timeout(10000),
      });
      if (!result.ok) throw new Error('SMS delivery request rejected');
      const message = await result.json();
      if (!message.sid || ['failed','undelivered'].includes(message.status)) throw new Error('SMS delivery unavailable');
      // Provider acceptance is not proof that the SMS reached the phone.
      return { accepted: true };
    } catch {
      throw new ServiceUnavailableException({ code: 'OTP_DELIVERY_UNAVAILABLE', message: 'The verification message could not be requested. Please try again later.' });
    }
  }
}
