import { BadRequestException } from '@nestjs/common';

/** bcrypt accepts at most 72 bytes; reject longer input rather than silently truncate. */
export function validatePassword(password: string) {
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72 ||
      !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new BadRequestException('Use at least 12 characters with uppercase, lowercase, a number and a symbol (maximum 72 bytes).');
  }
}
