import DateInput from '../../shared/components/DateInput';
import { useEffect, useState } from 'react';
import { Search, Plus, Play, Lock, X, Calendar } from 'lucide-react';
import api from '../../shared/api';
import { Modal } from '../../shared/components/Modal';

interface CompanyOption { id: string; legal_name: string; code: string; }
interface FYData {
  id: string;
  company_id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_closed: boolean;
}

const emptyForm = { company_id: '', label: '', start_date: '', end_date: '' };

const FinancialYears = () => {
  const [fys, setFys] = useState<FYData[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const fetchFys = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (search) params.q = search;
      if (filterCompany) params.company_id = filterCompany;
      const res = await api.get('/financial-years/', { params });
      setFys(res.data);
    } catch {
      setError('Failed to load financial years');
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
    const t = setTimeout(() => fetchFys(), 300);
    return () => clearTimeout(t);
  }, [search, filterCompany]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.post('/financial-years/', formData);
      setShowCreate(false);
      setFormData(emptyForm);
      fetchFys();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || err.response?.data?.message || 'Failed to create financial year');
    }
  };

  const handleActivate = async (fy: FYData) => {
    if (!window.confirm(`Activate "${fy.label}"? This will deactivate the currently active financial year for this company.`)) return;
    try {
      await api.patch(`/financial-years/${fy.id}/activate`);
      fetchFys();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to activate');
    }
  };

  const handleClose = async (fy: FYData) => {
    if (!window.confirm(`Close "${fy.label}"? This action is IRREVERSIBLE. The financial year will be permanently locked.`)) return;
    try {
      await api.patch(`/financial-years/${fy.id}/close`);
      fetchFys();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to close');
    }
  };

  const companyName = (cid: string) => companies.find(c => c.id === cid)?.legal_name || cid.slice(0, 8);

  const statusBadge = (fy: FYData) => {
    if (fy.is_closed) return <span className="badge badge-danger">Closed</span>;
    if (fy.is_active) return <span className="badge badge-success">Active</span>;
    return <span className="badge">Inactive</span>;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1>Financial Year Management</h1>
        <button className="btn btn-primary" onClick={() => { setFormData(emptyForm); setFormError(''); setShowCreate(true); }}>
          <Plus size={16} /> Create Financial Year
        </button>
      </div>

      <div className="card mb-4 flex items-center gap-2 flex-wrap" style={{ gap: '0.75rem' }}>
        <Search size={18} className="text-muted" />
        <input type="text" className="form-control" style={{ flex: '1 1 200px' }} placeholder="Search by label..." value={search} onChange={e => setSearch(e.target.value)} />
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
              <th>Label</th>
              <th>Company</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center">Loading...</td></tr>
            ) : fys.length === 0 ? (
              <tr><td colSpan={6} className="text-center">No financial years found.</td></tr>
            ) : (
              fys.map(fy => (
                <tr key={fy.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-muted" />
                      <strong>{fy.label}</strong>
                    </div>
                  </td>
                  <td>{companyName(fy.company_id)}</td>
                  <td>{fy.start_date}</td>
                  <td>{fy.end_date}</td>
                  <td>{statusBadge(fy)}</td>
                  <td>
                    <div className="flex gap-2">

                      {!fy.is_active && !fy.is_closed && (
                        <button className="btn btn-primary btn-icon" title="Activate" onClick={() => handleActivate(fy)}><Play size={16} /></button>
                      )}
                      {!fy.is_closed && (
                        <button className="btn btn-danger btn-icon" title="Close (Irreversible)" onClick={() => handleClose(fy)}><Lock size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal title="Create Financial Year" isOpen={showCreate} onClose={() => setShowCreate(false)}>
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
            <label className="form-label">Label</label>
            <input required type="text" className="form-control" placeholder="e.g. FY 2026-27" value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <DateInput required type="date" className="form-control" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} lang="en-GB" />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <DateInput required type="date" className="form-control" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} lang="en-GB" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default FinancialYears;

