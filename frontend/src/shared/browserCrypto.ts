const hex = (bytes: Uint8Array) => Array.from(bytes, byte=>byte.toString(16).padStart(2,'0')).join('');

/** LAN HTTP browsers expose getRandomValues even when randomUUID is unavailable. */
export function createUuid(): string {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  if (!crypto?.getRandomValues) throw new Error('This browser cannot generate secure identifiers. Please use a current browser.');
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = hex(bytes);
  return [value.slice(0,8),value.slice(8,12),value.slice(12,16),value.slice(16,20),value.slice(20)].join('-');
}

/** Keep the same SHA-256 retry fingerprint on HTTPS, localhost and LAN HTTP. */
export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  if (globalThis.crypto?.subtle) return hex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)));
  const { sha256 } = await import('@noble/hashes/sha2.js');
  return hex(sha256(bytes));
}
