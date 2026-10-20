import { BadRequestException } from '@nestjs/common';
import { BUSINESS_TYPES } from './business-types';

/** Keep storage keys stable. Additional activities suggest tools; they grant no entitlements. */
export function businessSelection(primary: unknown, additional: unknown = []) {
  const known = new Set<string>(BUSINESS_TYPES.map(type => type[0]));
  if (typeof primary !== 'string' || !known.has(primary)) throw new BadRequestException('Choose a supported primary business type.');
  if (!Array.isArray(additional) || additional.length > 12 || additional.some(code => typeof code !== 'string' || !known.has(code))) throw new BadRequestException('Choose supported additional business activities (up to 12).');
  return { business_type: primary, additional_business_types: [...new Set<string>(additional)].filter(code => code !== primary) };
}
