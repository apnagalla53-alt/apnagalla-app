import { Capacitor, registerPlugin } from '@capacitor/core';

const googleNative = registerPlugin<{
  signIn(options: { clientId: string; nonce: string }): Promise<{ credential: string }>;
  clearSession(): Promise<void>;
}>('EvolixGoogleAuth');

export function nativeGoogleAvailable() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('EvolixGoogleAuth');
}

export function nativeGoogleSignIn(clientId: string, nonce: string) {
  return googleNative.signIn({ clientId, nonce });
}

export async function clearNativeGoogleState() {
  if (!nativeGoogleAvailable()) return;
  try { await Promise.race([googleNative.clearSession(), new Promise<void>(resolve => window.setTimeout(resolve, 3000))]); }
  catch { /* API/session revocation remains authoritative even if the device provider is unavailable. */ }
}
