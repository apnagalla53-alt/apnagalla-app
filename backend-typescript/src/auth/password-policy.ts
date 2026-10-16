import { BadRequestException } from '@nestjs/common';

/** bcrypt accepts at most 72 bytes; reject longer input rather than silently truncate. */
export function validatePassword(password: string) {
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new BadRequestException('Use at least 8 characters (maximum 72 bytes). Letters, numbers or a mixture are allowed.');
  }
}
