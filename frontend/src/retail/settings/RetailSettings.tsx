import StitchHeader from '../design/StitchHeader';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sun, Moon, Type, Smartphone, ShieldCheck, Building2, Printer, QrCode, ChevronRight, SlidersHorizontal, HelpCircle, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { setUiLanguage, useUiLanguage, ui } from '../../i18n';
import {useBillingPreferences} from './useBillingPreferences';
import api,{getApiErrorMessage} from '../../shared/api';
import {useAuthStore} from '../../shared/store/authStore';
import { useRetailEntitlements } from '../subscription/useRetailEntitlements';
import { canShowDrawerItem, drawerGroups } from '../components/retailNavigation';

export default function RetailSettings({ invoice = false }: { invoice?: boolean }) {
  const navigate = useNavigate();
  const language = useUiLanguage();
  const [languageError,setLanguageError]=useState('');
  const changeLanguage=async(next:'en'|'hi')=>{
    setLanguageError('');
    try{await setUiLanguage(next);}catch{setLanguageError('Could not load this language. Check your connection and try again.');}
  };
  const prefs=useBillingPreferences(),user=useAuthStore(s=>s.user);
  const access=useRetailEntitlements(),features=access.data?new Set(access.data.entitlements.features.filter(f=>f.enabled).map(f=>f.code)):null;
  const visibleLink=(route:string)=>{const item=drawerGroups.flatMap(group=>group.children).find(item=>item.route===route);return !!item&&canShowDrawerItem(item,{user,features});};
  const [savingBarcode,setSavingBarcode]=useState(false),[barcodeError,setBarcodeError]=useState('');
  const [theme, setTheme] = useState(localStorage.getItem('evolix-theme') || 'light');
  const [textSize, setTextSize] = useState(localStorage.getItem('evolix-text-size') || 'comfortable');
  const save = (key: string, value: string) => { localStorage.setItem(key, value); window.dispatchEvent(new Event(key)); };
  const links = [
    {label:'Payment voice greeting',description:'A personal thank-you after received payments',to:'/retail/more/voice',Icon:Volume2},
    { label: 'UPI & Payments', description: 'Shop QR and invoice QR preference', to: '/retail/more/payments', Icon: QrCode },
    { label: 'Printer & Invoice', description: 'Receipts, printing and payment QR', to: '/retail/more/invoice', Icon: Printer },
    { label: 'My Business', description: 'Shop details, branch and financial year', to: '/retail/more/business', Icon: Building2 },
    { label: 'Shop Features', description: 'Features available with your plan', to: '/retail/more/features', Icon: SlidersHorizontal },
    { label: 'Logged-in Devices', description: 'Review and revoke sessions', to: '/retail/more/devices', Icon: Smartphone },
    { label: 'Security', description: 'Password and Google account connection', to: '/retail/more/security', Icon: ShieldCheck },
    { label: 'Help & Support', description: 'Help with billing, money and stock', to: '/retail/more/help', Icon: HelpCircle },
  ];
  return <>
    <StitchHeader className="r-page-header" hasBack><button className="r-btn r-btn--icon" aria-label={ui("Back to More")} onClick={() => navigate('/retail/more')}><ArrowLeft size={22} /></button><h1>{invoice ? ui("Printer & Invoice") : ui("Settings")}</h1><span className="r-header-spacer" /></StitchHeader>
    <main className="r-section r-account-page">
      {invoice ? <><div className="r-card"><h2>Print a bill</h2><p>Open a bill from Bill History and choose Print invoice. Your browser or Android print service shows the available printers.</p><Link className="r-btn r-btn--primary r-btn--full" to="/retail/bills"><Printer size={20} />Open Bill History</Link><p className="r-caption">Direct Bluetooth printer pairing is not connected. Use your device's supported print service.</p></div><div className="r-card"><h2>UPI QR on invoices</h2><p>Add your shop UPI ID and choose whether to show the QR on printed invoices.</p>{visibleLink('/retail/more/payments')&&<Link className="r-btn r-btn--outline r-btn--full" to="/retail/more/payments"><QrCode size={20} />Configure Invoice QR</Link>}</div></> : <>
        <div className="r-card"><h2>{ui("Make Apna Galla comfortable")}</h2><p className="r-caption">{ui("These display choices apply on this device.")}</p>
          <section id="language"><h3>{ui('App language')}</h3><p className="r-caption">{ui('Choose English or Hindi. Your shop data stays as entered.')}</p><div className="r-segmented" role="group" aria-label={ui('App language')}><button type="button" id="language-en" aria-pressed={language==='en'} className={language==='en'?'active':''} onClick={()=>void changeLanguage('en')}>{ui("English")}</button><button type="button" id="language-hi" aria-pressed={language==='hi'} className={language==='hi'?'active':''} onClick={()=>void changeLanguage('hi')}>हिन्दी</button></div>{languageError&&<p role="alert">{ui(languageError)}</p>}</section>
          <p className="r-label">{ui("Appearance")}</p><div className="r-segmented" role="group" aria-label={ui("App appearance")}>{[['light', 'Light', Sun], ['dark', 'Dark', Moon]].map(([value, label, Icon]) => <button key={String(value)} className={theme === value ? 'active' : ''} aria-pressed={theme === value} onClick={() => { setTheme(String(value)); save('evolix-theme', String(value)); }}>{typeof Icon !== 'string' && <Icon size={20} />} {String(label)}</button>)}</div>
          <p className="r-label"><Type size={20} aria-hidden="true" />{ui("Text size")}</p><div className="r-segmented" role="group" aria-label={ui("Text size")}>{[['comfortable', 'Comfortable'], ['large', 'Larger text']].map(([value, label]) => <button key={value} className={textSize === value ? 'active' : ''} aria-pressed={textSize === value} onClick={() => { setTextSize(value); save('evolix-text-size', value); }}>{ui(label)}</button>)}</div>
        </div>
        <div className="r-card">
          <h2>{ui('Billing preferences')}</h2>
          <label className="r-toggle-row"><input type="checkbox" checked={prefs.enabled} disabled={prefs.loading||savingBarcode||!['OWNER','ADMIN','TENANT_ADMIN'].includes(user?.role||'')}
            onChange={async e=>{
              const enabled=e.target.checked;
              const previous=prefs.enabled;prefs.setEnabled(enabled);
              setSavingBarcode(true);setBarcodeError('');
              try{await api.post('/retail/account/billing-preferences',{barcode_scanning_enabled:enabled});window.dispatchEvent(new Event('evolix-billing-preferences'));}
              catch(error){prefs.setEnabled(previous);setBarcodeError(getApiErrorMessage(error));}
              finally{setSavingBarcode(false);}
            }}/>{ui('Barcode scanning')}</label>
          <p className="r-caption">{ui('Off by default. Enable for barcode entry or a keyboard scanner that sends Enter. Camera scanning is not connected.')}</p>
          {(barcodeError||prefs.error)&&<p role="alert">{barcodeError||prefs.error}</p>}
        </div>
        {visibleLink('/retail/more/voice')&&<div className="r-card"><h2><Volume2 size={21}/> {ui('Payment voice greeting')}</h2><p>{ui('You can turn the greeting off, edit the words, choose Hindi or English and preview it.')}</p><Link className="r-btn r-btn--outline r-w-full" id="voice-settings-link" to="/retail/more/voice"><Volume2 size={20}/>{ui('Payment voice greeting')}</Link></div>}
        <div className="r-card r-settings-links">{links.filter(link=>visibleLink(link.to)).map(({ label, description, to, Icon }) => <Link key={to} to={to} className="r-menu-item"><div className="r-menu-icon"><Icon size={22} /></div><div className="r-menu-text"><span>{ui(label)}</span><small>{ui(description)}</small></div><ChevronRight size={20} /></Link>)}</div>
      </>}
      <p className="r-caption">{ui("Never share a password or verification code with someone claiming to be support.")}</p>
    </main>
  </>;
}
