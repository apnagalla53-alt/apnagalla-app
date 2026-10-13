import { ui, useUiLanguage } from "../i18n";
import './retail-mobile.css';
/**
 * EVOLIX Retail V1 — Mobile Shell with Bottom Navigation
 * 
 * Fixed bottom nav: Home | Items | Bill | Khata. The shop menu holds all tools.
 * Bill button is the most prominent (elevated green circle).
 */
import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom';
import {
  Home, Package, BookOpen, Receipt
} from 'lucide-react';
import { useAuthStore } from '../shared/store/authStore';
import '../retail/retail.css';
import './retail-refresh.css';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import RetailErrorBoundary from './RetailErrorBoundary';
import MigrationWelcome from './imports/MigrationWelcome';
import RetailNavigationDrawer from './components/RetailNavigationDrawer';
import './design/stitch-tokens.css';
import './design/stitch-system.css';
import './design/stitch-gst.css';
import './design/stitch-inventory.css';
import './design/stitch-forms.css';
import './design/stitch-billing.css';
import './design/stitch-parties.css';
import {refreshRetailEntitlements} from './subscription/useRetailEntitlements';
import TrialBanner from './subscription/TrialBanner';

const RetailShell = () => {
  useUiLanguage();
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenantContext);
  const location = useLocation();
  const navigate=useNavigate();
  useEffect(()=>{const upgrade=(event:Event)=>navigate('/retail/more/subscription?plan='+(event as CustomEvent<string>).detail);window.addEventListener('evolix-upgrade-required',upgrade);return()=>window.removeEventListener('evolix-upgrade-required',upgrade);},[navigate]);
  const showNavigation = ['/retail/home','/retail/items','/retail/stock','/retail/khata','/retail/suppliers','/retail/purchases','/retail/expenses','/retail/reports','/retail/calendar','/retail/assistant','/retail/more/settings'].includes(location.pathname);
  const [apiError, setApiError] = useState<{message:string,url?:string}|null>(null);
  const [theme,setTheme]=useState(localStorage.getItem('evolix-theme')||'light');
  const [textSize,setTextSize]=useState(localStorage.getItem('evolix-text-size')||'comfortable');
  useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')void refreshRetailEntitlements();};const timer=window.setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
  useEffect(()=>{const change=()=>setTheme(localStorage.getItem('evolix-theme')||'light');window.addEventListener('evolix-theme',change);return()=>window.removeEventListener('evolix-theme',change);},[]);
  useEffect(()=>{const change=()=>setTextSize(localStorage.getItem('evolix-text-size')||'comfortable');window.addEventListener('evolix-text-size',change);return()=>window.removeEventListener('evolix-text-size',change);},[]);
  useEffect(() => {
    setApiError(null);
    const handleError = (event: Event) => setApiError((event as CustomEvent<{message:string,url?:string}>).detail);
    const recover = (event:Event) => setApiError(current=>current?.url===(event as CustomEvent<string>).detail?null:current);
    window.addEventListener('evolix-api-error', handleError);
    window.addEventListener('evolix-api-recovered',recover);
    return () => {window.removeEventListener('evolix-api-error', handleError);window.removeEventListener('evolix-api-recovered',recover);};
  }, [location.pathname]);

  if (user?.is_platform) {
    return <Navigate to="/platform/dashboard" replace />;
  }

  return (
    <div className="retail-app retail-stitch" data-theme={theme} data-text-size={textSize} data-route={location.pathname} data-navigation={showNavigation?'visible':'hidden'}>
      <a className="r-skip-link" href="#retail-page-content">{ui("Skip to page content")}</a>
      <div className="r-shell">
        <MigrationWelcome/>
        {/* Page Content */}
        <div className="r-page" id="retail-page-content" tabIndex={-1}>
          <RetailNavigationDrawer/>
          <TrialBanner/>
          {apiError && <div className="r-card r-api-error" role="alert"><p>{apiError.message}</p><button className="r-btn r-btn--secondary" onClick={() => window.location.reload()}>{ui("Try Again")}</button></div>}
          {!tenant?.company_id || !tenant.branch_id || !tenant.financial_year_id ?
            <div className="r-empty"><h1>{ui("Complete Shop Setup")}</h1><p>Ask your shop administrator to assign your company and branch and open the current financial year, then sign in again.</p><a className="r-btn r-btn--primary" href="/login">{ui("Sign In Again")}</a></div> :
            <RetailErrorBoundary key={location.pathname}><Outlet /></RetailErrorBoundary>}
        </div>

        {/* Bottom Navigation */}
        <nav className="r-bottom-nav r-bottom-nav--four" id="retail-bottom-nav" aria-label={ui("Main navigation")}>
          <NavLink
            to="/retail/home"
            className={({ isActive }) => `r-nav-item ${isActive ? 'active' : ''}`}
            id="nav-home"
          >
            <Home />
            <span>{ui("Home")}</span>
          </NavLink>

          <NavLink
            to="/retail/items"
            className={({ isActive }) => `r-nav-item ${isActive ? 'active' : ''}`}
            id="nav-items"
          >
            <Package />
            <span>{ui("Items")}</span>
          </NavLink>

          <NavLink
            to="/retail/bill"
            className={({ isActive }) => `r-nav-item r-nav-item--bill ${isActive ? 'active' : ''}`}
            id="nav-bill"
          >
            <Receipt />
            <span>{ui("Bill")}</span>
          </NavLink>

          <NavLink
            to="/retail/khata"
            className={({ isActive }) => `r-nav-item ${isActive ? 'active' : ''}`}
            id="nav-khata"
          >
            <BookOpen />
            <span>{ui("Khata")}</span>
          </NavLink>

        </nav>
      </div>
    </div>
  );
};

export default RetailShell;
