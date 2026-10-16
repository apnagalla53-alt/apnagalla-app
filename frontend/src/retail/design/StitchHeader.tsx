import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ui, useUiLanguage } from '../../i18n';
import DrawerMenuButton from '../components/DrawerMenuButton';
import LanguageButton from '../components/LanguageButton';

/** Shared back/title composition; the shop menu keeps every module reachable. */
export default function StitchHeader({children, className='r-page-header', hasBack=false, trailing, onBack, ...props}: {
  children: ReactNode; className?: string; hasBack?: boolean; id?: string;trailing?:ReactNode;onBack?:()=>void;
}) {
  useUiLanguage();
  const navigate=useNavigate(),location=useLocation();
  return <header {...props} className={className+' r-stitch-header'}>
    {!hasBack&&<button type="button" className="r-btn r-btn--icon r-back-btn" aria-label={ui('Back')} onClick={()=>onBack?onBack():navigate('/retail/home')}><ArrowLeft size={24}/></button>}
    {children}
    {!['/retail/home','/retail/stock'].includes(location.pathname)&&<LanguageButton/>}{trailing??<DrawerMenuButton className="r-stitch-account" size={18} />}
  </header>;
}
