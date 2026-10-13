import { Outlet, NavLink, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, LogOut, Server, Users, CreditCard, Shield,
  Settings, FileText, HeartPulse, ChevronLeft, Menu,MessageCircle
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../api';
import { useState } from 'react';

const PlatformShell = () => {
  const { user, logout } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user?.is_platform) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogout = async () => {
    try {
      await api.post('/platform/auth/logout');
    } catch (e) {
      // ignore
    } finally {
      logout();
    }
  };

  const navItems = [
    { to: '/platform/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/platform/tenants', icon: Server, label: 'Organizations' },
    { to: '/platform/plans', icon: CreditCard, label: 'Plans' },
    { to: '/platform/account-policy', icon: Settings, label: 'Accounts & trial policy' },
    { to: '/platform/referrals', icon: Users, label: 'Referral program' },
    { to: '/platform/deletion-jobs', icon: Shield, label: 'Tenant erasure jobs' },
    { to: '/platform/features', icon: Shield, label: 'Features & rollout' },
    { to: '/platform/payments', icon: CreditCard, label: 'Subscriptions & revenue' },
    { to: '/platform/expenses', icon: FileText, label: 'Platform expenses' },
    { to: '/platform/users', icon: Users, label: 'Platform Users' },
    { to: '/platform/audit', icon: FileText, label: 'Audit Log' },
    { to: '/platform/sessions', icon: Users, label: 'Devices & sessions' },
    { to: '/platform/infrastructure', icon: HeartPulse, label: 'Infrastructure & database' },
    { to: '/platform/backups', icon: Server, label: 'Backups' },
    { to: '/platform/support', icon: Users, label: 'Support' },
    { to: '/platform/alerts', icon: HeartPulse, label: 'Alerts' },
    { to: '/platform/assistant', icon: MessageCircle, label: 'Assistant' },
    { to: '/platform/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="app-container">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar platform-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <Shield size={22} className="brand-icon-svg" />
            {!sidebarCollapsed && (
              <div className="brand-text">
                <span className="brand-name-text">EVOLIX</span>
                <span className="brand-sub">Platform</span>
              </div>
            )}
          </div>
          <button
            className="sidebar-collapse-btn desktop-only"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft size={16} className={sidebarCollapsed ? 'rotated' : ''} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-title">{!sidebarCollapsed && 'Administration'}</div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon size={18} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!sidebarCollapsed && (
            <div className="sidebar-user-info">
              <div className="user-avatar platform-avatar">
                {user?.display_name?.[0] || 'S'}
              </div>
              <div className="user-details">
                <span className="user-name">{user?.display_name || user?.username}</span>
                <span className="user-role">Super Admin</span>
              </div>
            </div>
          )}
          <button className="sidebar-logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={16} />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar platform-topbar">
          <div className="topbar-left">
            <button className="mobile-menu-btn mobile-only" onClick={() => setMobileOpen(!mobileOpen)}>
              <Menu size={20} />
            </button>
            <div className="topbar-context">
              <span className="context-label">EVOLIX Platform Administration</span>
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-user-menu">
              <div className="user-avatar-sm platform-avatar">
                {user?.display_name?.[0] || 'S'}
              </div>
              <span className="user-display-name">{user?.display_name || user?.username}</span>
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

export default PlatformShell;

