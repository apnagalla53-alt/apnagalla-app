import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../shared/store/authStore';
import api from '../shared/api';
import './Login.css';
import { clearNativeGoogleState } from '../shared/googleNative';

export default function ChangePassword() {
  const user = useAuthStore(state => state.user);
  const platform = !!user?.is_platform;
  const forced = !!(user as any)?.must_change_password;
  const minimum = platform ? 16 : user?.password_min_length === 8 ? 8 : 12;
  const [showPassword, setShowPassword] = useState(false);
  const [current, setCurrent] = useState(''); const [password, setPassword] = useState(''); const [repeat, setRepeat] = useState('');
  const [loading, setLoading] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState('');
  return <main className="login-container"><section className="login-card"><div className="login-brand">EVOLIX</div><h1>{done ? 'Password changed' : forced ? 'Secure your shop account' : 'Change password'}</h1>
    {done ? <><p role="status">All your devices have been signed out. Use your new password to sign in.</p><Link to={platform ? '/platform/login' : '/login'}>Sign in again</Link></> : <>
      <p>{forced ? 'Your administrator gave you a temporary password. Choose your own password before opening your shop.' : 'Changing your password signs out every device, including this one.'}</p>
      <p className="login-hint">{minimum === 8 ? 'Use at least 8 characters. Uppercase letters, numbers and symbols are optional.' : `Use ${minimum} or more characters with uppercase, lowercase, a number and a symbol.`}</p>
      <form onSubmit={async event => {
        event.preventDefault(); if (loading) return;
        if (password !== repeat) { setError('The two new passwords do not match.'); return; }
        setLoading(true); setError('');
        try {
          await api.post(platform ? '/platform/auth/password/change' : '/auth/password/change', { current_password: current, password });
          await clearNativeGoogleState();
          useAuthStore.setState({ session_id: null, user: null, tenantContext: null });
          setCurrent(''); setPassword(''); setRepeat(''); setDone(true);
        } catch (failure: any) { const message = failure.response?.data?.message; setError(Array.isArray(message) ? message.join('. ') : message || 'Cannot connect. Please try again.'); }
        finally { setLoading(false); }
      }}><label>{forced ? 'Temporary password' : 'Current password'}<input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={255} value={current} onChange={event => setCurrent(event.target.value)} /></label>
        <label>New password<input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={minimum} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label>Confirm new password<input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={minimum} maxLength={72} value={repeat} onChange={event => setRepeat(event.target.value)} /></label>
        <label className="login-checkbox"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/>Show password</label>
        {error && <p role="alert" className="login-error">{error}</p>}
        <button disabled={loading}>{loading ? 'Changing password…' : 'Save new password'}</button>
      </form>{!forced && <Link to={platform ? '/platform/dashboard' : '/retail/more/security'}>Back</Link>}
    </>}
  </section></main>;
}
