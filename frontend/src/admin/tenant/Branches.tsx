import { useEffect, useState } from 'react';
import { Search, Plus, Edit, Ban, CheckCircle, X } from 'lucide-react';
import api from '../../shared/api';
import { Modal } from '../../shared/components/Modal';

interface CompanyOption { id: string; legal_name: string; code: string; }
interface BranchData {
  id: string;
  company_id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

const emptyForm = {
  company_id: '', code: '', name: '', address: '', city: '', state: '',
  country: 'India', postal_code: '', phone: '', email: '',
};

const Branches = () => {
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<BranchData | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const fetchBranches = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (search) params.q = search;
      if (filterCompany) params.company_id = filterCompany;
      const res = await api.get('/branches/', { params });
      setBranches(res.data);
    } catch {
      setError('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/companies/');
      setCompanies(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchCompanies(); }, []);
  useEffect(() => {
    const t = setTimeout(() => fetchBranches(), 300);
    return () => clearTimeout(t);
  }, [search, filterCompany]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.post('/branches/', formData);
      setShowCreate(false);
      setFormData(emptyForm);
      fetchBranches();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || err.response?.data?.message || 'Failed to create branch');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEdit) return;
    setFormError('');
    try {
      await api.patch(`/branches/${showEdit.id}`, {
        name: showEdit.name, address: showEdit.address, city: showEdit.city,
        state: showEdit.state, country: showEdit.country, postal_code: showEdit.postal_code,
        phone: showEdit.phone, email: showEdit.email,
      });
      setShowEdit(null);
      fetchBranches();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to update');
    }
  };

  const handleToggle = async (b: BranchData) => {
    const action = b.is_active ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${action} "${b.name}"?`)) return;
    try {
      await api.patch(`/branches/${b.id}/${action}`);
      fetchBranches();
    } catch (err: any) {
      alert(err.response?.data?.detail || `Failed to ${action}`);
    }
  };

  const companyName = (cid: string) => companies.find(c => c.id === cid)?.legal_name || cid.slice(0, 8);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1>Branch Management</h1>
        <button className="btn btn-primary" onClick={() => { setFormData(emptyForm); setFormError(''); setShowCreate(true); }}>
          <Plus size={16} /> Create Branch
        </button>
      </div>

      <div className="card mb-4 flex items-center gap-2 flex-wrap" style={{ gap: '0.75rem' }}>
        <Search size={18} className="text-muted" />
        <input type="text" className="form-control" style={{ flex: '1 1 200px' }} placeholder="Search branches..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-control" style={{ width: 'auto', minWidth: '180px' }} value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.legal_name} ({c.code})</option>)}
        </select>
        {(search || filterCompany) && <button className="btn btn-secondary btn-icon" onClick={() => { setSearch(''); setFilterCompany(''); }}><X size={16} /></button>}
      </div>

      {error && <div className="form-error mb-4">{error}</div>}

      <div className="card table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Company</th>
              <th>City</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center">Loading...</td></tr>
            ) : branches.length === 0 ? (
              <tr><td colSpan={6} className="text-center">No branches found.</td></tr>
            ) : (
              branches.map(b => (
                <tr key={b.id}>
                  <td><strong>{b.code}</strong></td>
                  <td>{b.name}</td>
                  <td>{companyName(b.company_id)}</td>
                  <td>{b.city || '—'}</td>
                  <td>
                    {b.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Disabled</span>}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-icon" title="Edit" onClick={() => { setFormError(''); setShowEdit(b); }}><Edit size={16} /></button>
                      {b.is_active
                        ? <button className="btn btn-danger btn-icon" title="Disable" onClick={() => handleToggle(b)}><Ban size={16} /></button>
                        : <button className="btn btn-secondary btn-icon" title="Enable" onClick={() => handleToggle(b)}><CheckCircle size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal title="Create Branch" isOpen={showCreate} onClose={() => setShowCreate(false)}>
        <form onSubmit={handleCreate}>
          {formError && <div className="form-error mb-4">{formError}</div>}
          <div className="form-group">
            <label className="form-label">Company</label>
            <select required className="form-control" value={formData.company_id} onChange={e => setFormData({ ...formData, company_id: e.target.value })}>
              <option value="">Select Company</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.legal_name} ({c.code})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Code</label>
            <input required type="text" className="form-control" placeholder="e.g. MAIN" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input required type="text" className="form-control" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div className="form-group">
              <label className="form-label">City</label>
              <input type="text" className="form-control" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input type="text" className="form-control" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input type="text" className="form-control" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="text" className="form-control" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      <Modal title="Edit Branch" isOpen={!!showEdit} onClose={() => setShowEdit(null)}>
        {showEdit && (
          <form onSubmit={handleUpdate}>
            {formError && <div className="form-error mb-4">{formError}</div>}
            <div className="form-group">
              <label className="form-label">Code</label>
              <input type="text" className="form-control" value={showEdit.code} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input required type="text" className="form-control" value={showEdit.name} onChange={e => setShowEdit({ ...showEdit, name: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="form-group">
                <label className="form-label">City</label>
                <input type="text" className="form-control" value={showEdit.city || ''} onChange={e => setShowEdit({ ...showEdit, city: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input type="text" className="form-control" value={showEdit.state || ''} onChange={e => setShowEdit({ ...showEdit, state: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input type="text" className="form-control" value={showEdit.address || ''} onChange={e => setShowEdit({ ...showEdit, address: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input type="text" className="form-control" value={showEdit.phone || ''} onChange={e => setShowEdit({ ...showEdit, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" value={showEdit.email || ''} onChange={e => setShowEdit({ ...showEdit, email: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default Branches;

