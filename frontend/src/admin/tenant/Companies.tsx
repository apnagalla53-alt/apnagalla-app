import { useEffect, useState } from 'react';
import { Search, Plus, Edit, Ban, CheckCircle, X } from 'lucide-react';
import api from '../../shared/api';
import { Modal } from '../../shared/components/Modal';

interface OrgOption { id: string; name: string; code: string; }
interface CompanyData {
  id: string;
  organization_id: string;
  code: string;
  legal_name: string;
  trade_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  pan: string | null;
  timezone: string;
  fy_start_month: number;
  is_active: boolean;
}

const emptyForm = {
  organization_id: '', code: '', legal_name: '', trade_name: '',
  address: '', city: '', state: '', country: 'India', postal_code: '',
  phone: '', email: '', gstin: '', pan: '', timezone: 'Asia/Kolkata', fy_start_month: 4,
};

const Companies = () => {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterOrg, setFilterOrg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<CompanyData | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const fetchCompanies = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (search) params.q = search;
      if (filterOrg) params.organization_id = filterOrg;
      const res = await api.get('/companies/', { params });
      setCompanies(res.data);
    } catch {
      setError('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgs = async () => {
    try {
      const res = await api.get('/organizations/');
      setOrgs(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchOrgs(); }, []);
  useEffect(() => {
    const t = setTimeout(() => fetchCompanies(), 300);
    return () => clearTimeout(t);
  }, [search, filterOrg]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.post('/companies/', { ...formData, fy_start_month: Number(formData.fy_start_month) });
      setShowCreate(false);
      setFormData(emptyForm);
      fetchCompanies();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || err.response?.data?.message || 'Failed to create company');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEdit) return;
    setFormError('');
    try {
      await api.patch(`/companies/${showEdit.id}`, {
        legal_name: showEdit.legal_name,
        trade_name: showEdit.trade_name,
        address: showEdit.address,
        city: showEdit.city,
        state: showEdit.state,
        country: showEdit.country,
        postal_code: showEdit.postal_code,
        phone: showEdit.phone,
        email: showEdit.email,
        gstin: showEdit.gstin,
        pan: showEdit.pan,
        timezone: showEdit.timezone,
        fy_start_month: showEdit.fy_start_month,
      });
      setShowEdit(null);
      fetchCompanies();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to update');
    }
  };

  const handleToggle = async (c: CompanyData) => {
    const action = c.is_active ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${action} "${c.legal_name}"?`)) return;
    try {
      await api.patch(`/companies/${c.id}/${action}`);
      fetchCompanies();
    } catch (err: any) {
      alert(err.response?.data?.detail || `Failed to ${action}`);
    }
  };

  const orgName = (orgId: string) => orgs.find(o => o.id === orgId)?.name || orgId.slice(0, 8);

  const renderFormFields = (data: any, setData: (d: any) => void, isCreate: boolean) => (
    <>
      {isCreate && (
        <>
          <div className="form-group">
            <label className="form-label">Organization</label>
            <select required className="form-control" value={data.organization_id} onChange={e => setData({ ...data, organization_id: e.target.value })}>
              <option value="">Select Organization</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Code</label>
            <input required type="text" className="form-control" placeholder="e.g. EDT" value={data.code} onChange={e => setData({ ...data, code: e.target.value })} />
          </div>
        </>
      )}
      <div className="form-group">
        <label className="form-label">Legal Name</label>
        <input required type="text" className="form-control" value={data.legal_name} onChange={e => setData({ ...data, legal_name: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Trade Name</label>
        <input type="text" className="form-control" value={data.trade_name || ''} onChange={e => setData({ ...data, trade_name: e.target.value })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div className="form-group">
          <label className="form-label">City</label>
          <input type="text" className="form-control" value={data.city || ''} onChange={e => setData({ ...data, city: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">State</label>
          <input type="text" className="form-control" value={data.state || ''} onChange={e => setData({ ...data, state: e.target.value })} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Address</label>
        <input type="text" className="form-control" value={data.address || ''} onChange={e => setData({ ...data, address: e.target.value })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input type="text" className="form-control" value={data.phone || ''} onChange={e => setData({ ...data, phone: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input type="email" className="form-control" value={data.email || ''} onChange={e => setData({ ...data, email: e.target.value })} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div className="form-group">
          <label className="form-label">GSTIN</label>
          <input type="text" className="form-control" value={data.gstin || ''} onChange={e => setData({ ...data, gstin: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">PAN</label>
          <input type="text" className="form-control" value={data.pan || ''} onChange={e => setData({ ...data, pan: e.target.value })} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div className="form-group">
          <label className="form-label">Timezone</label>
          <input type="text" className="form-control" value={data.timezone} onChange={e => setData({ ...data, timezone: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">FY Start Month</label>
          <select className="form-control" value={data.fy_start_month} onChange={e => setData({ ...data, fy_start_month: Number(e.target.value) })}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <option key={m} value={m}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1>Company Management</h1>
        <button className="btn btn-primary" onClick={() => { setFormData(emptyForm); setFormError(''); setShowCreate(true); }}>
          <Plus size={16} /> Create Company
        </button>
      </div>

      <div className="card mb-4 flex items-center gap-2 flex-wrap" style={{ gap: '0.75rem' }}>
        <Search size={18} className="text-muted" />
        <input type="text" className="form-control" style={{ flex: '1 1 200px' }} placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-control" style={{ width: 'auto', minWidth: '180px' }} value={filterOrg} onChange={e => setFilterOrg(e.target.value)}>
          <option value="">All Organizations</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {(search || filterOrg) && <button className="btn btn-secondary btn-icon" onClick={() => { setSearch(''); setFilterOrg(''); }}><X size={16} /></button>}
      </div>

      {error && <div className="form-error mb-4">{error}</div>}

      <div className="card table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Legal Name</th>
              <th>Organization</th>
              <th>City</th>
              <th>GSTIN</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center">Loading...</td></tr>
            ) : companies.length === 0 ? (
              <tr><td colSpan={7} className="text-center">No companies found.</td></tr>
            ) : (
              companies.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.code}</strong></td>
                  <td>{c.legal_name}</td>
                  <td>{orgName(c.organization_id)}</td>
                  <td>{c.city || '—'}</td>
                  <td>{c.gstin || '—'}</td>
                  <td>
                    {c.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Disabled</span>}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-icon" title="Edit" onClick={() => { setFormError(''); setShowEdit(c); }}><Edit size={16} /></button>
                      {c.is_active
                        ? <button className="btn btn-danger btn-icon" title="Disable" onClick={() => handleToggle(c)}><Ban size={16} /></button>
                        : <button className="btn btn-secondary btn-icon" title="Enable" onClick={() => handleToggle(c)}><CheckCircle size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal title="Create Company" isOpen={showCreate} onClose={() => setShowCreate(false)}>
        <form onSubmit={handleCreate}>
          {formError && <div className="form-error mb-4">{formError}</div>}
          {renderFormFields(formData, setFormData, true)}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      <Modal title="Edit Company" isOpen={!!showEdit} onClose={() => setShowEdit(null)}>
        {showEdit && (
          <form onSubmit={handleUpdate}>
            {formError && <div className="form-error mb-4">{formError}</div>}
            <div className="form-group">
              <label className="form-label">Code</label>
              <input type="text" className="form-control" value={showEdit.code} disabled />
            </div>
            {renderFormFields(showEdit, setShowEdit as any, false)}
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

export default Companies;

