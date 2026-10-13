import BackupStatus from './BackupStatus';
import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, UserRound, CreditCard, SlidersHorizontal, ShieldCheck, Download, Database } from 'lucide-react';
import api, { getApiErrorMessage } from '../../shared/api';
import { createUuid } from '../../shared/browserCrypto';
import { useAuthStore } from '../../shared/store/authStore';
import RetailSubscription from '../subscription/RetailSubscription';
import RetailDataExports from '../subscription/RetailDataExports';
import RetailShopFeatures from '../subscription/RetailShopFeatures';
import {useRetailEntitlements} from '../subscription/useRetailEntitlements';

type Section = 'business' | 'profile' | 'subscription' | 'features' | 'backup';
type Account = {
  profile: { id: string; username: string; display_name: string; email?: string; phone?: string; email_verified: boolean; google_linked: boolean };
  business: { id: string; name: string; legal_name?: string; address?: string; phone?: string; email?: string; gstin?: string };
  branch: { name: string; code: string } | null;
  subscription: { status: string; plan_name: string; expires_at?: string; complimentary: boolean } | null;
  features: { key: string; name: string; enabled: boolean }[];
  backup: { configured: boolean; provider: string; restore_scope: string };
};
const sections = {
  business: { title: 'My Business', Icon: Building2, help: 'The shop and branch you are working in.' },
  profile: { title: 'Personal Information', Icon: UserRound, help: 'Your signed-in EVOLIX account.' },
  subscription: { title: 'Subscription', Icon: CreditCard, help: 'Your current plan and access. Your records remain safe when a plan ends.' },
  features: { title: 'Shop Features', Icon: SlidersHorizontal, help: 'Features available to this shop. Your plan and shop permissions control access.' },
  backup: { title: 'Backup & Restore', Icon: Database, help: 'Backups protect your records. Exporting a report is a separate action.' },
};
export default function RetailAccount({ section = 'business' }: { section?: Section }) {
  if(section==='subscription')return <RetailSubscription/>;
  if(section==='features')return <RetailShopFeatures/>;
  return <RetailAccountDetails section={section}/>;
}
function RetailAccountDetails({section}:{section:Section}) {
  useUiLanguage();
  const navigate = useNavigate();
  const access=useRetailEntitlements();
  const tenant = useAuthStore(s => s.tenantContext);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const requestKey=useRef<string|null>(null);
  const { title, Icon, help } = sections[section];
  const load = async () => { setLoading(true); setError(''); try { const response = await api.get<Account>('/retail/account'); setAccount(response.data); } catch (err) { setError(getApiErrorMessage(err)); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const row = (label: string, value?: string | null) => <div className="r-detail-row"><span>{ui(label)}</span><strong>{value || ui('Not added')}</strong></div>;
  const exportData = async (portability=false) => {
    if(!portability&&!access.isFeatureEffective('EXPORT_FULL_BUSINESS')){navigate('/retail/more/subscription?plan=PRO');return;}
    setExporting(true); setError(''); setNotice('');
    try {
      if(portability)await api.post('/retail/account/privacy-requests',{type:'DATA_PORTABILITY',note:'Owner requested account-exit/data portability copy through Account settings.'});
      requestKey.current ||= createUuid();
      const request=(await api.post('/retail/account/backup-requests',{request_key:requestKey.current})).data;
      const response = await api.get('/retail/account/export', { responseType: 'blob',params:{request_id:request.id} });
      const content=await response.data.text();
      if(!/\{"complete":true\}\s*$/.test(content))throw new Error('The export was interrupted. Retry to get a complete file.');
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'EVOLIX-account-data.ndjson'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);requestKey.current=null; setNotice(ui('Your shop records download has started. EVOLIX support has been notified of your request and may follow up. Keep the file private.'));
    } catch (err) { setError(getApiErrorMessage(err)); } finally { setExporting(false); }
  };
  return <>
    <StitchHeader className="r-page-header" hasBack><button className="r-btn r-btn--icon" aria-label={ui("Back to More")} onClick={() => navigate('/retail/more')}><ArrowLeft size={22} /></button><h1>{ui(title)}</h1><Icon size={24} aria-hidden="true" /></StitchHeader>
    <main className="r-section r-account-page"><p className="r-caption">{ui(help)}</p>
      {loading && <div className="r-state-message" role="status">Loading {title.toLowerCase()}…</div>}
      {error && <div className="r-state-message" role="alert"><p>{error}</p><button className="r-btn r-btn--outline" onClick={load}>{ui("Try Again")}</button></div>}
      {account && <>
        {section === 'business' && <><div className="r-card"><h2>Shop details</h2>{row('Business name', account.business.name)}{row('Legal name', account.business.legal_name)}{row('Phone', account.business.phone)}{row('Email', account.business.email)}{row('Address', account.business.address)}{row('GSTIN', account.business.gstin)}</div><div className="r-card"><h2>Current store</h2>{row('Branch', account.branch?.name)}{row('Store code', account.branch?.code)}{row('Financial year', tenant?.financial_year_label)}<Link className="r-btn r-btn--outline r-btn--full" to="/retail/more/locations">View Stock Locations</Link></div></>}
        {section === 'profile' && <><div className="r-card"><h2>{account.profile.display_name}</h2>{row('Username', account.profile.username)}{row('Email', account.profile.email)}{row('Phone', account.profile.phone)}{row('Recovery email', account.profile.email_verified ? 'Verified' : 'Not verified')}{row('Google account', account.profile.google_linked ? 'Connected' : 'Not connected')}</div><Link className="r-btn r-btn--outline r-btn--full" to="/retail/more/security"><ShieldCheck size={20} />Manage account security</Link><div className="r-card"><h2>Your data</h2><p className="r-caption">Complete business export is a Pro convenience. For account exit, use the data portability process on any plan.</p><button className="r-btn r-btn--outline r-btn--full" onClick={() => void exportData()} disabled={exporting}><Download size={20} />{exporting ? 'Preparing data…' : ui('Complete Business Export')}</button><Link className="r-btn r-btn--ghost r-btn--full" to="/retail/more/backup">{ui("Backup, exports & data portability")}</Link></div></>}
        {section === 'backup' && <><BackupStatus backup={account.backup}/><RetailDataExports/>{access.canManage&&<div className="r-card"><h2>{ui('Complete Business Export')}</h2><p className="r-caption">{ui('Pro includes a complete business records export. Attachment files are downloaded separately. This file is not a database restore archive.')}</p><button className="r-btn r-btn--outline r-btn--full" onClick={()=>void exportData()} disabled={exporting}><Download size={20}/>{ui(exporting?'Preparing data…':access.isFeatureEffective('EXPORT_FULL_BUSINESS')?'Download Business Records':'Available in Pro')}</button></div>}{access.canManage&&<div className="r-card"><h2>{ui('Account exit & data portability')}</h2><p className="r-caption">{ui('Leaving EVOLIX? Request your core business records on any plan. This process does not delete your account. Support receives your request.')}</p><button className="r-btn r-btn--outline r-btn--full" onClick={()=>void exportData(true)} disabled={exporting}>{ui('Request portability copy')}</button><Link className="r-btn r-btn--ghost r-btn--full" to="/delete-account">{ui('Request account deletion')}</Link></div>}</>}

      </>}
      {notice && <p role="status" className="r-state-message">{notice}</p>}
    </main>
  </>;
}
