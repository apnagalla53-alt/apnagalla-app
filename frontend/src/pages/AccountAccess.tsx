import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, ShieldCheck } from 'lucide-react';
import api from '../shared/api';
import { useAuthStore } from '../shared/store/authStore';
import { createUuid } from '../shared/browserCrypto';
import GoogleSignIn from './GoogleSignIn';
import './Login.css';

export default function AccountAccess({ signup = false }: { signup?: boolean }) {
  const navigate = useNavigate();
  const user=useAuthStore(s=>s.user),session=useAuthStore(s=>s.session_id);
  const [params] = useSearchParams();
  const [caps, setCaps] = useState<any>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [referral, setReferral] = useState(() => params.get('ref') || sessionStorage.getItem('evolix-referral') || '');

  useEffect(() => {
    if (params.get('ref')) sessionStorage.setItem('evolix-referral', params.get('ref')!);
    api.get('/auth/capabilities').then(response => setCaps(response.data)).catch(() => setError('Cannot connect to Apna Galla. Please retry.'));
  }, [params]);

  function done(result: any) {
    useAuthStore.getState().login(result.access_token, result.user,result.csrf_token);
    if (result.tenant_context) useAuthStore.getState().setTenantContext(result.tenant_context);
    sessionStorage.removeItem('evolix-referral');
    navigate(result.user.must_change_password ? '/change-password' : result.user.onboarding_state && result.user.onboarding_state !== 'READY' ? '/onboarding' : '/retail/home');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (!challenge) {
        const response = await api.post('/auth/account/otp/request', {
          phone, purpose: signup ? 'SIGN_UP' : 'SIGN_IN', terms_accepted: terms,
          referral_code: signup ? referral || undefined : undefined,
        });
        setChallenge(response.data.challenge_id);
        setResendAt(Date.now() + response.data.resend_after_seconds * 1000);
      } else {
        let device = localStorage.getItem('evolix-device-id');
        if (!device) { device = createUuid(); localStorage.setItem('evolix-device-id', device); }
        done((await api.post('/auth/account/otp/verify', { challenge_id: challenge, code, device_id: device })).data);
      }
    } catch (failure: any) {
      const message = failure.response?.data?.message;
      setError(Array.isArray(message) ? message.join('. ') : message || 'Could not finish. Please try again.');
    } finally { setBusy(false); }
  }

  if(!signup&&session&&user&&!user.is_platform)return <Navigate replace to={user.must_change_password?'/change-password':user.onboarding_state&&user.onboarding_state!=='READY'?'/onboarding':'/retail/home'}/>;
  return <main className="login-container"><section className="login-card">
    <div className="login-brand"><img src="/brand/apna-galla-logo.webp" alt="Apna Galla — Har dukaan ka apna hisaab" width="240" height="198" /></div>
    <h1>{signup ? 'Create your shop account' : 'Welcome to your shop'}</h1>
    <p>{signup ? 'Use your Google account, then set up your business.' : 'Sign in to continue your daily business.'}</p>
    <nav className="account-auth-tabs" aria-label="Account access">
      <Link aria-current={!signup ? 'page' : undefined} to="/login">Sign in</Link>
      <Link aria-current={signup ? 'page' : undefined} to="/signup">Create account</Link>
    </nav>
    {!signup&&<Link className="login-staff-entry" to="/password-login"><Phone size={18} aria-hidden="true"/>Staff sign in · Mobile number &amp; password</Link>}
    {caps === null && !error && <p role="status">Checking sign-in options…</p>}

    {signup && <>
      <details className="account-referral" open={!!referral}>
        <summary>Have a referral code?</summary>
        <label>Referral code (optional)<input value={referral} maxLength={30} onChange={event => setReferral(event.target.value.toUpperCase())} /></label>
      </details>
      <div className="account-google-section">
        <label className="login-checkbox"><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} />
          <span>I agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</span>
        </label>
        {caps?.google_client_id && <>
          {!terms && <p className="login-hint">Review and accept the Terms and Privacy Policy to enable Google signup.</p>}
          <GoogleSignIn mode="signup" enabled={terms} terms={terms} referral={referral} onSuccess={done} />
          <p className="login-hint">No existing shop account or password is needed. Next, we’ll help you set up your shop.</p>
        </>}
      </div>
    </>}
    {!signup && caps?.google_client_id && <section className="account-google-section" aria-label="Google sign in">
      <GoogleSignIn onSuccess={done} />
      <p className="login-hint">New to Apna Galla? <Link to="/signup">Create account with Google</Link></p>
    </section>}

    {caps?.mobile_otp_configured && <details className="account-mobile-option" open={!!challenge || !caps.google_client_id}>
      <summary>Use mobile verification instead</summary>
      <form onSubmit={submit}>
        <label><span><Phone size={18} aria-hidden="true" /> Mobile number</span>
          <input type="tel" autoComplete="tel" inputMode="tel" placeholder="Your 10-digit mobile number" required value={phone} maxLength={25} disabled={!!challenge} onChange={event => setPhone(event.target.value)} />
        </label>
        {challenge && <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value)} /></label>}
        <button disabled={busy || (signup && !terms)}>{busy ? 'Please wait…' : challenge ? 'Verify and continue' : 'Send verification code'}</button>
        {challenge && <button type="button" className="login-secondary" disabled={busy} onClick={() => {
          if (Date.now() < resendAt) { setError('Please wait 60 seconds before requesting another code.'); return; }
          setChallenge(''); setCode('');
        }}>Change number / request another code</button>}
      </form>
    </details>}
    {caps && !caps.google_client_id && <p className="account-provider-note">Google sign-in is not configured yet.</p>}
    {caps && !caps.mobile_otp_configured && !caps.google_client_id && <p className="account-provider-note">Mobile verification is not configured yet. Existing users can use their shop password.</p>}
    {error && <p role="alert" className="login-error">{error}</p>}
    <div className="login-footer"><Link to="/password-login">Use existing shop password</Link><Link to="/platform/login">Platform administration</Link></div>
    <p className="account-security-note"><ShieldCheck size={16} aria-hidden="true" /> Your business stays private to your shop.</p>
    <div className="login-legal"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/support">Help</Link></div>
  </section></main>;
}
