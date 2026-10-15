import { BadRequestException } from '@nestjs/common';
import { validatePassword } from './password-policy';

// Never apply the simpler staff policy to an owner, administrator or an
// account without a shop membership. Inspect every membership, not just role 1.
export function isStaffAccount(user: any): boolean {
  return !!user?.organization_id && !!user.roles?.length && user.roles.every((entry: any) =>
    entry.company_id && !entry.role.system_role &&
    !['OWNER', 'ADMIN', 'TENANT_ADMIN'].includes(entry.role.name) &&
    !entry.role.name.startsWith('BUSINESS_ADMIN_') && !entry.role.name.includes('SUPER_ADMIN'));
}
export function validateStaffPassword(password: string) {
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72 || !password.trim())
    throw new BadRequestException('Use at least 8 characters (maximum 72 bytes). Uppercase letters, numbers and symbols are optional.');
}
export function validateAccountPassword(user: any, password: string) {
  if (isStaffAccount(user)) validateStaffPassword(password);
  else validatePassword(password);
}
export function staffPhone(value: string): string {
  let digits = String(value || '').trim().replace(/[\s()+-]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (!/^[6-9]\d{9}$/.test(digits))
    throw new BadRequestException('Enter a valid 10-digit staff mobile number.');
  return digits;
}
