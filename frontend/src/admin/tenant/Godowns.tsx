import { useEffect, useState } from 'react';
import { Search, Plus, Edit, Ban, CheckCircle, X } from 'lucide-react';
import api from '../../shared/api';
import { Modal } from '../../shared/components/Modal';

interface BranchOption { id: string; name: string; code: string; }
interface GodownData {
  id: string;
  branch_id: string;
  code: string;
  name: string;
  address: string | null;
  description: string | null;
  is_active: boolean;
}

const emptyForm = { branch_id: '', code: '', name: '', address: '', description: '' };

const Godowns = () => {
  const [godowns, setGodowns] = useState<GodownData[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<GodownData | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const fetchGodowns = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (search) params.q = search;
      if (filterBranch) params.branch_id = filterBranch;
      const res = await api.get('/godowns/', { params });
      setGodowns(res.data);
    } catch {
      setError('Failed to load godowns');
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches/');
      setBranches(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchBranches(); }, []);
  useEffect(() => {
    const t = setTimeout(() => fetchGodowns(), 300);
    return () => clearTimeout(t);
  }, [search, filterBranch]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.post('/godowns/', formData);
      setShowCreate(false);
      setFormData(emptyForm);
      fetchGodowns();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || err.response?.data?.message || 'Failed to create godown');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEdit) return;
    setFormError('');
    try {
      await api.patch(`/godowns/${showEdit.id}`, {
        name: showEdit.name, address: showEdit.address, description: showEdit.description,
      });
      setShowEdit(null);
      fetchGodowns();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to update');
    }
  };

  const handleToggle = async (g: GodownData) => {
    const action = g.is_active ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${action} "${g.name}"?`)) return;
    try {
      await api.patch(`/godowns/${g.id}/${action}`);
      fetchGodowns();
    } catch (err: any) {
      alert(err.response?.data?.detail || `Failed to ${action}`);
    }
  };

  const branchName = (bid: string) => branches.find(b => b.id === bid)?.name || bid.slice(0, 8);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1>Godown Management</h1>
        <button className="btn btn-primary" onClick={() => { setFormData(emptyForm); setFormError(''); setShowCreate(true); }}>
          <Plus size={16} /> Create Godown
        </button>
      </div>

      <div className="card mb-4 flex items-center gap-2 flex-wrap" style={{ gap: '0.75rem' }}>
        <Search size={18} className="text-muted" />
        <input type="text" className="form-control" style={{ flex: '1 1 200px' }} placeholder="Search godowns..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-control" style={{ width: 'auto', minWidth: '180px' }} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
          <option value="">All Branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
        </select>
        {(search || filterBranch) && <button className="btn btn-secondary btn-icon" onClick={() => { setSearch(''); setFilterBranch(''); }}><X size={16} /></button>}
      </div>

      {error && <div className="form-error mb-4">{error}</div>}

      <div className="card table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Branch</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center">Loading...</td></tr>
            ) : godowns.length === 0 ? (
              <tr><td colSpan={6} className="text-center">No godowns found.</td></tr>
            ) : (
              godowns.map(g => (
                <tr key={g.id}>
                  <td><strong>{g.code}</strong></td>
                  <td>{g.name}</td>
                  <td>{branchName(g.branch_id)}</td>
                  <td>{g.description || '—'}</td>
                  <td>
                    {g.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Disabled</span>}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-icon" title="Edit" onClick={() => { setFormError(''); setShowEdit(g); }}><Edit size={16} /></button>
                      {g.is_active
                        ? <button className="btn btn-danger btn-icon" title="Disable" onClick={() => handleToggle(g)}><Ban size={16} /></button>
                        : <button className="btn btn-secondary btn-icon" title="Enable" onClick={() => handleToggle(g)}><CheckCircle size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal title="Create Godown" isOpen={showCreate} onClose={() => setShowCreate(false)}>
        <form onSubmit={handleCreate}>
          {formError && <div className="form-error mb-4">{formError}</div>}
          <div className="form-group">
            <label className="form-label">Branch</label>
            <select required className="form-control" value={formData.branch_id} onChange={e => setFormData({ ...formData, branch_id: e.target.value })}>
              <option value="">Select Branch</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Code</label>
            <input required type="text" className="form-control" placeholder="e.g. GDN-01" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input required type="text" className="form-control" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Address / Location</label>
            <input type="text" className="form-control" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input type="text" className="form-control" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      <Modal title="Edit Godown" isOpen={!!showEdit} onClose={() => setShowEdit(null)}>
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
            <div className="form-group">
              <label className="form-label">Address / Location</label>
              <input type="text" className="form-control" value={showEdit.address || ''} onChange={e => setShowEdit({ ...showEdit, address: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input type="text" className="form-control" value={showEdit.description || ''} onChange={e => setShowEdit({ ...showEdit, description: e.target.value })} />
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

export default Godowns;

