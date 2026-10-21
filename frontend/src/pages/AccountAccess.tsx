import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, ShieldCheck } from 'lucide-react';
import api from '../shared/api';
import { useAuthStore } from '../shared/store/authStore';
import { createUuid } from '../shared/browserCrypto';
import GoogleSignIn from './GoogleSignIn';
import './Login.css';
import BrandWaves from '../shared/components/BrandWaves';

export default function AccountAccess({ signup = false }: { signup?: boolean }) {
  const navigate = useNavigate();
  const user=useAuthStore(s=>s.user),session=useAuthStore(s=>s.session_id);
  const [params] = useSearchParams();
  const [caps, setCaps] = useState<any>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [terms, setTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [resendAt, setResendAt] = useState(0);

  useEffect(() => {
    if (params.get('ref')) sessionStorage.setItem('evolix-referral', params.get('ref')!);
    api.get('/auth/capabilities').then(response => setCaps(response.data)).catch(() => setError('Cannot connect to Apna Galla. Please retry.'));
  }, [params]);

  function done(result: any) {
    useAuthStore.getState().login(result.access_token, result.user,result.csrf_token);
    if (result.tenant_context) useAuthStore.getState().setTenantContext(result.tenant_context);
    navigate(result.user.must_change_password ? '/change-password' : result.user.onboarding_state && result.user.onboarding_state !== 'READY' ? '/onboarding' : '/retail/home');
  }

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault(); setPasswordBusy(true); setPasswordError('');
    try {
      let deviceId = localStorage.getItem('evolix-device-id');
      if (!deviceId) { deviceId = createUuid(); localStorage.setItem('evolix-device-id', deviceId); }
      done((await api.post('/auth/login', { username: username.trim(), password, device_id: deviceId })).data);
    } catch (failure: any) {
      const message = failure.response?.data?.message;
      setPasswordError(Array.isArray(message) ? message.join('. ') : message || 'Cannot connect. Please try again.');
    } finally { setPasswordBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (!challenge) {
        const response = await api.post('/auth/account/otp/request', {
          phone, purpose: signup ? 'SIGN_UP' : 'SIGN_IN', terms_accepted: terms,
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
  return <main className="login-container account-access-page"><BrandWaves/><section className="login-card account-access-card">
    <div className="account-brand"><img src="/brand/apna-galla-app-192.png" alt="" width="48" height="48" /><span>Apna Galla<small>Har dukaan ka apna hisaab</small></span></div>
    <h1>{signup ? 'Create your shop account' : 'Welcome to your shop'}</h1>
    <p className="account-intro">{signup ? 'Start with your account. We’ll help you set up your shop next.' : 'Sign in to continue your daily business.'}</p>
    <nav className="account-auth-tabs" aria-label="Account access">
      <Link aria-current={!signup ? 'page' : undefined} to="/login">Sign in</Link>
      <Link aria-current={signup ? 'page' : undefined} to="/signup">Create account</Link>
    </nav>
    {signup && <ol className="account-setup-steps" aria-label="Account setup steps">
      <li aria-current="step"><span aria-hidden="true">1</span>Account</li><li><span aria-hidden="true">2</span>Shop details</li><li><span aria-hidden="true">3</span>Activation</li>
    </ol>}
    {!signup && <>
      <form onSubmit={signInWithPassword} aria-label="Password sign in">
        <label>Username<input autoComplete="username" placeholder="Enter your username or mobile number" required maxLength={255} value={username} onChange={event => setUsername(event.target.value)} /></label>
        <label>Password<input type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required maxLength={255} value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label className="login-checkbox"><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />Show password</label>
        {passwordError && <p role="alert" className="login-error">{passwordError}</p>}
        <button disabled={passwordBusy} type="submit">{passwordBusy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <Link to="/forgot-password">Forgot password?</Link>
    </>}
    {caps === null && !error && <p role="status">Checking sign-in options…</p>}

    {signup && <>
      <div className="account-google-section">
        <label className="login-checkbox"><input id="signup-terms" type="checkbox" checked={terms} aria-invalid={termsError && !terms} aria-describedby={termsError && !terms ? 'signup-terms-error' : undefined} onChange={event => {setTerms(event.target.checked); if(event.target.checked)setTermsError(false);}} />
          <span>I agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</span>
        </label>
        {caps?.google_client_id && <>
          {termsError && !terms && <p id="signup-terms-error" role="alert" className="login-error">Please accept the Terms and Privacy Policy to continue.</p>}
          <GoogleSignIn mode="signup" enabled={terms} terms={terms} onBlocked={() => {setTermsError(true);document.getElementById('signup-terms')?.focus();}} onSuccess={done} />
        </>}
      </div>
    </>}
    {!signup && caps?.google_client_id && <section className="account-google-section" aria-label="Google sign in">
      <div className="login-divider">or</div>
      <GoogleSignIn onSuccess={done} />
      <p className="login-hint">New to Apna Galla? <Link to="/signup">Create account with Google</Link></p>
    </section>}

    {!signup && caps?.mobile_otp_configured && <details className="account-mobile-option" open={!!challenge || !caps.google_client_id}>
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
    {signup && caps && !caps.mobile_otp_configured && !caps.google_client_id && <p className="account-provider-note">Mobile verification is not configured yet. Existing users can sign in with their password.</p>}
    {error && <p role="alert" className="login-error">{error}</p>}
    {signup && <p className="account-returning">Already have an account? <Link to="/login">Sign in</Link></p>}
    <p className="account-security-note"><ShieldCheck size={16} aria-hidden="true" /> Your business stays private to your shop.</p>
    <div className="login-legal"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/support">Help</Link><Link to="/platform/login">Platform administration</Link></div>
  </section></main>;
}
