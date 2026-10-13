import { Outlet, NavLink } from 'react-router-dom';
import { Users, Shield, LayoutDashboard, LogOut, Activity, Building2, Building, GitBranch, Warehouse, Calendar, ShoppingCart, Bot, Book, Server, Package, Settings, ArrowRightLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../api';

const Shell = () => {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error(e);
    } finally {
      logout();
    }
  };

  const hasPerm = (perm: string) => (user as any)?.role === 'ADMIN' || (user as any)?.roles?.some((r: any) => r.role?.name === 'ADMIN') || user?.permissions?.includes(perm);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span style={{ color: 'var(--primary)' }}>EVOLIX</span> ERP
        </div>
        <nav style={{ padding: '0.5rem 0', flex: 1, overflowY: 'auto' }}>
          <NavLink to="/dashboard" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>

          {user?.is_platform && (
            <>
              <div className="nav-group-title text-primary font-bold">Platform Admin</div>
              <NavLink to="/platform/dashboard" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
                <Activity size={18} /> Platform Control
              </NavLink>
              <NavLink to="/platform/tenants" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
                <Server size={18} /> Tenants
              </NavLink>
            </>
          )}

          <div className="nav-group-title">Masters</div>
          {hasPerm('godown.read') && (
            <NavLink to="/godowns" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Warehouse size={18} /> Godowns
            </NavLink>
          )}

          <div className="nav-group-title">Inventory</div>
          {hasPerm('inventory.read') && (
            <>
              <NavLink to="/inventory/stock" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
                <Package size={18} /> Stock Summary
              </NavLink>
              <NavLink to="/inventory/movements" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
                <Activity size={18} /> Movements
              </NavLink>
              <NavLink to="/inventory/adjustments" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
                <Settings size={18} /> Adjustments
              </NavLink>
              <NavLink to="/inventory/transfers" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
                <ArrowRightLeft size={18} /> Transfers
              </NavLink>
            </>
          )}

          <div className="nav-group-title">Sales</div>
          {hasPerm('sales.read') && (
            <>
              <NavLink to="/sales" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
                <ShoppingCart size={18} /> Sales
              </NavLink>
              <NavLink to="/pos" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
                <ShoppingCart size={18} /> POS Checkout
              </NavLink>
            </>
          )}

          <div className="nav-group-title">Purchase</div>
          {hasPerm('purchasing.read') && (
            <NavLink to="/purchasing" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <ShoppingCart size={18} /> Purchasing
            </NavLink>
          )}

          <div className="nav-group-title">Accounting</div>
          <NavLink to="/accounting/accounts" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <Book size={18} /> Accounting Core
          </NavLink>

          <div className="nav-group-title">Intelligence</div>
          <NavLink to="/intelligence" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <Bot size={18} /> Intelligence
          </NavLink>

          <div className="nav-group-title">Settings</div>
          {hasPerm('organization.read') && (
            <NavLink to="/organizations" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Building2 size={18} /> Organizations
            </NavLink>
          )}
          {hasPerm('company.read') && (
            <NavLink to="/companies" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Building size={18} /> Companies
            </NavLink>
          )}
          {hasPerm('branch.read') && (
            <NavLink to="/branches" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <GitBranch size={18} /> Branches
            </NavLink>
          )}
          {hasPerm('financial_year.read') && (
            <NavLink to="/financial-years" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Calendar size={18} /> Financial Years
            </NavLink>
          )}
          {hasPerm('identity.user.read') && (
            <NavLink to="/users" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Users size={18} /> Users
            </NavLink>
          )}
          {hasPerm('identity.role.read') && (
            <NavLink to="/roles" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Shield size={18} /> Roles & Permissions
            </NavLink>
          )}
          {hasPerm('identity.session.read') && (
            <NavLink to="/sessions" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Activity size={18} /> Sessions
            </NavLink>
          )}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center' }}>
            {/* Future: breadcrumbs or page title could go here if not in page-header */}
          </div>
          
          <div className="topbar-center" style={{ flex: 1, maxWidth: '400px', margin: '0 2rem' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search transactions..." 
              style={{ borderRadius: '9999px', background: 'rgba(0,0,0,0.03)', border: 'none', padding: '0.5rem 1rem' }}
            />
          </div>

          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-primary" 
                title="Create Sales Order"
                onClick={() => { window.location.href = '/sales/orders/new' }}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                + Add Sale
              </button>
              <button 
                className="btn btn-outline" 
                title="Awaiting Module 07 (Purchase)"
                onClick={() => alert('Purchase Invoice workflow is not yet implemented.')}
                style={{ borderColor: 'var(--info)', color: 'var(--info)', padding: '0.4rem 0.75rem', fontSize: '0.8rem', opacity: 0.5, cursor: 'not-allowed' }}>
                + Add Purchase
              </button>
            </div>
            
            <div style={{ height: '24px', width: '1px', background: 'var(--border)' }}></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{user?.display_name || user?.username}</span>
              <button className="btn btn-secondary btn-icon" onClick={handleLogout} title="Logout" style={{ padding: '0.4rem' }}>
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>
        
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Shell;


