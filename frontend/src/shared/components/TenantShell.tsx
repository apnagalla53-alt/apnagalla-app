import { Outlet, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, LogOut, ShoppingCart, Package, Truck,
  Receipt, BarChart3, Warehouse, ArrowRightLeft,
  ClipboardList, Settings, Users, Shield, Calendar, Building2,
  Building, GitBranch, Bot, ChevronLeft, Menu, ChevronDown,
  BookOpen, Briefcase, RotateCcw,
  PackageCheck, PackageMinus, ScanBarcode, Tag,
  UserCircle
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../api';
import { useState, useRef, useEffect } from 'react';
import { workflowFor, workflowStyle } from '../workflowTheme';
import WorkflowBanner from './WorkflowBanner';
import '../workflow-theme.css';

const TenantShell = () => {
  const workflow=workflowFor(useLocation().pathname);
  const { user, tenantContext, logout } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (user?.is_platform) {
    return <Navigate to="/platform/dashboard" replace />;
  }

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore
    } finally {
      logout();
    }
  };

  const hasPerm = (_perm: string) => {
    // For now, ADMIN gets everything. In production, check user.permissions
    return (user as any)?.role === 'ADMIN'
      || (user as any)?.roles?.some((r: any) => r.role?.name === 'ADMIN' || r.role?.name === 'TENANT_ADMIN')
      || user?.permissions?.includes(_perm);
  };

  const roleName = (user as any)?.roles?.[0]?.role?.name || 'USER';

  interface NavSection {
    title: string;
    items: { to: string; icon: any; label: string; perm?: string }[];
  }

  const sections: NavSection[] = [
    {
      title: 'Main',
      items: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      ],
    },
    {
      title: 'Masters',
      items: [
        { to: '/organizations', icon: Building2, label: 'Organizations', perm: 'organization.read' },
        { to: '/companies', icon: Building, label: 'Companies', perm: 'company.read' },
        { to: '/branches', icon: GitBranch, label: 'Branches', perm: 'branch.read' },
        { to: '/godowns', icon: Warehouse, label: 'Godowns', perm: 'godown.read' },
        { to: '/financial-years', icon: Calendar, label: 'Financial Years', perm: 'financial_year.read' },
        { to: '/users', icon: Users, label: 'Users', perm: 'identity.user.read' },
        { to: '/roles', icon: Shield, label: 'Roles & Permissions', perm: 'identity.role.read' },
      ],
    },
    {
      title: 'Purchase',
      items: [
        { to: '/purchasing', icon: Briefcase, label: 'Overview', perm: 'purchasing.read' },
        { to: '/purchasing/orders', icon: ClipboardList, label: 'Purchase Orders', perm: 'purchasing.read' },
        { to: '/purchasing/receipts', icon: PackageCheck, label: 'Goods Receipts', perm: 'purchasing.read' },
        { to: '/purchasing/invoices', icon: Receipt, label: 'Purchase Invoices', perm: 'purchasing.read' },
        { to: '/purchasing/returns', icon: RotateCcw, label: 'Purchase Returns', perm: 'purchasing.read' },
      ],
    },
    {
      title: 'Sales',
      items: [
        { to: '/sales', icon: ShoppingCart, label: 'Overview', perm: 'sales.read' },
        { to: '/sales/orders', icon: ClipboardList, label: 'Sales Orders', perm: 'sales.read' },
        { to: '/sales/challans', icon: Truck, label: 'Delivery Challans', perm: 'sales.read' },
        { to: '/sales/invoices', icon: Receipt, label: 'Sales Invoices', perm: 'sales.read' },
        { to: '/sales/returns', icon: RotateCcw, label: 'Sales Returns', perm: 'sales.read' },
        { to: '/sales/pricing', icon: Tag, label: 'Pricing & Schemes', perm: 'sales.read' },
      ],
    },
    {
      title: 'Retail',
      items: [
        { to: '/pos', icon: ScanBarcode, label: 'POS Checkout', perm: 'sales.read' },
      ],
    },
    {
      title: 'Inventory',
      items: [
        { to: '/inventory/stock', icon: Package, label: 'Stock Summary', perm: 'inventory.read' },
        { to: '/inventory/movements', icon: BarChart3, label: 'Movements', perm: 'inventory.read' },
        { to: '/inventory/adjustments', icon: PackageMinus, label: 'Adjustments', perm: 'inventory.read' },
        { to: '/inventory/transfers', icon: ArrowRightLeft, label: 'Transfers', perm: 'inventory.read' },
        { to: '/inventory/barcodes', icon: ScanBarcode, label: 'Barcodes & Labels', perm: 'inventory.read' },
      ],
    },
    {
      title: 'Accounting',
      items: [
        { to: '/accounting/accounts', icon: BookOpen, label: 'Chart of Accounts', perm: 'accounting.read' },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        { to: '/intelligence', icon: Bot, label: 'AI Insights' },
      ],
    },
  ];

  return (
    <div className="app-container workflow-surface" data-workflow={workflow.key} style={workflowStyle(workflow)}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-logo"><img src="/brand/apna-galla-app-192.png" alt="" width="36" height="36" /></div>
            {!sidebarCollapsed && (
              <div className="brand-text">
                <span className="brand-name-text">Apna Galla</span>
                <span className="brand-sub">Trade ERP</span>
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
          {sections.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.perm || hasPerm(item.perm)
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.title}>
                {!sidebarCollapsed && (
                  <div className="nav-group-title">{section.title}</div>
                )}
                {sidebarCollapsed && <div className="nav-separator" />}
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard' || item.to === '/sales' || item.to === '/purchasing'}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon size={18} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {!sidebarCollapsed && (
            <div className="sidebar-user-info">
              <div className="user-avatar">
                {user?.display_name?.[0] || user?.username?.[0] || 'U'}
              </div>
              <div className="user-details">
                <span className="user-name">{user?.display_name || user?.username}</span>
                <span className="user-role">{roleName}</span>
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
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-btn mobile-only" onClick={() => setMobileOpen(!mobileOpen)}>
              <Menu size={20} />
            </button>
            <div className="topbar-context">
              {tenantContext ? (
                <>
                  <span className="context-company">{tenantContext.company_name || 'Select Company'}</span>
                  <span className="context-separator">·</span>
                  <span className="context-branch">{tenantContext.branch_name || 'Select Branch'}</span>
                  {tenantContext.financial_year_label && (
                    <>
                      <span className="context-separator">·</span>
                      <span className="context-fy">{tenantContext.financial_year_label}</span>
                    </>
                  )}
                </>
              ) : (
                <span className="context-label">EVOLIX Trade ERP</span>
              )}
            </div>
          </div>

          <div className="topbar-center">
            <div className="topbar-search">
              <input
                type="text"
                placeholder="Search transactions..."
                className="search-input"
              />
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-actions">
              <NavLink to="/sales/orders/new" className="topbar-action-btn primary">
                + Sale
              </NavLink>
              <NavLink to="/purchasing/orders/new" className="topbar-action-btn outline">
                + Purchase
              </NavLink>
            </div>

            <div className="topbar-divider" />

            <div className="topbar-user-menu" ref={userMenuRef}>
              <button
                className="user-menu-trigger"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="user-avatar-sm">
                  {user?.display_name?.[0] || user?.username?.[0] || 'U'}
                </div>
                <span className="user-display-name desktop-only">
                  {user?.display_name || user?.username}
                </span>
                <ChevronDown size={14} className={`menu-chevron ${userMenuOpen ? 'open' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <div className="dropdown-user-info">
                      <UserCircle size={32} />
                      <div>
                        <div className="dropdown-user-name">{user?.display_name || user?.username}</div>
                        <div className="dropdown-user-email">{user?.email || user?.username}</div>
                      </div>
                    </div>
                  </div>
                  <div className="dropdown-divider" />
                  {tenantContext && (
                    <>
                      <div className="dropdown-section-title">Context</div>
                      <div className="dropdown-info-row">
                        <Building size={14} />
                        <span>{tenantContext.company_name}</span>
                      </div>
                      <div className="dropdown-info-row">
                        <GitBranch size={14} />
                        <span>{tenantContext.branch_name}</span>
                      </div>
                      {tenantContext.financial_year_label && (
                        <div className="dropdown-info-row">
                          <Calendar size={14} />
                          <span>{tenantContext.financial_year_label}</span>
                        </div>
                      )}
                      <div className="dropdown-info-row">
                        <Shield size={14} />
                        <span>{roleName}</span>
                      </div>
                      <div className="dropdown-divider" />
                    </>
                  )}
                  <button className="dropdown-item" onClick={() => { setUserMenuOpen(false); }}>
                    <Settings size={14} />
                    <span>Settings</span>
                  </button>
                  <button className="dropdown-item danger" onClick={handleLogout}>
                    <LogOut size={14} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="page-content">
          <WorkflowBanner workflow={workflow}/><Outlet />
        </div>
      </main>
    </div>
  );
};

export default TenantShell;

