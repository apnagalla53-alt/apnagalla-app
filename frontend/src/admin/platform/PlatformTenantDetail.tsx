import DateInput from '../../shared/components/DateInput';
import PlatformShopFreshStart from './PlatformShopFreshStart';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePlatform, Notice, Rows, Field, dateInput, when } from './platform-ui';
import { PlatformPayments } from './PlatformResources';
import PlatformTenantLifecycle from './PlatformTenantLifecycle';
import PlatformUserCredentials from './PlatformUserCredentials';
import PlatformTenantMetadata from './PlatformTenantMetadata';
import PlatformTenantUserEditor from './PlatformTenantUserEditor';
import PlatformAccessGrant from './PlatformAccessGrant';

const tabs=['Overview','Owner & Contacts','Subscription','Features','Users','Devices','Usage','Imports','Referrals','Billing','Support','Audit','Backups','Security','Danger Zone'];
function SupportRecords({sessionId}:{sessionId:string}){
  const [kind,setKind]=useState('bills');const state=usePlatform<any>('support/'+sessionId+'/records?kind='+kind);
  return <section className="platform-card"><h2>Support review</h2><Field label="Shop records"><select value={kind} onChange={e=>setKind(e.target.value)}><option value="bills">Recent bills</option><option value="purchases">Recent purchases</option><option value="items">Items</option></select></Field><Notice state={state}/>
    {state.data&&<Rows rows={state.data.rows} columns={[{name:'Record',render:r=>r.document_number||r.name},{name:'Date / code',render:r=>r.document_date?dateInput(r.document_date):r.sku},
      {name:'Amount',render:r=>r.grand_total||r.default_sale_rate||'0'},{name:'Status',render:r=>r.status||(r.is_active?'Active':'Inactive')}]}/>}</section>;
}
export default function PlatformTenantDetail(){
  const {id}=useParams();const state=usePlatform<any>('tenants/'+id);const plans=usePlatform<any[]>('plans');
  const [tab,setTab]=useState('Overview');const [reason,setReason]=useState('');const [plan,setPlan]=useState('');const [expiry,setExpiry]=useState('');
  const [days,setDays]=useState(7);const [limits,setLimits]=useState({users:1,staff:0,devices:2,branches:1,stock_locations:1,companies:1});
  const org=state.data;const disabled=state.busy||reason.trim().length<3;
  async function action(action:string,body:object={}){await state.save('tenants/'+id+'/actions',{action,reason,...body});}
  return <div className="platform-page"><Link to="/platform/tenants">← Organizations</Link><Notice state={state}/>{org&&<>
    <h1>{org.name} <span className="platform-muted">{org.public_id}</span></h1><p>{org.subscription?.status==='PENDING'?'Pending access':org.status} · {org.plan?.name||'No plan'}</p>
    <p>UPI Configured: {org.upi_configured?'Yes':'No'}</p>
    {org.support_sessions.length>0&&<div className="platform-support">Support mode active: read the organization’s records from this Platform view. No user impersonation is enabled.</div>}
    <Field label="Reason for administrative changes"><input placeholder="Reason recorded in audit" minLength={3} value={reason} onChange={e=>setReason(e.target.value)}/></Field>
    {reason.trim().length < 3 && <p className="platform-muted">Enter a reason of at least 3 characters to enable administrative changes. The reason is saved in the audit log.</p>}
    {org.subscription?.status === 'PENDING' && !org.archived_at && <PlatformAccessGrant org={org} plans={plans.data || []} reason={reason} busy={state.busy} grant={body => state.save('tenants/'+id+'/actions',{...body,reason})}/>}
    <div className="platform-tabs">{tabs.map(t=><button key={t} className={tab===t?'selected':''} onClick={()=>{setTab(t);if(t==='Usage')setLimits({...limits,...org.effective.limits});}}>{t}</button>)}</div>
    {tab==='Owner & Contacts'&&<section className="platform-card"><h2>Account identities</h2><Rows rows={org.users} columns={[{name:'Name',render:u=>u.display_name},{name:'Contact',render:u=><>{u.phone||'No phone'}<br/>{u.email||'No email'}</>},{name:'Sign-in providers',render:u=>[u.password_login_enabled?'Password':null,u.google_connected?'Google':null,u.phone_verified_at?'Mobile OTP':null].filter(Boolean).join(', ')},{name:'Setup',render:u=><>{u.onboarding_state}<br/>{u.onboarding_data?.requested_plan_code&&'Requested '+u.onboarding_data.requested_plan_code}</>},{name:'Secure actions',render:u=><PlatformUserCredentials tenantId={id!} userId={u.id} reason={reason}/>} ]}/><p>Provider credentials, Google subject IDs, passwords and tokens are excluded from this view.</p></section>}
    {tab==='Imports'&&<Rows rows={org.imports||[]} columns={[{name:'Source',render:r=>r.preset+' · '+r.kind},{name:'Status',render:r=>r.status},{name:'Created',render:r=>when(r.created_at)},{name:'File',render:r=>r.filename}]}/>}
    {tab==='Referrals'&&<section className="platform-card"><h2>Tenant referrals</h2><Rows rows={org.referrals||[]} columns={[{name:'Plan',render:r=>r.selected_plan||'Not selected'},{name:'Status',render:r=>r.status},{name:'Reward',render:r=>r.reward_status},{name:'Date',render:r=>when(r.created_at)}]}/><Link to="/platform/referrals">Review referral campaigns and rewards</Link></section>}
    {tab==='Danger Zone'&&<><PlatformShopFreshStart id={id!} reason={reason} reload={state.reload}/><PlatformTenantLifecycle id={id!} reason={reason} archived={!!org.archived_at} reload={state.reload}/></>}
    {tab==='Overview'&&<PlatformTenantMetadata org={org} reason={reason} reload={state.reload}/>}
    {tab==='Overview'&&<><section className="platform-card"><h2>Organization controls</h2>{org.subscription?.status === 'PENDING' && <p>Use “Grant access” above to approve this subscription. These controls only change organization status.</p>}<div className="platform-actions">
      {['ACTIVE','TRIAL','SUSPENDED','CANCELLED'].map(s=><button key={s} disabled={disabled||org.status===s} className={s==='SUSPENDED'||s==='CANCELLED'?'danger':''} onClick={()=>void action('status',{status:s})}>{s==='ACTIVE'?'Activate / reactivate':s==='SUSPENDED'?'Suspend':s==='CANCELLED'?'Cancel subscription':'Set trial'}</button>)}
    </div></section><section className="platform-card"><h2>Business</h2><p>{org.business_type||'Not recorded'}</p>{org.companies.map((c:any)=><p key={c.id}>{c.trade_name||c.legal_name} · {[c.city,c.state,c.phone].filter(Boolean).join(' · ')} · {c.branches.length} branch(es)</p>)}</section>
      <section className="platform-card"><h2>Internal notes</h2>{org.internal_notes.map((n:any,i:number)=><p key={i}>{n.text} · {when(n.at)}</p>)}<button disabled={disabled} onClick={()=>void action('note')}>Save reason as internal note</button></section></>}
    {tab==='Subscription'&&<section className="platform-card"><h2>Subscription</h2><p>Start: {org.subscription?dateInput(org.subscription.start_date):'Not recorded'} · Expiry: {org.subscription?dateInput(org.subscription.expires_at):'Not recorded'} · {org.subscription?.complimentary?'Complimentary':'Paid / trial'}</p>
      <div className="platform-form"><Field label="Change plan"><select value={plan||org.plan_id||''} onChange={e=>setPlan(e.target.value)}><option value="">Choose plan</option>{plans.data?.filter(p=>p.is_active&&['STARTER','SMART','PRO'].includes(p.code)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        {plan&&<div className="platform-card"><h3>Plan change preview</h3><p>{org.plan?.name} → {plans.data?.find(p=>p.id===plan)?.name}</p><p>New monthly price: ₹{plans.data?.find(p=>p.id===plan)?.monthly_price}</p><p>Features removed: {org.effective.features.filter((f:any)=>f.plan_default&&!plans.data?.find(p=>p.id===plan)?.plan_features.some((pf:any)=>pf.feature.code===f.code)).map((f:any)=>f.name).join(', ')||'None'}.</p><p>Historical records stay available. Existing tenant overrides are preserved.</p></div>}
        <button disabled={disabled||!plan} onClick={()=>void action('subscription',{plan_id:plan})}>Confirm plan change</button>
        <Field label="Custom expiry"><DateInput type="date" value={expiry||dateInput(org.subscription?.expires_at)} onChange={e=>setExpiry(e.target.value)} lang="en-GB"/></Field><button disabled={disabled||!expiry} onClick={()=>void action('subscription',{expires_at:expiry})}>Set expiry</button>
        <Field label="Free days"><input type="number" min="1" max="3650" value={days} onChange={e=>setDays(Number(e.target.value))} inputMode="decimal"/></Field><button disabled={disabled} onClick={()=>void action('subscription',{free_days:days})}>Grant free days</button>
        <button disabled={disabled} onClick={()=>void action('subscription',{complimentary:!org.subscription?.complimentary})}>{org.subscription?.complimentary?'Remove complimentary access':'Grant complimentary access'}</button>
      </div></section>}
    {tab==='Features'&&<section className="platform-card"><h2>Effective features</h2><p className="platform-muted">Plan defaults → tenant overrides → global rollout. Overrides preserve all existing data.</p>{[...new Set<string>(org.effective.features.map((f:any)=>f.group||'Other'))].map(group=><details key={group} open={group==='Daily Business'}><summary>{group}</summary><Rows rows={org.effective.features.filter((f:any)=>(f.group||'Other')===group)} columns={[
      {name:'Feature',render:f=>f.name},{name:'Plan default',render:f=>f.plan_default?'On':'Off'},{name:'Tenant override',render:f=>f.override===null?'INHERIT':f.override?'FORCE_ENABLE':'FORCE_DISABLE'},
      {name:'Effective',render:f=>f.enabled?'Enabled':'Disabled'},{name:'Actions',render:f=><div className="platform-actions"><button disabled={disabled} onClick={()=>void action('feature',{feature_code:f.code,enabled:true})}>Enable</button><button disabled={disabled} onClick={()=>void action('feature',{feature_code:f.code,enabled:false})}>Disable</button><button disabled={disabled||f.override===null} onClick={()=>void action('clear_feature',{feature_code:f.code})}>Use plan default</button></div>} ]}/></details>)}</section>}
    {tab==='Users'&&<section className="platform-card"><h2>Shop users</h2><Rows rows={org.users} columns={[{name:'User',render:u=>u.display_name+' · '+u.username},{name:'Role',render:u=>u.roles.map((r:any)=>r.role.name).join(', ')},{name:'Status',render:u=>u.is_active?(u.is_locked?'Locked':'Enabled'):'Disabled'},
      {name:'Last active',render:u=>when(u.last_active_at)},{name:'Actions',render:u=><div className="platform-actions"><button disabled={disabled} onClick={()=>void action(u.is_active?'disable_user':'enable_user',{user_id:u.id})}>{u.is_active?'Disable user':'Enable user'}</button>{u.is_locked&&<button disabled={disabled} onClick={()=>void action('unlock_user',{user_id:u.id})}>Unlock sign in</button>}<PlatformTenantUserEditor org={org} user={u} reason={reason} reload={state.reload}/></div>}]}/></section>}
    {tab==='Devices'&&<section className="platform-card"><h2>Devices and sessions</h2><Rows rows={org.sessions} columns={[{name:'Browser',render:s=>s.user_agent||'Unknown browser'},{name:'Last active',render:s=>when(s.last_active_at)},{name:'Status',render:s=>s.revoked_at?'Revoked':new Date(s.expires_at)<new Date()?'Expired':'Active'},
      {name:'Actions',render:s=><button disabled={disabled||!!s.revoked_at} onClick={()=>void action('revoke_session',{session_id:s.id})}>Revoke device</button>}]}/></section>}
    {tab==='Usage'&&<><section className="platform-card"><h2>Usage</h2><div className="platform-grid">{Object.entries(org.usage).map(([key,value])=><div key={key}><p>{key.replaceAll('_',' ')}</p><strong>{String(value)}</strong></div>)}</div></section><section className="platform-card"><h2>Effective limits</h2><form className="platform-form" onSubmit={e=>{e.preventDefault();void action('limits',{limits});}}>
      {Object.entries(limits).map(([key,value])=><Field key={key} label={key.replace('_',' ')}><input type="number" min={key==='staff'?0:1} required value={value} onChange={e=>setLimits({...limits,[key]:Number(e.target.value)})} inputMode="decimal"/></Field>)}<button disabled={disabled}>Save limits</button>
    </form><button disabled={disabled} onClick={()=>void action('clear_limits')}>Reset all numeric overrides to plan defaults</button></section></>}
    {tab==='Billing'&&<PlatformPayments organizationId={id}/>}
    {tab==='Support'&&<section className="platform-card"><h2>Support mode</h2><p>Start a one-hour support window with a recorded reason. The shop sees an active support banner. Review happens here with Platform permissions.</p>
      <button disabled={disabled} onClick={()=>void action('support_start')}>Start support window</button><Rows rows={org.support_sessions} columns={[{name:'Reason',render:s=>s.reason},{name:'Started / expires',render:s=>when(s.started_at)+' / '+when(s.expires_at)},
        {name:'Actions',render:s=><button disabled={disabled} onClick={()=>void action('support_end',{support_id:s.id})}>End support window</button>}]}/></section>}
    {tab==='Support'&&org.support_sessions.map((s:any)=><SupportRecords key={s.id} sessionId={s.id}/>)}
    {tab==='Audit'&&<Rows rows={org.audit} columns={[{name:'When',render:a=>when(a.created_at)},{name:'Administrator',render:a=>a.user.display_name},{name:'Action',render:a=>a.action},{name:'Details',render:a=><details><summary>View details</summary><pre style={{whiteSpace:'pre-wrap'}}>{a.details}</pre></details>}]}/>}
    {tab==='Backups'&&<section className="platform-card"><h2>Backup scope</h2><p>Shared database archives are managed centrally. Selective tenant restore is unavailable without an isolation-aware provider.</p><Link to="/platform/backups">Manage real database backups</Link></section>}
    {tab==='Security'&&<section className="platform-card"><h2>Access controls</h2><p>Active sessions: {org.usage.devices}. Suspending the shop or disabling a user revokes their sessions immediately.</p><p>Two-factor authentication provider: not configured.</p><button className="danger" disabled={disabled} onClick={()=>void action('logout')}>Force all shop users to sign in again</button></section>}
  </>}</div>;
}
