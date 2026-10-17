import { BrandHeader } from '../experience/ExperienceComponents';
import { ui, useUiLanguage } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Search, X, UserRound } from 'lucide-react';
import { useAuthStore } from '../../shared/store/authStore';
import api from '../../shared/api';
import {useRetailEntitlements} from '../subscription/useRetailEntitlements';
import ReportNotificationBell from '../reports/ReportNotificationBell';
import LanguageButton from './LanguageButton';
import { DrawerNavItem, DrawerFooter } from './DrawerNavigation';
import { activeDrawerItem, visibleSimpleDrawer, visibleDrawerNavigation } from './retailNavigation';
import { OPEN_RETAIL_DRAWER_EVENT } from './DrawerMenuButton';

export default function RetailNavigationDrawer() {
  useUiLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query,setQuery]=useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const access=useRetailEntitlements();
  const featureError=!!access.error;
  const tenant = useAuthStore(state => state.tenantContext);
  const user = useAuthStore(state => state.user);
  const location = useLocation();
  const BrandTitle = location.pathname === '/retail/home' ? 'h1' : 'div';
  const features = access.data ? new Set(access.data.entitlements.features.filter(feature=>feature.enabled).map(feature=>feature.code)) : null;
  const navigation = visibleSimpleDrawer({ user, features });
  const full=visibleDrawerNavigation({user,features});
  const synonyms:Record<string,string>={upi:'qr bank payment receiving account',galla:'hisaab hisab cash daily',customers:'khata udhar hisaab hisab customer',receive:'jama vasooli payment received',printer:'invoice bill print receipt',business:'shop gst registration',language:'hindi english bhasha',security:'password login'};
  const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const found=[...new Map([...navigation,...full.quick,...full.groups.flatMap(g=>g.children)].map(i=>[i.route,i])).values()].filter(i=>terms.every(t=>(i.label+' '+i.route+' '+(synonyms[i.id]||'')).toLowerCase().includes(t)));
  const shown=terms.length?found:navigation;
  const activeItem = activeDrawerItem(navigation, location);

  useEffect(() => {
    if(open)void access.refresh(true);
  }, [open]);

  useEffect(() => {
    dialog.current?.close();
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const navigationElement = dialog.current?.querySelector<HTMLElement>('.r-drawer-navigation');
      const selected = navigationElement?.querySelector<HTMLElement>('[aria-current="page"]');
      if (selected) selected.scrollIntoView({ block: 'nearest' });
      else if (navigationElement) navigationElement.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, activeItem]);

  const close = () => dialog.current?.close();
  const openDrawer = () => {
    returnFocus.current = toggle.current;
    dialog.current?.showModal();
    setOpen(true);
  };
  useEffect(() => {
    const show = (event: Event) => {
      returnFocus.current = (event as CustomEvent<HTMLElement>).detail;
      if (!dialog.current?.open) dialog.current?.showModal();
      setOpen(true);
    };
    window.addEventListener(OPEN_RETAIL_DRAWER_EVENT, show);
    return () => window.removeEventListener(OPEN_RETAIL_DRAWER_EVENT, show);
  }, []);
  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await api.post('/auth/logout'); } catch { /* Local logout still works when the network is unavailable. */ }
    useAuthStore.getState().logout();
  };

  return <>
    <div className="r-retail-toolbar">
      <button ref={toggle} id="retail-menu-toggle" type="button" className="r-btn r-btn--icon"
        aria-label={ui('Open shop menu')} aria-haspopup="dialog" aria-expanded={open}
        aria-controls="retail-navigation-drawer" onClick={openDrawer}><Menu size={25} aria-hidden="true" /></button>
      <BrandTitle className="r-toolbar-brand"><BrandHeader compact={location.pathname!=='/retail/home'}/></BrandTitle>
      <LanguageButton/><ReportNotificationBell />
      <Link to="/retail/more/profile" className="r-btn r-btn--icon r-toolbar-profile"
        aria-label={ui('Open account and settings')}><UserRound size={21} aria-hidden="true" /></Link>
    </div>
    <dialog ref={dialog} id="retail-navigation-drawer" className="r-navigation-drawer"
      aria-label={ui('Shop menu')} onClose={() => { setOpen(false);setQuery(''); if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); }}
      onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="r-drawer-content">
        <header className="r-drawer-header">
          <div><h2>Apna Galla</h2><p title={tenant?.company_name || ui('My Shop')}>{tenant?.company_name || ui('My Shop')}</p></div>
          <button type="button" className="r-btn r-btn--icon" aria-label={ui('Close shop menu')}
            onClick={close} autoFocus><X size={22} aria-hidden="true" /></button>
        </header>
        <div className="r-drawer-search"><label className="r-sr-only" htmlFor="shop-menu-search">Search pages and settings</label><div className="r-search-bar"><span className="r-search-icon"><Search size={20}/></span><input id="shop-menu-search" className="r-input" type="search" value={query} placeholder="Search pages & settings" onChange={e=>setQuery(e.target.value)}/></div></div>
        <nav className="r-drawer-navigation" aria-label={ui('Shop navigation')}>
          <div className="r-drawer-flat">
            {shown.map(item => <DrawerNavItem key={item.id} item={item} active={activeItem === item.id} onNavigate={close} />)}
          </div>
          {terms.length>0&&!shown.length&&<p role="status" className="r-drawer-notice">No matching pages. Try UPI, GST, khata or staff.</p>}
          {!features && !featureError && <p className="r-drawer-notice" role="status">{ui('Loading tools…')}</p>}
          {featureError && <p className="r-drawer-notice" role="status">{ui('Some tools could not be refreshed. Reopen the menu to retry.')}</p>}
        </nav>
        <DrawerFooter onLogout={() => void logout()} busy={loggingOut} />
      </div>
    </dialog>
  </>;
}
