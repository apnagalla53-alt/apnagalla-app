import { Link } from 'react-router-dom';
import { usePlatform, Notice, money } from './platform-ui';
export default function PlatformDashboard() {
  const state = usePlatform<any>('dashboard');
  const metrics = [['total_tenants','Organizations'],['active_tenants','Active'],['trial_tenants','Trial'],['suspended_tenants','Suspended'],
    ['paying_tenants','Paying tenants'],['new_tenants_this_month','New this month'],['expired_tenants','Expired'],['expiring_7_days','Expiring in 7 days'],['total_users','Total users'],['active_today','Active today'],['active_7_days','Active in 7 days'],['online_users','Online now']];
  const financial = [['subscription_revenue','Net subscription receipts'],['revenue_this_month','Receipts this month'],['pending_payments','Pending payments'],['refunds','Refunds'],['platform_expenses','Platform expenses'],['mrr','MRR'],['arr','ARR']];
  return <div className="platform-page"><h1>Platform dashboard</h1><Notice state={state} />{state.data && <>
    <div className="platform-grid">{metrics.map(([key,label]) => <div key={key} className="platform-card"><p className="platform-muted">{label}</p><div className="platform-stat">{state.data[key]}</div></div>)}</div>
    <div className="platform-grid">{Object.entries(state.data.plan_distribution||{}).map(([code,count])=><Link className="platform-card" key={code} to={'/platform/tenants?plan='+code}><p>{code.toLowerCase()} shops</p><strong>{String(count)}</strong></Link>)}<Link className="platform-card" to="/platform/tenants?status=ARCHIVED"><p>Archived</p><strong>{state.data.archived_tenants}</strong></Link></div>
    <div className="platform-grid">{financial.map(([key,label]) => <div key={key} className="platform-card"><p className="platform-muted">{label}</p><div className="platform-stat">{money(state.data[key])}</div></div>)}</div>
    <section className="platform-card"><h2>How these numbers are measured</h2>{Object.entries(state.data.metric_notes).map(([key,note]) => <p key={key} className="platform-muted">{String(note)}</p>)}</section>
    <div className="platform-actions"><Link to="/platform/tenants">Manage organizations</Link><Link to="/platform/infrastructure">View measured infrastructure health</Link></div>
  </>}</div>;
}

