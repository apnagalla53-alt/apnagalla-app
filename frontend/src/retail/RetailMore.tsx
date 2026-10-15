import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
/**
 * EVOLIX Retail V1 — More Menu
 * 
 * Simple, grouped menu avoiding dense ERP navigation.
 */
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, IndianRupee, TrendingUp,
  Wallet, Users, BookUser, Settings,
  LogOut, UserCircle, ChevronRight, Grid, Database, Receipt, ShieldCheck, Smartphone,
  Building2, Printer, HelpCircle, CreditCard, FileText, Package, CalendarDays, MessageCircle
} from 'lucide-react';
import { useAuthStore } from '../shared/store/authStore';
import api from '../shared/api';

const RetailMore = () => {
  useUiLanguage();
  const navigate = useNavigate();
  const { user, tenantContext, logout } = useAuthStore();

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } finally { logout(); }
  };

  const menuGroups = [
    {
      title: 'Business',
      items: [
        { icon: MessageCircle, label: 'Ask EVOLIX', desc: 'Ask about sales, stock, Galla and dues', path: '/retail/assistant' },
        { icon: CalendarDays, label: 'Calendar', desc: 'Visits, promised dues and tasks', path: '/retail/calendar' },
        { icon: Receipt, label: 'Bill History', desc: 'View past bills', path: '/retail/bills' },
        { icon: FileText, label: 'GST Invoices', desc: 'Business details and A4 GST invoices', path: '/retail/gst' },
        { icon: ShoppingCart, label: 'Purchases', desc: 'Add or view purchases', path: '/retail/purchases' },
        { icon: IndianRupee, label: 'Expenses', desc: 'Manage daily expenses', path: '/retail/expenses' },
        { icon: TrendingUp, label: 'Reports', desc: 'Sales, Purchases, Stock reports', path: '/retail/reports' },
      ]
    },
    {
      title: 'Money',
      items: [
        { icon: Wallet, label: 'Cash & Bank', desc: 'Money received, paid & counter cash', path: '/retail/more/cash-bank' },
        { icon: Wallet, label: 'Daily Galla', desc: 'Money in, money out & counter count', path: '/retail/galla' },
        { icon: IndianRupee, label: 'UPI & Payments', desc: 'Receiving QR & invoice preference', path: '/retail/more/payments' },
        { icon: BookUser, label: 'Supplier Due', desc: 'What you owe suppliers', path: '/retail/reports/suppliers' },
      ]
    },
    {
      title: 'Products & People',
      items: [
        { icon: Grid, label: 'Need List', desc: 'Mangwana Hai', path: '/retail/needs' },
        { icon: Users, label: 'Suppliers', desc: 'Manage suppliers', path: '/retail/suppliers' },
        { icon: BookUser, label: 'Customers', desc: 'Contact details & customer khata', path: '/retail/khata' },
        { icon: Package, label: 'Stock', desc: 'Items available in your shop', path: '/retail/stock' },
        { icon: Building2, label: 'Stock Locations', desc: 'Your shop & storage locations', path: '/retail/more/locations' },
        { icon: Users, label: 'Staff & Permissions', desc: 'People who can use your shop', path: '/retail/more/staff' },
      ]
    },
    {
      title: 'Shop & Account',
      items: [
        { icon: Settings, label: 'Settings', desc: 'Shop, Print & Bill settings', path: '/retail/more/settings' },
        { icon: Database, label: 'Backup & Restore', desc: 'Secure your data', path: '/retail/more/backup' },
        { icon: FileText, label: 'Import your data', desc: 'Vyapar, Tally & spreadsheet migration', path: '/retail/more/import' },
        { icon: Building2, label: 'My Business', desc: 'Shop, branch & financial year', path: '/retail/more/business' },
        { icon: UserCircle, label: 'Personal Information', desc: 'Your signed-in account', path: '/retail/more/profile' },
        { icon: CreditCard, label: 'Subscription', desc: 'Current plan & access', path: '/retail/more/subscription' },
        { icon: Settings, label: 'Shop Features', desc: 'Features available to this shop', path: '/retail/more/features' },
        { icon: Printer, label: 'Printer & Invoice', desc: 'Receipts, printing & UPI QR', path: '/retail/more/invoice' },
        { icon: Smartphone, label: 'Logged-in Devices', desc: 'Review & revoke sessions', path: '/retail/more/devices' },
        { icon: FileText, label: 'My Documents', desc: 'Bills, receipts & payment photos', path: '/retail/more/documents' },
        { icon: ShieldCheck, label: 'Security', desc: 'Password & device safety', path: '/retail/more/security' },
        { icon: HelpCircle, label: 'Help & Support', desc: 'Simple guides & contact support', path: '/retail/more/help' },
        { icon: FileText, label: 'Privacy & Terms', desc: 'How your account data is handled', path: '/privacy' },
      ]
    }
  ];
  const tools=menuGroups.flatMap(group=>group.items);
  tools.push({icon:Receipt,label:'Make Bill',desc:'Sell items and make a receipt',path:'/retail/bill'},
    {icon:Receipt,label:'Held Bills',desc:'Resume a saved counter draft',path:'/retail/bills/held'},
    {icon:Package,label:'Items',desc:'Your item catalog',path:'/retail/items'},
    {icon:Wallet,label:'Payment voice greeting',desc:'A thank-you after confirmed customer payments',path:'/retail/more/voice'});
  const group=(title:string,paths:string[])=>({title,items:paths.map(path=>tools.find(tool=>tool.path===path)!).filter(Boolean)});
  const orderedGroups=[
    group('Sell & Stock',['/retail/bill','/retail/bills/held','/retail/galla','/retail/stock','/retail/needs','/retail/items','/retail/bills','/retail/gst','/retail/purchases']),
    group('People & Money',['/retail/khata','/retail/suppliers','/retail/more/voice','/retail/more/payments','/retail/expenses','/retail/reports','/retail/reports/suppliers','/retail/more/cash-bank']),
    group('Store Account & Locations',['/retail/more/locations','/retail/more/staff','/retail/more/invoice','/retail/more/business','/retail/more/profile','/retail/more/subscription','/retail/more/features','/retail/more/documents']),
    group('Settings & Help',['/retail/more/settings','/retail/more/security','/retail/more/devices','/retail/more/backup','/retail/more/import','/retail/more/help','/privacy','/retail/calendar','/retail/assistant']),
  ];

  return (
    <>
      <StitchHeader className="r-page-header">
        <h1>{ui("All Tools")}</h1>
      </StitchHeader>

      {/* User Profile Summary */}
      <div className="r-section" style={{ marginTop: 'var(--r-space-sm)' }}>
        <div className="r-card r-card--elevated" style={{ display: 'flex', alignItems: 'center', gap: 'var(--r-space-md)' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--r-primary-light)', color: 'var(--r-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UserCircle size={32} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--r-text-lg)', fontWeight: 700 }}>
              {tenantContext?.company_name || user?.display_name || ui("My Shop")}
            </div>
            <div style={{ fontSize: 'var(--r-text-sm)', color: 'var(--r-text-secondary)' }}>
              {user?.email || user?.phone || user?.username}
            </div>
          </div>
        </div>
      </div>

      {/* Menu Groups */}
      <div style={{ paddingBottom: 'var(--r-space-lg)' }}>
        {orderedGroups.map((group, idx) => (
          <div key={idx} className="r-menu-group">
            <div className="r-menu-group-title">{ui(group.title)}</div>
            
            <div style={{ background: 'var(--r-surface)', borderTop: '1px solid var(--r-border-light)', borderBottom: '1px solid var(--r-border-light)' }}>
              {group.items.map((item, itemIdx) => (
                <button
                  key={itemIdx}
                  className="r-menu-item"
                  onClick={() => navigate(item.path)}
                  style={{
                    borderBottom: itemIdx < group.items.length - 1 ? '1px solid var(--r-divider)' : 'none'
                  }}
                >
                  <div className="r-menu-icon">
                    <item.icon size={20} />
                  </div>
                  <div className="r-menu-text">
                    <span>{ui(item.label)}</span>
                    <small>{ui(item.desc)}</small>
                  </div>
                  <ChevronRight className="r-menu-chevron" size={20} />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Logout */}
        <div className="r-section" style={{ marginTop: 'var(--r-space-xl)' }}>
          <button
            className="r-btn r-btn--danger-ghost r-btn--full"
            onClick={handleLogout}
            id="logout-btn"
          >
            <LogOut size={18} />{ui("Log Out")}</button>
          
          <p className="r-caption r-text-center">Apna Galla · Har dukaan ka apna hisaab</p>
        </div>
      </div>
    </>
  );
};

export default RetailMore;
