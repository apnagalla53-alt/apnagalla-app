import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../shared/api';
import './Login.css';

const messageFor = (error: any) => {
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join('. ') : message || 'Cannot connect. Please try again.';
};

function RecoveryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="login-container"><section className="login-card"><div className="login-brand">EVOLIX</div><h1>{title}</h1>{children}<Link to="/login">Back to sign in</Link></section></main>;
}

export function ForgotPassword() {
  const [identifier, setIdentifier] = useState(''); const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  return <RecoveryCard title="Forgot your password?">
    <p>Enter your shop username or verified recovery email. We will email a link if recovery is available for this account.</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (loading) return; setLoading(true); setError(''); setMessage('');
      try { setMessage((await api.post('/auth/password/forgot', { identifier })).data.message); }
      catch (failure) { setError(messageFor(failure)); } finally { setLoading(false); }
    }}><label>Username or recovery email<input autoComplete="username" required maxLength={255} value={identifier} onChange={event => setIdentifier(event.target.value)} /></label>
      <button disabled={loading}>{loading ? 'Requesting link…' : 'Send reset link'}</button>
    </form>{error && <p role="alert" className="login-error">{error}</p>}{message && <p role="status">{message}</p>}
  </RecoveryCard>;
}

function readSecret() {
  const token = new URLSearchParams(window.location.hash.substring(1)).get('token') || '';
  return token;
}

export function ResetPassword() {
  const [showPassword,setShowPassword]=useState(false);
  const [token] = useState(readSecret); const [password, setPassword] = useState(''); const [repeat, setRepeat] = useState('');
  useEffect(() => { if (token) window.history.replaceState(null, '', window.location.pathname); }, [token]);
  const [loading, setLoading] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState('');
  return <RecoveryCard title={done ? 'Password changed' : 'Choose a new password'}>
    {done ? <p role="status">Your other devices have been signed out. Sign in with your new password.</p> : !token ? <p role="alert">This link has no reset token. <Link to="/forgot-password">Request a new reset link</Link>.</p> : <>
      <p>Staff: use at least 8 characters. Owners: use 12 or more characters with uppercase, lowercase, a number and a symbol. Keep it different from recent passwords.</p>
      <form onSubmit={async event => {
        event.preventDefault(); if (loading) return;
        if (password !== repeat) { setError('The two passwords do not match.'); return; }
        setLoading(true); setError('');
        try { await api.post('/auth/password/reset', { token, password }); setPassword(''); setRepeat(''); setDone(true); }
        catch (failure) { setError(messageFor(failure)); } finally { setLoading(false); }
      }}><label>New password<input type={showPassword?'text':'password'} autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label>Confirm new password<input type={showPassword?'text':'password'} autoComplete="new-password" required minLength={8} maxLength={72} value={repeat} onChange={event => setRepeat(event.target.value)} /></label>
        <label className="login-checkbox"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/>Show password</label>
        <button disabled={loading}>{loading ? 'Changing password…' : 'Save new password'}</button>
      </form></>}
    {error && <p role="alert" className="login-error">{error}</p>}
  </RecoveryCard>;
}

export function VerifyEmail() {
  const [token] = useState(readSecret); const [loading, setLoading] = useState(false);
  useEffect(() => { if (token) window.history.replaceState(null, '', window.location.pathname); }, [token]);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  return <RecoveryCard title="Verify recovery email">
    <p>Confirm this address so you can recover your shop account if you forget your password.</p>
    {!token ? <p role="alert">This link has no verification token. Request a new link from Security in your shop.</p> : !message && <button disabled={loading} onClick={async () => {
      if (loading) return; setLoading(true); setError('');
      try { setMessage((await api.post('/auth/email/verify', { token })).data.message); }
      catch (failure) { setError(messageFor(failure)); } finally { setLoading(false); }
    }}>{loading ? 'Verifying…' : 'Verify this email'}</button>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="login-error">{error}</p>}
  </RecoveryCard>;
}
