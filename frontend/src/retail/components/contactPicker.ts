export interface ChosenContact { name?: string[]; tel?: string[] }
export interface ContactPicker {
  select(properties: string[], options: { multiple: false }): Promise<ChosenContact[]>;
  getProperties?(): Promise<string[]>;
}

/** Keep foreign numbers and extensions intact; only simplify known Indian mobile forms. */
export function contactPhone(value: string): string {
  const raw = value.trim().replace(/^tel:/i, '');
  if (!/^[+\d\s().-]+$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  if (/^91[6-9]\d{9}$/.test(digits)) return digits.slice(2);
  if (/^0[6-9]\d{9}$/.test(digits)) return digits.slice(1);
  return raw.startsWith('+') ? '+' + digits : digits;
}

export function chosenContact(contact: ChosenContact) {
  return {
    name: Array.isArray(contact.name) ? contact.name.find(n => typeof n === 'string' && n.trim())?.trim() || '' : '',
    phones: [...new Set((Array.isArray(contact.tel) ? contact.tel : [])
      .filter((n): n is string => typeof n === 'string' && !!n.trim()).slice(0, 50).map(contactPhone))],
  };
}

export function browserContactPicker(): ContactPicker | null {
  if (typeof window === 'undefined' || !window.isSecureContext || window.top !== window.self) return null;
  const picker = (navigator as Navigator & { contacts?: ContactPicker }).contacts;
  return typeof picker?.select === 'function' ? picker : null;
}
