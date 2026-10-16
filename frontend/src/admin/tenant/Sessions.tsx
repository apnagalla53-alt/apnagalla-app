import { formatDateTime } from '../../shared/dateFormat';
import { useEffect, useState } from 'react';
import api from '../../shared/api';
import { Trash } from 'lucide-react';
import { useAuthStore } from '../../shared/store/authStore';

interface SessionData {
  id: string;
  user_id: string;
  ip_address: string;
  user_agent: string;
  issued_at: string;
  expires_at: string;
  current: boolean;
}

const Sessions = () => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { logout } = useAuthStore();

  const fetchSessions = async () => {
    try {
      const res = await api.get('/sessions/'); 
      setSessions(res.data);
    } catch (err) {
      setError('Could not load your signed-in devices. Refresh to try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Revoke session?')) return;
    try {
      await api.post(`/sessions/${id}/revoke`);
      if (sessions.find(session => session.id === id)?.current) {
        logout();
      } else {
        fetchSessions();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'Could not sign this device out.');
    }
  };

  const parseUserAgent = (ua: string) => {
    if (!ua) return 'Unknown Device';
    if (ua.includes('Chrome')) return 'Chrome Browser';
    if (ua.includes('Firefox')) return 'Firefox Browser';
    if (ua.includes('Safari')) return 'Safari Browser';
    if (ua.includes('Postman')) return 'Postman API Client';
    if (ua.includes('Playwright')) return 'Playwright Tests';
    return ua.length > 30 ? ua.substring(0, 30) + '...' : ua;
  };

  return (
    <div>
      <h1 className="mb-4">Your Signed-in Devices</h1>
      <p>Sign out a device you no longer use. Signing out this device returns you to login.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="card table-container">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>IP Address</th>
              <th>Device / Browser</th>
              <th>Expires</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center">Loading...</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={5} className="text-center">No active sessions.</td></tr>
            ) : (
              sessions.map(s => {
                const isCurrent = s.current;
                return (
                  <tr key={s.id} style={{ backgroundColor: isCurrent ? 'var(--background)' : undefined }}>
                    <td>
                      {s.id.substring(0, 8)}...
                      {isCurrent && <span className="badge badge-success ml-2" style={{marginLeft: '0.5rem'}}>Current</span>}
                    </td>
                    <td>{s.ip_address}</td>
                    <td title={s.user_agent}>{parseUserAgent(s.user_agent)}</td>
                    <td>{formatDateTime(s.expires_at)}</td>
                    <td>
                      <button className="btn btn-danger btn-icon" onClick={() => handleRevoke(s.id)} aria-label={isCurrent ? "Sign out this device" : "Sign out device"} title={isCurrent ? "Revoke Own Session" : "Revoke Session"}>
                        <Trash size={16}/>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Sessions;

