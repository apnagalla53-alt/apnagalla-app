import { Menu } from 'lucide-react';
import { ui, useUiLanguage } from '../../i18n';

export const OPEN_RETAIL_DRAWER_EVENT = 'evolix-open-shop-menu';

export default function DrawerMenuButton({ className, size = 20 }: { className?: string; size?: number }) {
  useUiLanguage();
  return <button type="button" className={className} aria-label={ui('Open shop menu')}
    aria-haspopup="dialog" aria-controls="retail-navigation-drawer"
    onClick={event => window.dispatchEvent(new CustomEvent(OPEN_RETAIL_DRAWER_EVENT, { detail: event.currentTarget }))}>
    <Menu size={size} aria-hidden="true" />
  </button>;
}
