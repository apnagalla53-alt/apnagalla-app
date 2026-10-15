import { Link } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import { ui } from '../../i18n';
import type { DrawerNavItem as NavItem, DrawerNavGroup } from './retailNavigation';

export function DrawerNavItem({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  return <Link id={item.elementId} to={item.route} onClick={onNavigate}
    className={'r-drawer-link' + (active ? ' is-active' : '')}
    aria-current={active ? 'page' : undefined} data-drawer-item={item.id}>
    <Icon size={20} strokeWidth={1.8} aria-hidden="true" /><span>{ui(item.label)}</span>
  </Link>;
}

export function DrawerQuickLinks({ items, activeItem, onNavigate, onEdit }: { items: readonly NavItem[]; activeItem: string | null; onNavigate: () => void; onEdit?:()=>void }) {
  return <section className="r-drawer-quick" aria-labelledby="drawer-quick-title">
    <div className="r-quick-access-heading"><h3 id="drawer-quick-title">{ui('Quick Access')}</h3>{onEdit&&<button type="button" className="r-btn" onClick={onEdit}>Edit</button>}</div>
    {items.map(item => <DrawerNavItem key={item.id} item={item} active={item.id === activeItem} onNavigate={onNavigate} />)}
  </section>;
}

export function DrawerAccordionGroup({ group, expanded, activeItem, onToggle, onNavigate }: {
  group: DrawerNavGroup; expanded: boolean; activeItem: string | null; onToggle: () => void; onNavigate: () => void;
}) {
  const Icon = group.icon;
  const currentGroup = group.children.some(item => item.id === activeItem);
  return <section className="r-drawer-group" data-drawer-group={group.id}>
    <button id={'drawer-heading-' + group.id} type="button"
      className={'r-drawer-link r-drawer-disclosure' + (currentGroup ? ' is-current-group' : '')}
      aria-expanded={expanded} aria-controls={'drawer-group-' + group.id} onClick={onToggle}>
      <Icon size={20} strokeWidth={1.8} aria-hidden="true" /><span>{ui(group.label)}</span>
      <ChevronRight size={18} strokeWidth={1.8} className={'r-drawer-chevron' + (expanded ? ' is-expanded' : '')} aria-hidden="true" />
    </button>
    <div id={'drawer-group-' + group.id} className="r-drawer-submenu" hidden={!expanded}
      role="region" aria-labelledby={'drawer-heading-' + group.id}>
      {group.children.map(item => <DrawerNavItem key={item.id} item={item} active={item.id === activeItem} onNavigate={onNavigate} />)}
    </div>
  </section>;
}

export function DrawerFooter({ onLogout, busy }: { onLogout: () => void; busy: boolean }) {
  return <footer className="r-drawer-footer">
    <button className="r-drawer-link r-drawer-logout" type="button" onClick={onLogout} disabled={busy}>
      <LogOut size={20} strokeWidth={1.8} aria-hidden="true" /><span>{ui(busy ? 'Signing out…' : 'Log Out')}</span>
    </button>
  </footer>;
}
