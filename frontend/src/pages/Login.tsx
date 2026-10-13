import { ui, useUiLanguage } from "../i18n";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../shared/store/authStore';
import api from '../shared/api';
import { createUuid } from '../shared/browserCrypto';
import './Login.css';
import GoogleSignIn, { googleSignInAvailable } from './GoogleSignIn';
import QRCode from 'qrcode';

export default function Login({ platform = false }: { platform?: boolean }) {
  useUiLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [mfa,setMfa]=useState<any>(null),[code,setCode]=useState(''),[qr,setQr]=useState(''),[completed,setCompleted]=useState<any>(null);
  useEffect(()=>{setQr('');if(mfa?.authenticator_uri)void QRCode.toDataURL(mfa.authenticator_uri,{width:240,margin:2}).then(setQr).catch(()=>setError('Unable to draw the QR. Use the setup key below.'));},[mfa]);
  useEffect(() => { if (!platform && googleSignInAvailable()) api.get('/auth/capabilities').then(response => setGoogleConfigured(!!response.data.google_client_id)).catch(() => setGoogleConfigured(false)); }, [platform]);
  function signedIn(result: any) {
    useAuthStore.getState().login(result.access_token, result.user,result.csrf_token);
    if (result.tenant_context) useAuthStore.getState().setTenantContext(result.tenant_context);
    navigate(result.user.must_change_password ? '/change-password' : platform ? '/platform/dashboard' : result.user.onboarding_state && result.user.onboarding_state !== 'READY' ? '/onboarding' : '/retail/home');
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      let device_id=localStorage.getItem('evolix-device-id');
      if(!device_id){device_id=createUuid();localStorage.setItem('evolix-device-id',device_id);}
      const res = await api.post(platform ? '/platform/auth/login' : '/auth/login', { username, password, device_id });
      if(res.data.mfa_required){setMfa(res.data);setPassword('');setCode('');}
      else signedIn(res.data);
    } catch (err: any) {
      const message = err.response?.data?.message;
      setError(Array.isArray(message) ? message.join('. ') : message || 'Cannot connect. Please try again.');
    } finally { setLoading(false); }
  }
  async function verifyMfa(e:React.FormEvent){
    e.preventDefault();setLoading(true);setError('');
    try{const result=(await api.post('/platform/auth/mfa/verify',{challenge_id:mfa.challenge_id,code:code.trim()})).data;
      if(result.recovery_codes?.length){setCompleted(result);setMfa(null);setQr('');setCode('');}else signedIn(result);
    }catch(err:any){setError(err.response?.data?.message||'Could not verify. Try the current authenticator code.');}
    finally{setLoading(false);}
  }
  return <main className="login-container"><section className="login-card">
    <div className="login-brand">EVOLIX</div><h1>{platform ? 'Platform sign in' : ui("Welcome to your shop")}</h1>
    <p>{platform ? 'Manage organizations and subscriptions.' : ui("Sign in to manage your daily business.")}</p>
    {!platform && <p className="login-hint">New to EVOLIX? <Link to="/signup">Create account with Google</Link></p>}
    {completed?<section><h2>Save your recovery codes</h2><p>Keep these private. Each code works once if your authenticator is unavailable.</p><pre style={{whiteSpace:'pre-wrap'}}>{completed.recovery_codes.join('\n')}</pre><button type="button" onClick={()=>signedIn(completed)}>I saved my recovery codes</button></section>:mfa?<form onSubmit={verifyMfa}>
      <h2>{mfa.enrollment_required?'Set up your authenticator':'Authenticator verification'}</h2>
      {mfa.enrollment_required&&<><p>Scan this QR with Google Authenticator, Microsoft Authenticator or another TOTP app.</p>{qr&&<img src={qr} width={240} height={240} alt="Private authenticator setup QR"/>}<details><summary>Enter setup key manually</summary><code style={{overflowWrap:'anywhere'}}>{new URL(mfa.authenticator_uri).searchParams.get('secret')}</code></details></>}
      <label>Authenticator or recovery code<input autoComplete="one-time-code" autoFocus required maxLength={40} value={code} onChange={e=>setCode(e.target.value)} placeholder="6-digit code"/></label>
      <p>The sign-in request expires after five minutes. A used code cannot be submitted again.</p>
      {error&&<p role="alert" className="login-error">{error}</p>}<button type="submit" disabled={loading}>{loading?'Verifying…':'Verify and sign in'}</button><button type="button" disabled={loading} onClick={()=>{setMfa(null);setCode('');setError('');}}>Back to sign in</button>
    </form>:<form onSubmit={submit}>
      <label>{ui("Username or email")}<input autoComplete="username" placeholder={ui("Enter your username or email")} required maxLength={255} value={username} onChange={e => setUsername(e.target.value)} /></label>
      <label>{ui("Password")}<input type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder={ui("Enter your password")} required maxLength={255} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label className="login-checkbox"><input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />{ui("Show password")}</label>
      {error && <p role="alert" className="login-error">{error}</p>}
      <button disabled={loading} type="submit">{loading ? 'Signing in…' : ui("Sign In")}</button>
    </form>}
    {!platform && <Link to="/forgot-password">{ui("Forgot password?")}</Link>}
    {googleConfigured && <><div className="login-divider">or</div><GoogleSignIn onSuccess={signedIn} /></>}
    <div className="login-footer"><Link to={platform ? '/login' : '/platform/login'}>{platform ? 'Shop sign in' : ui("Platform administration")}</Link></div>
    <div className="login-legal"><Link to="/privacy">{ui("Privacy")}</Link><Link to="/terms">{ui("Terms")}</Link><Link to="/support">{ui("Help")}</Link></div>
  </section></main>;
}

