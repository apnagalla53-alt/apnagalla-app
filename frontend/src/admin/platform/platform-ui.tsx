import { useCallback, useEffect, useState, useId, isValidElement, cloneElement } from 'react';
import api, { getApiErrorMessage } from '../../shared/api';
import './platform.css';

export function usePlatform<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { setData((await api.get('/platform/admin/' + endpoint)).data); }
    catch (e) { setError(getApiErrorMessage(e)); }
    finally { setLoading(false); }
  }, [endpoint]);
  useEffect(() => { void reload(); }, [reload]);
  async function save(path: string, body: unknown, method: 'post' | 'patch' = 'post') {
    if (busy) return false;
    setBusy(true); setError('');
    try { await api[method]('/platform/admin/' + path, body); await reload(); return true; }
    catch (e) { setError(getApiErrorMessage(e)); return false; }
    finally { setBusy(false); }
  }
  return { data, error, loading, busy, reload, save };
}
export function Notice({ state }: { state: { loading: boolean; error: string; reload: () => unknown } }) {
  if (state.error) return <div className="platform-error" role="alert">{state.error} <button onClick={() => void state.reload()}>Retry</button></div>;
  if (state.loading) return <p role="status">Loading…</p>;
  return null;
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id=useId();
  return <div className="platform-field"><label htmlFor={id}>{label}</label>{isValidElement(children)?cloneElement(children as React.ReactElement<any>,{id}):children}</div>;
}
export const dateInput = (date?: string) => date ? date.slice(0, 10) : new Date().toISOString().slice(0, 10);
export const money = (value: unknown) => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const when = (value: string | null) => value ? new Date(value).toLocaleString() : 'No activity recorded';
export function Rows({ rows, columns }: { rows: any[]; columns: { name: string; render: (row: any) => React.ReactNode }[] }) {
  if (!rows.length) return <p className="platform-empty">No records yet.</p>;
  return <div className="platform-table-wrap"><table className="platform-table"><thead><tr>{columns.map(c => <th key={c.name}>{c.name}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={row.id || i}>{columns.map(c => <td key={c.name}>{c.render(row)}</td>)}</tr>)}</tbody></table></div>;
}
