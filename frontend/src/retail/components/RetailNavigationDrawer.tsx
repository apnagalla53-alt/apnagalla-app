import { ui, useUiLanguage } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, UserRound } from 'lucide-react';
import { useAuthStore } from '../../shared/store/authStore';
import api from '../../shared/api';
import {useRetailEntitlements} from '../subscription/useRetailEntitlements';
import ReportNotificationBell from '../reports/ReportNotificationBell';
import { DrawerAccordionGroup, DrawerFooter, DrawerQuickLinks } from './DrawerNavigation';
import { activeDrawerItem, visibleDrawerNavigation } from './retailNavigation';
import { OPEN_RETAIL_DRAWER_EVENT } from './DrawerMenuButton';

export default function RetailNavigationDrawer() {
  useUiLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const access=useRetailEntitlements();
  const featureError=!!access.error;
  const tenant = useAuthStore(state => state.tenantContext);
  const user = useAuthStore(state => state.user);
  const location = useLocation();
  const BrandTitle = location.pathname === '/retail/home' ? 'h1' : 'div';
  const features = access.data ? new Set(access.data.entitlements.features.filter(feature=>feature.enabled).map(feature=>feature.code)) : null;
  const navigation = visibleDrawerNavigation({ user, features });
  const activeChild = activeDrawerItem(navigation.groups.flatMap(group => group.children), location);
  const activeQuick = activeDrawerItem(navigation.quick, location);
  const activeGroup = navigation.groups.find(group => group.children.some(item => item.id === activeChild))?.id || null;

  useEffect(() => {
    if(open)void access.refresh(true);
  }, [open]);

  useEffect(() => {
    dialog.current?.close();
    setExpandedGroup(activeGroup);
  }, [location.pathname, location.search, location.hash]);
  // The first account response may arrive after the active route is rendered.
  useEffect(() => { setExpandedGroup(activeGroup); }, [activeGroup]);

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
      const selected = navigationElement?.querySelector<HTMLElement>('.r-drawer-submenu:not([hidden]) [aria-current="page"]');
      if (selected) selected.scrollIntoView({ block: 'nearest' });
      else if (navigationElement) navigationElement.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, activeGroup]);

  const close = () => dialog.current?.close();
  const openDrawer = () => {
    returnFocus.current = toggle.current;
    setExpandedGroup(activeGroup);
    dialog.current?.showModal();
    setOpen(true);
  };
  useEffect(() => {
    const show = (event: Event) => {
      returnFocus.current = (event as CustomEvent<HTMLElement>).detail;
      setExpandedGroup(activeGroup);
      if (!dialog.current?.open) dialog.current?.showModal();
      setOpen(true);
    };
    window.addEventListener(OPEN_RETAIL_DRAWER_EVENT, show);
    return () => window.removeEventListener(OPEN_RETAIL_DRAWER_EVENT, show);
  }, [activeGroup]);
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
      <BrandTitle className="r-toolbar-brand">Evolix {ui('Retail')}<small>{tenant?.company_name || ui('My Shop')}</small></BrandTitle>
      <ReportNotificationBell />
      <Link to="/retail/more/profile" className="r-btn r-btn--icon r-toolbar-profile"
        aria-label={ui('Open account and settings')}><UserRound size={21} aria-hidden="true" /></Link>
    </div>
    <dialog ref={dialog} id="retail-navigation-drawer" className="r-navigation-drawer"
      aria-label={ui('Shop menu')} onClose={() => { setOpen(false); if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); }}
      onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="r-drawer-content">
        <header className="r-drawer-header">
          <div><h2>EVOLIX</h2><p title={tenant?.company_name || ui('My Shop')}>{tenant?.company_name || ui('My Shop')}</p></div>
          <button type="button" className="r-btn r-btn--icon" aria-label={ui('Close shop menu')}
            onClick={close} autoFocus><X size={22} aria-hidden="true" /></button>
        </header>
        <nav className="r-drawer-navigation" aria-label={ui('Shop navigation')}>
          <DrawerQuickLinks items={navigation.quick} activeItem={activeQuick} onNavigate={close} />
          <div className="r-drawer-accordions">
            {navigation.groups.map(group => <DrawerAccordionGroup key={group.id} group={group}
              expanded={expandedGroup === group.id} activeItem={activeChild}
              onToggle={() => setExpandedGroup(current => current === group.id ? null : group.id)} onNavigate={close} />)}
          </div>
          {!features && !featureError && <p className="r-drawer-notice" role="status">{ui('Loading tools…')}</p>}
          {featureError && <p className="r-drawer-notice" role="status">{ui('Some tools could not be refreshed. Reopen the menu to retry.')}</p>}
        </nav>
        <DrawerFooter onLogout={() => void logout()} busy={loggingOut} />
      </div>
    </dialog>
  </>;
}
