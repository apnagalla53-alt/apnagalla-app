import { formatDateTime } from '../../shared/dateFormat';
import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Smartphone, ShieldCheck } from 'lucide-react';
import api, { getApiErrorMessage } from '../../shared/api';
import { useAuthStore } from '../../shared/store/authStore';

type DeviceSession = { id: string; device_id?: string; issued_at: string; expires_at: string; last_active_at?: string; ip_address?: string; user_agent?: string; current: boolean };
export default function RetailDevices() {
  useUiLanguage();
  const navigate = useNavigate();
  const logout = useAuthStore(s => s.logout);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { setLoading(true); setError(''); try { const response = await api.get('/sessions'); setSessions(Array.isArray(response.data) ? response.data : response.data.data || []); } catch (err) { setError(getApiErrorMessage(err)); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const revoke = async (session: DeviceSession) => {
    if (!window.confirm(session.current ? 'Sign out this device now?' : 'Sign out this device? It will need to log in again.')) return;
    setRevoking(session.id); setError('');
    try { await api.post('/sessions/' + encodeURIComponent(session.id) + '/revoke'); if (session.current) logout(); else { setNotice('Device signed out.'); await load(); } }
    catch (err) { setError(getApiErrorMessage(err)); } finally { setRevoking(''); }
  };
  return <><StitchHeader className="r-page-header" hasBack><button className="r-btn r-btn--icon" aria-label={ui("Back to More")} onClick={() => navigate('/retail/more')}><ArrowLeft size={22} /></button><h1>{ui("Logged-in Devices")}</h1><Smartphone size={24} /></StitchHeader><main className="r-section r-account-page"><p className="r-caption">These are active sessions for your account. Sign out a device you no longer recognise.</p>{loading && <p role="status">Loading devices…</p>}{error && <div className="r-state-message" role="alert"><p>{error}</p><button className="r-btn r-btn--outline" onClick={load}>{ui("Try Again")}</button></div>}{notice && <p role="status" data-tone="success">{notice}</p>}{!loading && !error && !sessions.length && <div className="r-empty"><Smartphone size={40} /><h2>No active devices found</h2><p>Sign in again if your session has expired.</p></div>}{sessions.map(session => <article key={session.id} className="r-card"><div className="r-section-heading"><h2>{session.current ? 'This device' : 'Signed-in device'}</h2>{session.current && <span className="r-status-badge is-enabled">Current</span>}</div><p className="r-caption">{session.user_agent?.slice(0, 180) || 'Device information not available'}</p><div className="r-detail-row"><span>Last activity</span><strong>{formatDateTime(session.last_active_at || session.issued_at)}</strong></div><div className="r-detail-row"><span>Signed in</span><strong>{formatDateTime(session.issued_at)}</strong></div><button className="r-btn r-btn--outline r-btn--full" disabled={!!revoking} data-tone="danger" onClick={() => revoke(session)}>{revoking === session.id ? 'Signing out…' : 'Sign Out Device'}</button></article>)}<p className="r-caption"><ShieldCheck size={18} aria-hidden="true" /> Lost your phone? Ask an authorised shop administrator to revoke its session.</p></main></>;
}
