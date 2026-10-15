import { useEffect, useState } from 'react';
import api from '../../shared/api';
import { Trash, Plus, Shield, Users as UsersIcon, X, Edit } from 'lucide-react';
import { Modal } from '../../shared/components/Modal';

interface PermissionData {
  id: string;
  code: string;
}

interface RoleData {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  permissions: PermissionData[];
}

interface UserData {
  id: string;
  username: string;
  display_name: string;
}

const Roles = () => {
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<RoleData | null>(null);
  const [showPerms, setShowPerms] = useState<RoleData | null>(null);
  const [showUsers, setShowUsers] = useState<RoleData | null>(null);
  const [roleUsers, setRoleUsers] = useState<UserData[]>([]);
  
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [allPerms, setAllPerms] = useState<PermissionData[]>([]);

  const fetchRoles = async () => {
    try {
      const res = await api.get('/roles/');
      setRoles(res.data);
    } catch (err) {
      setError('Could not load roles. Refresh to try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPerms = async () => {
    try {
      const response = await api.get('/permissions/');
      setAllPerms(response.data.filter((permission: PermissionData) => permission.code !== 'identity.admin' && !permission.code.startsWith('platform.')));
    } catch { setError('Could not load the permission catalogue. Refresh to try again.'); }
  };

  useEffect(() => {
    fetchRoles();
    fetchPerms();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/roles/', formData);
      setShowCreate(false);
      setFormData({ name: '', description: '' });
      fetchRoles();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete role?')) return;
    try {
      await api.delete(`/roles/${id}`);
      fetchRoles();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed');
    }
  };

  const handleAssignPerm = async (roleId: string, permCode: string) => {
    try {
      const res = await api.post(`/roles/${roleId}/permissions?permission_code=${permCode}`);
      setShowPerms(res.data);
      fetchRoles();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed');
    }
  };

  const handleRemovePerm = async (roleId: string, permCode: string) => {
    try {
      const res = await api.delete(`/roles/${roleId}/permissions/${permCode}`);
      setShowPerms(res.data);
      fetchRoles();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed');
    }
  };

  const handleViewUsers = async (role: RoleData) => {
    setShowUsers(role);
    try {
      const res = await api.get(`/roles/${role.id}/users`);
      setRoleUsers(res.data);
    } catch (err) {
      setError('Could not load staff with this role.');
    }
  };

  return (
    <div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="flex justify-between items-center mb-4">
        <h1>Role Management</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16}/> Create Custom Role</button>
      </div>
      
      <div className="card table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Type</th>
              <th>Permissions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center">Loading...</td></tr>
            ) : roles.length === 0 ? (
              <tr><td colSpan={5} className="text-center">No roles.</td></tr>
            ) : (
              roles.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.description}</td>
                  <td>{r.is_system ? <span className="badge badge-success">System</span> : <span className="badge">Custom</span>}</td>
                  <td>{r.permissions?.length || 0} perms</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-icon" onClick={() => setShowPerms(r)} title="Manage Permissions">
                        <Shield size={16}/>
                      </button>
                      <button className="btn btn-secondary btn-icon" onClick={() => handleViewUsers(r)} title="View Users">
                        <UsersIcon size={16}/>
                      </button>
                      {!r.is_system && (
                        <>
                          <button className="btn btn-secondary btn-icon" onClick={() => setShowEdit(r)} title="Edit Role">
                            <Edit size={16}/>
                          </button>
                          <button className="btn btn-danger btn-icon" onClick={() => handleDelete(r.id)} title="Delete Role">
                            <Trash size={16}/>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal title="Create Role" isOpen={showCreate} onClose={() => setShowCreate(false)}>
        <form onSubmit={handleCreateRole}>
          <div className="form-group">
            <label className="form-label">Role Name</label>
            <input required type="text" className="form-control" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input required type="text" className="form-control" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      </Modal>

      <Modal title="Edit Role" isOpen={!!showEdit} onClose={() => setShowEdit(null)}>
        {showEdit && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.patch(`/roles/${showEdit.id}`, { name: showEdit.name, description: showEdit.description });
              setShowEdit(null);
              fetchRoles();
            } catch (err: any) {
              alert(err.response?.data?.detail || 'Failed');
            }
          }}>
            <div className="form-group">
              <label className="form-label">Role Name</label>
              <input required type="text" className="form-control" value={showEdit.name} onChange={e => setShowEdit({...showEdit, name: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input type="text" className="form-control" value={showEdit.description} onChange={e => setShowEdit({...showEdit, description: e.target.value})} />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal title={`Permissions: ${showPerms?.name}`} isOpen={!!showPerms} onClose={() => setShowPerms(null)}>
        {showPerms && (
          <div>
            <h4 className="mb-2">Assigned Permissions</h4>
            <div className="flex gap-2 flex-wrap mb-4">
              {showPerms.permissions?.map(p => (
                <div key={p.code} className="badge badge-success flex items-center gap-2 p-2">
                  {p.code}
                  {!showPerms.is_system && (
                    <button className="btn-icon" style={{padding:0}} data-tone="danger" onClick={() => handleRemovePerm(showPerms.id, p.code)}><X size={12}/></button>
                  )}
                </div>
              ))}
              {(!showPerms.permissions || showPerms.permissions.length === 0) && <span className="text-muted">None.</span>}
            </div>
            
            {!showPerms.is_system && (
              <>
                <h4 className="mb-2">Available Permissions</h4>
                <div className="flex gap-2 flex-wrap">
                  {allPerms.filter(p => !showPerms.permissions?.find(sp => sp.code === p.code)).map(p => (
                    <button key={p.code} className="btn btn-secondary btn-sm" onClick={() => handleAssignPerm(showPerms.id, p.code)}>
                      <Plus size={14}/> {p.code}
                    </button>
                  ))}
                </div>
              </>
            )}
            {showPerms.is_system && <p className="text-muted mt-4">System role permissions cannot be edited.</p>}
          </div>
        )}
      </Modal>

      <Modal title={`Users with role: ${showUsers?.name}`} isOpen={!!showUsers} onClose={() => setShowUsers(null)}>
        {showUsers && (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {roleUsers.length === 0 ? (
              <li className="text-muted">No users assigned.</li>
            ) : (
              roleUsers.map(u => (
                <li key={u.id} className="flex justify-between items-center py-2 border-b">
                  <span>{u.display_name} ({u.username})</span>
                </li>
              ))
            )}
          </ul>
        )}
      </Modal>
    </div>
  );
};

export default Roles;

