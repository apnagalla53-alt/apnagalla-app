import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import api from '../shared/api';
import { createUuid } from '../shared/browserCrypto';
import { nativeGoogleAvailable, nativeGoogleSignIn } from '../shared/googleNative';
import googleLogo from '../assets/google-g.png';
import { googleOriginSupported } from '../shared/googleOrigin';

declare global {
  interface Window { google?: { accounts: { id: {
    initialize: (configuration: Record<string, unknown>) => void;
    renderButton: (element: HTMLElement, configuration: Record<string, unknown>) => void;
  } } }; }
}

let googleScript: Promise<void> | null = null;
function loadGoogle() {
  if (window.google?.accounts.id) return Promise.resolve();
  if (!googleScript) googleScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true;
    const timeout = window.setTimeout(() => { googleScript = null; script.remove(); reject(new Error('Google sign in did not load. Check your connection and retry.')); }, 15_000);
    script.onload = () => { window.clearTimeout(timeout); resolve(); };
    script.onerror = () => { window.clearTimeout(timeout); googleScript = null; script.remove(); reject(new Error('Google sign in could not load. You can use your shop password.')); };
    document.head.appendChild(script);
  });
  return googleScript;
}

export function googleWebAvailable() { return !Capacitor.isNativePlatform(); }
export function googleSignInAvailable() { return googleWebAvailable() || nativeGoogleAvailable(); }

export default function GoogleSignIn({ mode = 'login', enabled = true, password = '', terms = false, referral = '', onSuccess, onBlocked }: {
  mode?: 'login' | 'link' | 'signup'; enabled?: boolean; password?: string; terms?: boolean; referral?: string; onSuccess: (result: any) => void; onBlocked?: () => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const latest = useRef({ password, onSuccess, terms, referral }); latest.current = { password, onSuccess, terms, referral };
  const challengePath = mode === 'link' ? '/auth/google/link-challenge' : mode === 'signup' ? '/auth/google/signup-challenge' : '/auth/google/challenge';
  const resultPath = '/auth/google/' + mode;
  const [error, setError] = useState(''); const [signupRequired, setSignupRequired] = useState(false); const [working, setWorking] = useState(false); const [revision, setRevision] = useState(0);
  function showFailure(failure: any) {
    const message = failure.response?.data?.message || failure.message || 'Google sign in could not finish. Please retry.';
    setError(Array.isArray(message) ? message.join('. ') : message);
    setSignupRequired(mode === 'login' && failure.response?.data?.code === 'GOOGLE_ACCOUNT_NOT_REGISTERED');
  }
  const signupAction = signupRequired && <Link className="login-action-link" to="/signup">Create account with Google</Link>;
  useEffect(() => {
    if (!enabled || !googleWebAvailable() || !googleOriginSupported(window.location.origin)) return;
    let disposed = false;
    setError(''); setSignupRequired(false); setWorking(true);
    (async () => {
      try {
        const [challenge] = await Promise.all([api.post(challengePath), loadGoogle()]);
        if (disposed || !element.current || !window.google) return;
        window.google.accounts.id.initialize({ client_id: challenge.data.client_id, nonce: challenge.data.nonce,
          auto_select: false, use_fedcm_for_prompt: true,
          callback: async (response: { credential?: string }) => {
            if (disposed || !response.credential) return;
            setWorking(true); setError(''); setSignupRequired(false);
            try {
              let deviceId = localStorage.getItem('evolix-device-id');
              if (!deviceId) { deviceId = createUuid(); localStorage.setItem('evolix-device-id', deviceId); }
              const result = await api.post(resultPath, {
                challenge_id: challenge.data.challenge_id, credential: response.credential,
                ...(mode === 'link' ? { current_password: latest.current.password } : { device_id: deviceId }),
                ...(mode === 'signup' ? { terms_accepted: latest.current.terms, referral_code: latest.current.referral || undefined } : {}),
              });
              if (!disposed) latest.current.onSuccess(result.data);
            } catch (failure: any) {
              if (!disposed) showFailure(failure);
            } finally { if (!disposed) setWorking(false); }
          },
        });
        element.current.replaceChildren();
        window.google.accounts.id.renderButton(element.current, { type: 'standard', theme: 'outline', size: 'large', text: mode === 'link' ? 'continue_with' : mode === 'signup' ? 'signup_with' : 'signin_with', shape: 'rectangular', width: Math.max(200, Math.min(360, element.current.clientWidth || 280)) });
      } catch (failure: any) { if (!disposed) showFailure(failure); }
      finally { if (!disposed) setWorking(false); }
    })();
    return () => { disposed = true; };
  }, [mode, enabled, revision]);
  if (nativeGoogleAvailable()) return <div className="google-sign-in">
    <button className="google-native-button" type="button" disabled={working || !enabled && !onBlocked} onClick={async () => {
      if (!enabled) { onBlocked?.(); return; }
      if (working) return; setWorking(true); setError(''); setSignupRequired(false);
      try {
        const challenge = (await api.post(challengePath)).data;
        const identity = await nativeGoogleSignIn(challenge.client_id, challenge.nonce);
        let deviceId = localStorage.getItem('evolix-device-id');
        if (!deviceId) { deviceId = createUuid(); localStorage.setItem('evolix-device-id', deviceId); }
        const result = await api.post(resultPath, {
          challenge_id: challenge.challenge_id, credential: identity.credential,
          ...(mode === 'link' ? { current_password: latest.current.password } : { device_id: deviceId }),
          ...(mode === 'signup' ? { terms_accepted: latest.current.terms, referral_code: latest.current.referral || undefined } : {}),
        });
        latest.current.onSuccess(result.data);
      } catch (failure: any) { showFailure(failure); }
      finally { setWorking(false); }
    }}><img src={googleLogo} alt="" width="20" height="20" />{working ? 'Opening Google…' : mode === 'link' ? 'Continue with Google' : mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}</button>
    {error && <p role="alert" className="login-error">{error}</p>}
    {signupAction}
  </div>;
  if (!googleWebAvailable()) return null;
  if (!googleOriginSupported(window.location.origin)) return <p className="login-hint" role="status">Google sign-in needs the live HTTPS website or localhost on the server PC. On this LAN address, use your shop username and password.</p>;
  if (!enabled) return <div className="google-sign-in"><button className="google-native-button" type="button" disabled={!onBlocked} onClick={onBlocked}>
    <img src={googleLogo} alt="" width="20" height="20" />{mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
  </button></div>;
  return <div className="google-sign-in" aria-busy={working}>
    <div ref={element} />
    {working && <p role="status">Preparing Google sign in…</p>}
    {error && <><p role="alert" className="login-error">{error}</p>{signupAction}<button type="button" className="login-secondary" onClick={() => setRevision(value => value + 1)}>Retry Google sign in</button></>}
  </div>;
}
