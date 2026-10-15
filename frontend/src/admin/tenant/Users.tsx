import { useEffect, useState } from 'react';
import { Search, Plus, Edit, Ban, CheckCircle, Unlock, Key, Trash2, Shield, X, LogOut } from 'lucide-react';
import api from '../../shared/api';
import { Modal } from '../../shared/components/Modal';

interface RoleData {
  id: string;
  name: string;
}

interface UserData {
  id: string;
  username: string;
  display_name: string;
  is_active: boolean;
  is_locked: boolean;
  roles?: RoleData[];
}

const Users = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<UserData | null>(null);
  const [showRoles, setShowRoles] = useState<UserData | null>(null);
  const [showPassword, setShowPassword] = useState<UserData | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [formError, setFormError] = useState('');

  // Forms
  const [formData, setFormData] = useState({ username: '', password: '', display_name: '' });
  const [allRoles, setAllRoles] = useState<RoleData[]>([]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/users/', { params: { q: search || undefined, limit: 10, offset: page * 10 } });
      setUsers(res.data);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get('/roles/');
      setAllRoles(res.data);
    } catch (err) {
      setError('Could not load available roles. Please refresh to try again.');
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setPage(0);
      fetchUsers();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [page]);

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleAction = async (userId: string, action: string, payload?: any) => {
    if (!window.confirm(`Are you sure you want to perform this action?`)) return;
    try {
      if (action === 'sessions/revoke-all') {
         await api.post(`/users/${userId}/${action}`);
      } else {
         await api.patch(`/users/${userId}/${action}`, payload);
      }
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'Action failed');
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Archive access for "${username}"? Their bills and accounting history will be retained.`)) return;
    try {
      await api.delete(`/users/${userId}`);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'Failed to archive access');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await api.post('/users/', { ...formData, roles: [] });
      setShowCreate(false);
      setFormData({ username: '', password: '', display_name: '' });
      fetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      const res = await api.post(`/users/${userId}/roles?role_id=${roleId}`);
      setShowRoles(res.data);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to assign role');
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    try {
      const res = await api.delete(`/users/${userId}/roles/${roleId}`);
      setShowRoles(res.data);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to remove role');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1>User Management</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16}/> Create User</button>
      </div>

      <div className="card mb-4 flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-2" style={{ flex: '1 1 300px' }}>
          <Search size={18} className="text-muted" />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search users..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="btn btn-secondary btn-icon" onClick={() => setSearch('')} title="Clear Search">
              <X size={16}/>
            </button>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span>Page {page + 1}</span>
          <button className="btn btn-secondary" disabled={users.length < 10} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      </div>

      {error && <div className="form-error mb-4">{error}</div>}

      <div className="card table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Roles</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="text-center">No users found.</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.display_name}</td>
                  <td>
                    {u.roles?.map(r => (
                      <span key={r.id} className="badge badge-success ml-1 mr-1">{r.name}</span>
                    ))}
                  </td>
                  <td>
                    {u.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Disabled</span>}
                    {u.is_locked && <span className="badge badge-danger ml-2" style={{marginLeft: '0.5rem'}}>Locked</span>}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-icon" title="Edit User" onClick={() => setShowEdit(u)}><Edit size={16}/></button>
                      <button className="btn btn-secondary btn-icon" title="Manage Roles" onClick={() => setShowRoles(u)}><Shield size={16}/></button>
                      
                      {u.is_active ? (
                        <button className="btn btn-danger btn-icon" title="Disable" onClick={() => handleAction(u.id, 'disable')}><Ban size={16}/></button>
                      ) : (
                        <button className="btn btn-secondary btn-icon" title="Enable" onClick={() => handleAction(u.id, 'enable')}><CheckCircle size={16}/></button>
                      )}
                      
                      {u.is_locked && (
                        <button className="btn btn-secondary btn-icon" title="Unlock" onClick={() => handleAction(u.id, 'unlock')}><Unlock size={16}/></button>
                      )}
                      
                      <button className="btn btn-secondary btn-icon" title="Set Temporary Password" onClick={() => { setShowPassword(u); setNewPassword(''); setFormError(''); }}><Key size={16}/></button>
                      
                      <button className="btn btn-secondary btn-icon" title="Force Logout" onClick={() => handleAction(u.id, 'sessions/revoke-all')}><LogOut size={16}/></button>
                      
                      <button className="btn btn-danger btn-icon" title="Archive User Access" onClick={() => handleDeleteUser(u.id, u.username)}><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal title="Create User" isOpen={showCreate} onClose={() => setShowCreate(false)}>
        <form onSubmit={handleCreateUser}>
          {formError && <p role="alert" className="form-error">{formError}</p>}
          <div className="form-group">
            <label className="form-label">Staff mobile number / username</label>
            <input required type="tel" autoComplete="tel" maxLength={20} className="form-control" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input required minLength={8} maxLength={72} autoComplete="new-password" type={passwordVisible?'text':'password'} className="form-control" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <label><input type="checkbox" checked={passwordVisible} onChange={e=>setPasswordVisible(e.target.checked)}/> Show password</label>
            <small>Use at least 8 characters. Uppercase letters, numbers and symbols are optional. Staff must change this temporary password within 24 hours.</small>
          </div>
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input required type="text" className="form-control" value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      <Modal title={`Temporary password: ${showPassword?.display_name || ''}`} isOpen={!!showPassword} onClose={() => setShowPassword(null)}>
        <form onSubmit={async event => {
          event.preventDefault(); if (!showPassword) return; setFormError('');
          try { await api.patch(`/users/${showPassword.id}/reset-password`, { new_password: newPassword }); setShowPassword(null); setNewPassword(''); fetchUsers(); }
          catch (error: any) { setFormError(error.response?.data?.message || 'Could not set a temporary password'); }
        }}>
          <p>This signs the staff member out of every device. They must choose their own password within 24 hours.</p>
          {formError && <p role="alert" className="form-error">{formError}</p>}
          <label className="form-label" htmlFor="staff-temporary-password">Temporary password</label>
          <input id="staff-temporary-password" required type={passwordVisible?'text':'password'} autoComplete="new-password" minLength={8} maxLength={72} className="form-control" value={newPassword} onChange={event => setNewPassword(event.target.value)} />
          <label><input type="checkbox" checked={passwordVisible} onChange={e=>setPasswordVisible(e.target.checked)}/> Show password</label>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowPassword(null)}>Cancel</button><button type="submit" className="btn btn-primary">Set temporary password</button></div>
        </form>
      </Modal>

      <Modal title="Edit User" isOpen={!!showEdit} onClose={() => setShowEdit(null)}>
        {showEdit && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.patch(`/users/${showEdit.id}`, { display_name: showEdit.display_name });
              setShowEdit(null);
              fetchUsers();
            } catch (err: any) {
              alert(err.response?.data?.detail || 'Failed to edit user');
            }
          }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" className="form-control" value={showEdit.username} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input required type="text" className="form-control" value={showEdit.display_name} onChange={e => setShowEdit({...showEdit, display_name: e.target.value})} />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal title="Manage Roles" isOpen={!!showRoles} onClose={() => setShowRoles(null)}>
        {showRoles && (
          <div>
            <h3 className="mb-4">Roles for {showRoles.username}</h3>
            <div className="flex gap-2 flex-wrap mb-4">
              {showRoles.roles?.map(r => (
                <div key={r.id} className="badge badge-success flex items-center gap-2 p-2">
                  {r.name}
                  <button className="btn-icon" style={{padding:0}} data-tone="danger" onClick={() => handleRemoveRole(showRoles.id, r.id)}><X size={12}/></button>
                </div>
              ))}
              {(!showRoles.roles || showRoles.roles.length === 0) && <span className="text-muted">No roles assigned.</span>}
            </div>
            <h4 className="mb-2">Available Roles</h4>
            <div className="flex gap-2 flex-wrap">
              {allRoles.filter(r => !showRoles.roles?.find(ur => ur.id === r.id)).map(r => (
                <button key={r.id} className="btn btn-secondary btn-sm" onClick={() => handleAssignRole(showRoles.id, r.id)}>
                  <Plus size={14}/> {r.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Users;

