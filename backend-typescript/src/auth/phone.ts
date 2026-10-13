import { BadRequestException } from '@nestjs/common';

export function normalizeIndianPhone(input: string): string {
  if (typeof input !== 'string' || /[^+0-9\s()-]/.test(input)) throw new BadRequestException('Enter a valid Indian mobile number.');
  let digits = input.replace(/[\s()-]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) throw new BadRequestException('Enter a valid 10-digit Indian mobile number.');
  return '+91' + digits;
}
