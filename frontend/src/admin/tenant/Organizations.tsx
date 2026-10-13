import { useEffect, useState } from 'react';
import { Edit, Search } from 'lucide-react';
import api from '../../shared/api';
import { Modal } from '../../shared/components/Modal';

interface Organization { id: string; name: string; legal_name: string | null; code: string; is_active: boolean; }

const Organizations = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Organization | null>(null);
  const load = async () => {
    setLoading(true); setError('');
    try { setOrganizations((await api.get('/organizations/', { params: { q: search || undefined } })).data); }
    catch (failure: any) { setError(failure.response?.data?.message || 'Could not load your organization.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { const timer = setTimeout(load, 300); return () => clearTimeout(timer); }, [search]);
  return <div>
    <h1>Organization Management</h1>
    <p>Manage your organization's business name. New tenant creation, suspension and subscription controls require Platform authorization.</p>
    <div className="card mb-4 flex items-center gap-2"><Search size={18} aria-hidden="true" /><label className="sr-only" htmlFor="organization-search">Search your organization</label><input id="organization-search" className="form-control" placeholder="Search organizations..." value={search} onChange={event => setSearch(event.target.value)} /></div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="card table-container"><table className="table"><thead><tr><th>Code</th><th>Name</th><th>Legal name</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={5}>Loading your organization...</td></tr> : organizations.length === 0 ? <tr><td colSpan={5}>No matching organization.</td></tr> : organizations.map(organization => <tr key={organization.id}><td>{organization.code}</td><td>{organization.name}</td><td>{organization.legal_name || '—'}</td><td>{organization.is_active ? 'Active' : 'Inactive'}</td><td><button className="btn btn-secondary" onClick={() => setEditing(organization)}><Edit size={16} /> Edit organization</button></td></tr>)}
    </tbody></table></div>
    <Modal title="Edit organization" isOpen={!!editing} onClose={() => setEditing(null)}>{editing && <form onSubmit={async event => {
      event.preventDefault(); setError('');
      try { await api.patch(`/organizations/${editing.id}`, { name: editing.name, legal_name: editing.legal_name || '' }); setEditing(null); await load(); }
      catch (failure: any) { setError(failure.response?.data?.message || 'Could not save organization details.'); }
    }}>
      <label className="form-label" htmlFor="organization-name">Organization name</label><input id="organization-name" required className="form-control" value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} />
      <label className="form-label" htmlFor="organization-legal-name">Legal name</label><input id="organization-legal-name" className="form-control" value={editing.legal_name || ''} onChange={event => setEditing({ ...editing, legal_name: event.target.value })} />
      {error && <p role="alert" className="form-error">{error}</p>}<div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="btn btn-primary">Save details</button></div>
    </form>}</Modal>
  </div>;
};
export default Organizations;
