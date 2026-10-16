import StitchHeader from '../retail/design/StitchHeader';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import api from '../shared/api';
import { useAuthStore } from '../shared/store/authStore';
import GoogleSignIn, { googleSignInAvailable } from './GoogleSignIn';
import './Login.css';
import MobileAccountLink from './MobileAccountLink';

const errorMessage = (failure: any) => { const message = failure.response?.data?.message; return Array.isArray(message) ? message.join('. ') : message || 'Cannot connect. Please try again.'; };

export default function Security() {
  const [data, setData] = useState<any>(null); const [capabilities, setCapabilities] = useState<any>(null);
  const [version, setVersion] = useState(0); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''); const [emailPassword, setEmailPassword] = useState(''); const [googlePassword, setGooglePassword] = useState('');
  const [initialPassword,setInitialPassword]=useState('');
  useEffect(() => {
    let cancelled = false; setLoading(true); setError('');
    Promise.all([api.get('/auth/security'), api.get('/auth/capabilities')]).then(([security, configuration]) => {
      if (cancelled) return; setData(security.data); setCapabilities(configuration.data); setEmail(security.data.recovery_email || '');
    }).catch(failure => { if (!cancelled) setError(errorMessage(failure)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [version]);

  return <><StitchHeader hasBack><Link className="r-btn r-btn--icon" to="/retail/more" aria-label="Back to More"><ArrowLeft /></Link><h1>Account security</h1></StitchHeader>
    <div className="r-section security-sections">
      {loading ? <p role="status">Loading account security…</p> : !data ? <div className="r-card" role="alert"><p>{error || 'Could not load account security.'}</p><button className="r-btn" onClick={() => setVersion(value => value + 1)}>Try again</button></div> : <>
        {error && <div className="r-card" role="alert">{error}</div>}{message && <div className="r-card" role="status" data-tone="success">{message}</div>}
        <section className="r-card"><h2><KeyRound size={22} />Your password</h2><p>Use a password you do not share. Changing it signs out all your devices.</p>{data.password_login_enabled?<Link className="r-btn r-btn--primary" to="/change-password">Change password</Link>:<form className="security-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api.post('/auth/account/password/create',{password:initialPassword});setInitialPassword('');useAuthStore.getState().logout();}catch(e){setError(errorMessage(e));setBusy(false);}}}><p>Sign in again with mobile or Google, then create a password within five minutes. Use at least 8 characters. Letters or numbers alone are allowed.</p><label>New password<input className="r-input" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={initialPassword} onChange={e=>setInitialPassword(e.target.value)}/></label><button className="r-btn r-btn--primary" disabled={busy}>Create password and sign out</button></form>}</section>
        <section className="r-card"><h2><Smartphone size={22}/>Mobile sign-in</h2><p>{data.mobile_connected?'Verified mobile: '+data.mobile_number:'Your contact phone is not yet a verified sign-in number.'}</p><p>{capabilities?.mobile_otp_configured?'Mobile verification is available. Connecting an existing number requires your account password.':'Mobile OTP is not configured by the service operator yet.'}</p><MobileAccountLink enabled={!!capabilities?.mobile_otp_configured&&!!data.password_login_enabled&&!data.mobile_connected} onDone={()=>setVersion(v=>v+1)}/></section>
        <section className="r-card"><h2><Mail size={22} />Recovery email</h2>
          <p>{data.recovery_email_verified ? `Verified: ${data.recovery_email}` : 'Add and verify an email so you can recover your shop account.'}</p>
          {capabilities?.password_recovery_configured ? <form className="security-form" onSubmit={async event => {
            event.preventDefault(); if (busy) return; setBusy(true); setError(''); setMessage('');
            try { setMessage((await api.post('/auth/email/request-verification', { email, current_password: emailPassword })).data.message); setEmailPassword(''); }
            catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
          }}><label htmlFor="security-email">Recovery email</label><input id="security-email" className="r-input" type="email" autoComplete="email" value={email} required maxLength={255} onChange={event => setEmail(event.target.value)} />
            <label htmlFor="security-email-password">Current password</label><input id="security-email-password" className="r-input" type="password" autoComplete="current-password" value={emailPassword} required maxLength={255} onChange={event => setEmailPassword(event.target.value)} />
            <button className="r-btn r-btn--primary" disabled={busy}>{busy ? 'Sending…' : 'Send verification link'}</button></form> : <p className="r-caption">Email recovery is not configured by your service operator yet. Google can provide a verified recovery address when connected.</p>}
        </section>
        <section className="r-card"><h2><ShieldCheck size={22} />Google sign in</h2><p>{data.google_connected ? 'Google is connected to your shop account.' : 'Connect Google once with your current password. You can then use it to sign in on the website and Android app.'}</p>
          {!capabilities?.google_client_id ? <p className="r-caption">Google sign in is not configured by your service operator yet.</p> : !googleSignInAvailable() ? <p className="r-caption">Google sign in is unavailable on this device. You can still use your shop password.</p> : <div className="security-form">
            <label htmlFor="security-google-password">Current password</label><input id="security-google-password" className="r-input" type="password" autoComplete="current-password" value={googlePassword} maxLength={255} onChange={event => setGooglePassword(event.target.value)} />
            {data.google_connected ? <button className="r-btn r-btn--danger" disabled={busy || !googlePassword} onClick={async () => {
              if (busy) return; setBusy(true); setError('');
              try { await api.post('/auth/google/unlink', { current_password: googlePassword }); useAuthStore.getState().logout(); }
              catch (failure) { setError(errorMessage(failure)); setBusy(false); }
            }}>Disconnect Google and sign out</button> : <><p className="r-caption">Enter your current password, then choose your Google account.</p><GoogleSignIn mode="link" enabled={!!googlePassword} password={googlePassword} onSuccess={result => { setGooglePassword(''); setMessage(result.message); setVersion(value => value + 1); }} /></>}
          </div>}
        </section>
        <section className="r-card"><h2><Smartphone size={22} />Signed-in devices</h2><p>Review the devices using your account and sign out ones you no longer use.</p><Link className="r-btn" to="/retail/more/devices">View signed-in devices</Link></section>
      </>}
    </div></>;
}
