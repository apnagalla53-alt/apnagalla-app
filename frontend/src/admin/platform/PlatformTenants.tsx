import { useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { usePlatform, Notice, Rows, Field, dateInput } from './platform-ui';
export default function PlatformTenants() {
  const [search,setSearch] = useState(''); const [open,setOpen] = useState(false);
  const [params]=useSearchParams();const [status,setStatus]=useState(params.get('status')||''),[planFilter,setPlanFilter]=useState(params.get('plan')||'');
  const [access,setAccess]=useState(params.get('access') || '');
  const [offset,setOffset]=useState(0);const state=usePlatform<any[]>('tenants?'+new URLSearchParams({search,status,access,plan:planFilter,offset:String(offset),limit:'100'}));const plans=usePlatform<any[]>('plans');
  const initial = { organizationName:'', adminName:'', adminEmail:'', adminPassword:'', phone:'', city:'', state:'', businessType:'General Retail',
    planId:'', startDate:dateInput(), expiryDate:dateInput(new Date(Date.now()+30*86400_000).toISOString()), userLimit:5, deviceLimit:5 };
  const [form,setForm] = useState(initial);
  function input(key: keyof typeof initial, label: string, required = false, type = 'text') {
    return <Field key={key} label={label}><input type={type} required={required} min={type==='number'?1:undefined} minLength={key==='adminPassword'?8:undefined} value={form[key]} onChange={e=>setForm({...form,[key]:type==='number'?Number(e.target.value):e.target.value})} /></Field>;
  }
  async function create(e: React.FormEvent) { e.preventDefault(); const {planId,...body}=form;
    const {adminEmail,...rest}=body;
    if(await state.save('tenants', {...rest,...(adminEmail&&{adminEmail}),...(planId&&{planId})})) {setOpen(false);setForm(initial);} }
  const rows = state.data || [];
  return <div className="platform-page"><div className="platform-actions"><h1>Organizations</h1><button className="primary" onClick={()=>setOpen(!open)}>Create organization</button></div><Notice state={state}/>
    {open && <section className="platform-card"><h2>New shop</h2><form className="platform-form" onSubmit={create}>
      {input('organizationName','Shop name',true)}{input('adminName','Owner name',true)}{input('adminEmail','Owner email / username',false,'email')}{input('adminPassword','Temporary password',true,'password')}
      {input('phone','Phone',true)}{input('city','City')}{input('state','State')}{input('businessType','Business type')}
      <Field label="Plan"><select value={form.planId} onChange={e=>setForm({...form,planId:e.target.value})}><option value="">Default</option>{plans.data?.filter(p=>p.is_active&&['STARTER','SMART','PRO'].includes(p.code)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      {input('startDate','Subscription start',true,'date')}{input('expiryDate','Subscription expiry',true,'date')}{input('userLimit','User limit',true,'number')}{input('deviceLimit','Device limit',true,'number')}
      <button className="primary" disabled={state.busy}>Create ready-to-use shop</button>
    </form></section>}
    <Field label="Search shops, ID or phone"><input value={search} onChange={e=>{setSearch(e.target.value);setOffset(0);}} /></Field>
    <Field label="Access requests"><select value={access} onChange={e=>{setAccess(e.target.value);setOffset(0);}}><option value="">All shops</option><option value="pending">Pending access requests</option></select></Field>
    <div className="platform-form"><Field label="Tenant status"><select value={status} onChange={e=>{setStatus(e.target.value);setOffset(0);}}><option value="">All statuses</option>{['ACTIVE','TRIAL','SUSPENDED','CANCELLED','ARCHIVED'].map(s=><option key={s}>{s}</option>)}</select></Field><Field label="Plan filter"><select value={planFilter} onChange={e=>{setPlanFilter(e.target.value);setOffset(0);}}><option value="">All plans</option>{['STARTER','SMART','PRO'].map(s=><option key={s}>{s}</option>)}</select></Field></div>
    {!state.loading && state.data && <Rows rows={rows} columns={[{name:'Organization',render:t=><Link to={'/platform/tenants/'+t.id}>{t.name}<br/>{t.public_id}</Link>},
      {name:'Status',render:t=>t.subscription?.status==='PENDING'?'Pending access':t.status},{name:'Plan',render:t=>t.plan?.name || 'No plan'}, {name:'Expiry',render:t=>t.subscription?.status==='PENDING'?'Awaiting approval':t.subscription?dateInput(t.subscription.expires_at):'No subscription recorded'},
      {name:'Access',render:t=>t.subscription?.status==='PENDING'?<Link to={'/platform/tenants/'+t.id}>Review / grant access</Link>:'Granted'},
      {name:'Owner / providers',render:t=><>{t.owner_contacts?.[0]?.display_name||'—'}<br/>{t.owner_contacts?.[0]?.phone||t.owner_contacts?.[0]?.email||''}<br/>{[t.owner_contacts?.[0]?.google_connected?'Google':null,t.owner_contacts?.[0]?.phone_verified_at?'Mobile':null,t.owner_contacts?.[0]?.password_login_enabled?'Password':null].filter(Boolean).join(', ')}</>},
      {name:'Location',render:t=>[t.companies[0]?.city,t.companies[0]?.state].filter(Boolean).join(', ') || '—'}]}/>}
    <div className="platform-actions"><button disabled={offset===0||state.loading} onClick={()=>setOffset(n=>Math.max(0,n-100))}>Previous</button><span>Page {offset/100+1}</span><button disabled={state.loading||(state.data?.length||0)<100} onClick={()=>setOffset(n=>n+100)}>Next</button></div>
  </div>;
}

