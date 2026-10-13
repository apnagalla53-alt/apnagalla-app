import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlatform, Notice, Rows, Field, dateInput, money, when } from './platform-ui';
import { featureAvailability } from '../../retail/subscription/planPresentation';

export function PlatformPlans() {
  const state=usePlatform<any[]>('plans'); const features=usePlatform<any[]>('features');
  const empty={id:'',code:'',name:'',description:'',monthly_price:0,limits:{users:1,staff:0,devices:2,branches:1,stock_locations:1,companies:1},feature_codes:[] as string[],is_active:true};
  const [form,setForm]=useState(empty); const [open,setOpen]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();const {id,...dto}=form;if(await state.save('plans'+(id?'/'+id:''),dto,id?'patch':'post')){setOpen(false);setForm(empty);}}
  return <div className="platform-page"><div className="platform-actions"><h1>Plans</h1></div><p>Apna Galla Starter ₹75 · Smart ₹120 (MOST POPULAR) · Pro ₹210. All launch plans cover one business, one branch and one stock location. Canonical assignments and limits are fixed; use tenant overrides for exceptional access.</p><p className="platform-muted">Multiple locations, branches and transfers are Future Premium. Voice and scheduled export are not sold in current plans. Advanced pricing has a Pro entitlement but its Retail screen is Coming Soon.</p><Notice state={state}/>
    {open&&<section className="platform-card"><form className="platform-form" onSubmit={submit}>
      <Field label="Plan code"><input required readOnly value={form.code}/></Field>
      <Field label="Plan name"><input required readOnly value={form.name}/></Field>
      <Field label="Monthly list price"><input required readOnly type="number" value={form.monthly_price}/></Field>
      {Object.entries(form.limits).map(([key,value])=><Field key={key} label={key.replace('_',' ')}><input type="number" readOnly value={value}/></Field>)}
      <Field label="Description"><textarea readOnly value={form.description}/></Field>
      <div><label><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/>Available to new shops</label></div>
      <div>{features.data?.map(f=><label key={f.id} style={{display:'block',margin:'8px 0'}}><input type="checkbox" disabled checked={form.feature_codes.includes(f.code)}/>{f.name}{featureAvailability(f)!=='AVAILABLE'?' · '+featureAvailability(f).replaceAll('_',' '):''}</label>)}</div>
      <button className="primary" disabled={state.busy}>Save plan</button>
    </form></section>}
    {state.data&&<Rows rows={state.data.filter(p=>['STARTER','SMART','PRO'].includes(p.code))} columns={[{name:'Plan',render:p=>p.name+' ('+p.code+')'},{name:'List price',render:p=>money(p.monthly_price)},{name:'Features',render:p=>p.plan_features.map((f:any)=>f.feature.name).join(', ')||'No defaults'},
      {name:'Limits',render:p=>Object.entries(p.limits).map(([k,v])=>k+': '+v).join(', ')},{name:'Actions',render:p=><button onClick={()=>{setForm({id:p.id,code:p.code,name:p.name,is_active:p.is_active,limits:p.limits,description:p.description||'',monthly_price:Number(p.monthly_price),feature_codes:p.plan_features.map((f:any)=>f.feature.code)});setOpen(true);}}>Edit plan</button>}]}/>}
  </div>;
}

export function PlatformFeatures(){
  const state=usePlatform<any[]>('features');const tenants=usePlatform<any[]>('tenants');
  const initial={code:'',name:'',is_active:true,rollout_mode:'ON',rollout_percent:100,beta_tenants:[] as string[]};
  const [form,setForm]=useState(initial);
  return <div className="platform-page"><h1>Features and rollout</h1><Notice state={state}/>
    <section className="platform-card"><form className="platform-form" onSubmit={async e=>{e.preventDefault();if(await state.save('features',form))setForm(initial);}}>
      <Field label="Feature code"><input required maxLength={50} value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></Field><Field label="Feature name"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
      <Field label="Rollout"><select value={form.rollout_mode} onChange={e=>setForm({...form,rollout_mode:e.target.value})}>{['OFF','BETA','PERCENTAGE','ON'].map(m=><option key={m}>{m}</option>)}</select></Field>
      {form.rollout_mode==='PERCENTAGE'&&<Field label="Percent of tenants"><input type="number" min="0" max="100" value={form.rollout_percent} onChange={e=>setForm({...form,rollout_percent:Number(e.target.value)})}/></Field>}
      {form.rollout_mode==='BETA'&&<Field label="Beta organizations"><select multiple value={form.beta_tenants} onChange={e=>setForm({...form,beta_tenants:Array.from(e.target.selectedOptions,o=>o.value)})}>{tenants.data?.map(t=><option key={t.id} value={t.id}>{t.name} {t.public_id}</option>)}</select></Field>}
      <label><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/>Feature active</label><button className="primary" disabled={state.busy}>Save rollout</button>
    </form></section>
    <p className="platform-muted">Global rollout gates the effective plan default and tenant override. Disabling a feature preserves historical data.</p>
    {state.data&&<Rows rows={state.data} columns={[{name:'Feature',render:f=>f.name},{name:'Code',render:f=>f.code},{name:'Rollout',render:f=>f.rollout_mode+(f.rollout_mode==='PERCENTAGE'?' '+f.rollout_percent+'%':'')},{name:'Active',render:f=>f.is_active?'Yes':'No'},
      {name:'Actions',render:f=><button onClick={()=>setForm({code:f.code,name:f.name,is_active:f.is_active,rollout_mode:f.rollout_mode,rollout_percent:f.rollout_percent,beta_tenants:f.beta_tenants})}>Edit rollout</button>}]}/>}
  </div>;
}

export function PlatformPayments({organizationId}:{organizationId?:string}){
  const state=usePlatform<any[]>('payments');const tenants=usePlatform<any[]>('tenants');
  const initial={organization_id:organizationId||'',amount:0,tax:0,discount:0,status:'PAID',method:'MANUAL',reference:'',period_months:1,paid_at:dateInput()};
  const [form,setForm]=useState(initial);const [refund,setRefund]=useState({id:'',amount:0,reason:''});
  return <div className="platform-page"><h1>Subscription billing</h1><Notice state={state}/><section className="platform-card"><h2>Record actual payment</h2>
    <form className="platform-form" onSubmit={async e=>{e.preventDefault();if(await state.save('payments',form))setForm(initial);}}>
      <Field label="Organization"><select required value={form.organization_id} onChange={e=>setForm({...form,organization_id:e.target.value})}><option value="">Choose organization</option>{tenants.data?.map(t=><option key={t.id} value={t.id}>{t.name} {t.public_id}</option>)}</select></Field>
      {(['amount','tax','discount','period_months'] as const).map(k=><Field key={k} label={k.replace('_',' ')}><input type="number" min={k==='period_months'?1:0} step={k==='period_months'?1:'.01'} required value={form[k]} onChange={e=>setForm({...form,[k]:Number(e.target.value)})}/></Field>)}
      <Field label="Payment status"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{['PAID','PENDING','FAILED'].map(s=><option key={s}>{s}</option>)}</select></Field>
      <Field label="Payment method"><select value={form.method} onChange={e=>setForm({...form,method:e.target.value})}>{['MANUAL','CASH','UPI','CARD','BANK'].map(s=><option key={s}>{s}</option>)}</select></Field>
      <Field label="Payment reference"><input required value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></Field>
      <Field label="Payment date"><input required type="date" value={form.paid_at} onChange={e=>setForm({...form,paid_at:e.target.value})}/></Field><button className="primary" disabled={state.busy}>Record payment</button>
    </form><p className="platform-muted">Recording a payment does not automatically change expiry. Renew the subscription from the organization page.</p></section>
    {refund.id&&<section className="platform-card"><h2>Refund subscription payment</h2><form className="platform-form" onSubmit={async e=>{e.preventDefault();if(await state.save('payments/'+refund.id+'/refund',{amount:refund.amount,reason:refund.reason}))setRefund({id:'',amount:0,reason:''});}}>
      <Field label="Refund amount"><input type="number" min=".01" step=".01" required value={refund.amount} onChange={e=>setRefund({...refund,amount:Number(e.target.value)})}/></Field>
      <Field label="Refund reason"><input required minLength={3} value={refund.reason} onChange={e=>setRefund({...refund,reason:e.target.value})}/></Field><button disabled={state.busy}>Record refund</button>
    </form></section>}
    {state.data&&<Rows rows={state.data.filter(p=>!organizationId||p.organization_id===organizationId)} columns={[{name:'Organization',render:p=>p.organization.name},{name:'Plan snapshot',render:p=>p.plan_name},{name:'Charge / refund',render:p=>money(Number(p.amount)+Number(p.tax)-Number(p.discount))+' / '+money(p.refund_amount)},
      {name:'Status',render:p=>p.status},{name:'Date / reference',render:p=>dateInput(p.paid_at)+' '+p.reference},{name:'Actions',render:p=>p.status==='PAID'&&<button onClick={()=>setRefund({id:p.id,amount:0,reason:''})}>Refund</button>}]}/>}
  </div>;
}

export function PlatformExpenses(){
  const state=usePlatform<any[]>('expenses');const initial={category:'SERVER',amount:0,expense_date:dateInput(),method:'BANK',reference:'',note:''};const [form,setForm]=useState(initial);
  return <div className="platform-page"><h1>Platform expenses</h1><p className="platform-muted">SaaS operating costs are recorded separately from each shop’s expenses.</p><Notice state={state}/>
    <section className="platform-card"><form className="platform-form" onSubmit={async e=>{e.preventDefault();if(await state.save('expenses',form))setForm(initial);}}>
      <Field label="Cost category"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['SERVER','DATABASE','STORAGE','DOMAIN','EMAIL_SMS','GATEWAY','SUPPORT','ADS','SALARY','SOFTWARE','MISC'].map(c=><option key={c}>{c}</option>)}</select></Field>
      <Field label="Amount"><input required type="number" min=".01" step=".01" value={form.amount} onChange={e=>setForm({...form,amount:Number(e.target.value)})}/></Field>
      <Field label="Expense date"><input required type="date" value={form.expense_date} onChange={e=>setForm({...form,expense_date:e.target.value})}/></Field>
      <Field label="Payment method"><select value={form.method} onChange={e=>setForm({...form,method:e.target.value})}>{['CASH','UPI','CARD','BANK','MANUAL'].map(m=><option key={m}>{m}</option>)}</select></Field>
      <Field label="Reference"><input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></Field><Field label="Note"><textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></Field><button className="primary" disabled={state.busy}>Record platform expense</button>
    </form></section>
    {state.data&&<Rows rows={state.data} columns={[{name:'Date',render:r=>dateInput(r.expense_date)},{name:'Category',render:r=>r.category},{name:'Amount',render:r=>money(r.amount)},{name:'Method',render:r=>r.method},{name:'Reference / note',render:r=>[r.reference,r.note].filter(Boolean).join(' · ')}]}/>}
  </div>;
}

export function PlatformAudit(){
  const state=usePlatform<any[]>('audit');return <div className="platform-page"><h1>Platform audit</h1><Notice state={state}/>{state.data&&<Rows rows={state.data} columns={[
    {name:'When',render:r=>when(r.created_at)},{name:'Administrator',render:r=>r.user.display_name},{name:'Action',render:r=>r.action},{name:'Resource',render:r=>r.resource_type},
    {name:'Details',render:r=><details><summary>View audit details</summary><pre style={{whiteSpace:'pre-wrap',maxWidth:500}}>{r.details||'No additional details'}</pre></details>} ]}/>}</div>;
}

export function PlatformInfrastructure(){
  const state=usePlatform<any>('infrastructure');const d=state.data;
  return <div className="platform-page"><h1>Infrastructure and database</h1><Notice state={state}/>{d&&<>
    <div className="platform-grid">{[['Environment',d.environment],['Application version',d.version],['Uptime',d.uptime_seconds+' seconds'],['Node',d.node_version],['CPU cores',d.cpu_cores],['Process CPU time',d.process_cpu_seconds.toFixed(2)+' seconds']].map(([label,value])=><div className="platform-card" key={label}><p>{label}</p><strong>{value}</strong></div>)}</div>
    <section className="platform-card"><h2>Database: {d.database.status}</h2>{d.database.status==='CONNECTED'?<><p>{d.database.name} · {d.database.version}</p><p>Size: {Number(d.database.size_bytes).toLocaleString()} bytes · Connections: {d.database.connections} / {d.database.max_connections} · Query latency: {d.database.latency_ms} ms</p></>:<p>{d.database.message}</p>}</section>
    <section className="platform-card"><h2>Server measurements</h2><p>Process memory: {Math.round(d.process_memory_bytes.rss/1048576)} MB · Host free memory: {Math.round(d.host_memory_bytes.free/1048576)} MB / {Math.round(d.host_memory_bytes.total/1048576)} MB</p>
      <p>Requests in last 5 minutes: {d.requests.sampled_requests} (up to {d.requests.sample_limit} samples) · Average latency: {d.requests.average_latency_ms===null?'No requests measured':d.requests.average_latency_ms.toFixed(2)+' ms'} · Server error rate: {d.requests.server_error_rate_percent===null?'No requests measured':d.requests.server_error_rate_percent.toFixed(2)+'%'}</p></section>
    <section className="platform-card"><h2>Provider metrics: {d.provider_metrics.status}</h2><p>{d.provider_metrics.reason}</p></section>
  </>}</div>;
}

export function PlatformBackups(){
  const state=usePlatform<any>('backups');const [restore,setRestore]=useState({id:'',target_database:'',reason:'',confirmation:''});
  return <div className="platform-page"><h1>Database backups</h1><Notice state={state}/>{state.data&&<>
    <section className="platform-card"><h2>Provider: {state.data.provider.status}</h2><p>{state.data.provider.reason||state.data.provider.provider+' · '+state.data.provider.tool_version}</p>
      <p className="platform-muted">Selective tenant restore and production PITR require a configured provider. Local restore targets a pre-created disposable database; the running ERP database is protected.</p>
      <button className="primary" disabled={state.busy||state.data.provider.status!=='AVAILABLE'} onClick={()=>void state.save('backups',{})}>Create database backup</button></section>
    <Rows rows={state.data.backups} columns={[{name:'Created',render:b=>when(b.created_at)},{name:'Type / environment',render:b=>b.type+' · '+b.environment},{name:'Size',render:b=>b.size_bytes.toLocaleString()+' bytes'},{name:'Verification',render:b=>b.status},
      {name:'Location',render:b=>b.location},{name:'Actions',render:b=><div className="platform-actions"><button disabled={state.busy} onClick={()=>void state.save('backups/'+b.id+'/verify',{})}>Verify archive</button>
        {b.verified_at&&state.data.provider.restore_target&&<button onClick={()=>setRestore({id:b.id,target_database:state.data.provider.restore_target,reason:'',confirmation:''})}>Restore disposable target</button>}</div>} ]}/>
    {restore.id&&<section className="platform-card"><h2>Restore {restore.target_database}</h2><p>A safety backup of the target is created before restoring. This replaces all data in the disposable target.</p><form className="platform-form" onSubmit={async e=>{e.preventDefault();const{id,...dto}=restore;if(await state.save('backups/'+id+'/restore',dto))setRestore({...restore,id:''});}}>
      <Field label="Restore reason"><input required minLength={3} value={restore.reason} onChange={e=>setRestore({...restore,reason:e.target.value})}/></Field>
      <Field label={'Type RESTORE '+restore.target_database}><input required value={restore.confirmation} onChange={e=>setRestore({...restore,confirmation:e.target.value})}/></Field>
      <button className="danger" disabled={state.busy||restore.confirmation!=='RESTORE '+restore.target_database}>Restore target</button>
    </form></section>}
  </>}</div>;
}

export function PlatformUsers(){
  const state=usePlatform<any>('users');return <div className="platform-page"><h1>Users</h1><Notice state={state}/>{state.data&&<>
    <section className="platform-card"><h2>Tenant users</h2><Rows rows={state.data.tenant_users} columns={[{name:'User',render:u=>u.display_name+' · '+u.username},{name:'Status',render:u=>u.is_active?(u.is_locked?'Locked':'Enabled'):'Disabled'},
      {name:'Last activity',render:u=>when(u.last_active_at)},{name:'Actions',render:u=>u.organization_id&&<Link to={'/platform/tenants/'+u.organization_id}>Manage user in organization</Link>}]}/></section>
    <section className="platform-card"><h2>Platform administrators</h2><Rows rows={state.data.platform_users} columns={[{name:'Administrator',render:u=>u.display_name+' · '+u.username},{name:'Status',render:u=>u.is_active?'Enabled':'Disabled'},{name:'Last activity',render:u=>when(u.last_active_at)}]}/></section>
  </>}</div>;
}

export function PlatformSessions(){
  const state=usePlatform<any>('sessions');return <div className="platform-page"><h1>Devices and sessions</h1><Notice state={state}/>{state.data&&['tenant','platform'].map(kind=><section key={kind} className="platform-card"><h2>{kind==='tenant'?'Shop sessions':'Platform sessions'}</h2><Rows rows={state.data[kind]} columns={[
    {name:'User',render:s=>s.user.display_name},{name:'Browser / device',render:s=>s.user_agent||'Unknown browser'},{name:'Last active',render:s=>when(s.last_active_at)},
    {name:'Status',render:s=>s.revoked_at?'Revoked':new Date(s.expires_at)<new Date()?'Expired':'Active'},{name:'Actions',render:s=>s.user.organization_id&&<Link to={'/platform/tenants/'+s.user.organization_id}>Manage device</Link>}]}/></section>)}</div>;
}

export function PlatformSettings(){
  const state=usePlatform<any>('settings');const announcements=usePlatform<any[]>('announcements');
  const [form,setForm]=useState({maintenance_mode:false,banner:'',signup_enabled:true,force_login:false,reason:''});const [edit,setEdit]=useState(false);
  const initial={title:'',message:'',audience:'ALL',tenant_ids:[] as string[],starts_at:dateInput(),ends_at:dateInput(new Date(Date.now()+7*86400_000).toISOString()),priority:0};
  const [message,setMessage]=useState(initial);const tenants=usePlatform<any[]>('tenants');
  return <div className="platform-page"><h1>Platform operations</h1><section className="platform-card"><h2>App publishing</h2><p>Developer, support, public policies and Android release details.</p><Link to="/platform/publishing">Configure app publishing</Link></section><Notice state={state}/><section className="platform-card"><h2>Maintenance and access</h2>{state.data&&!edit&&<><p>Maintenance: {state.data.maintenance_mode?'Enabled':'Disabled'} · Signup: {state.data.signup_enabled?'Enabled':'Disabled'}</p><p>{state.data.banner||'No banner'}</p><button onClick={()=>{setForm({...form,...state.data});setEdit(true);}}>Edit operations</button></>}
    {edit&&<form className="platform-form" onSubmit={async e=>{e.preventDefault();if(await state.save('settings',form))setEdit(false);}}>
      <Field label="Visible banner"><textarea maxLength={2000} value={form.banner} onChange={e=>setForm({...form,banner:e.target.value})}/></Field>
      {(['maintenance_mode','signup_enabled','force_login'] as const).map(k=><label key={k}><input type="checkbox" checked={form[k]} onChange={e=>setForm({...form,[k]:e.target.checked})}/>{k.replaceAll('_',' ')}</label>)}
      <Field label="Change reason"><input required minLength={3} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></Field><button className="primary" disabled={state.busy}>Apply operations</button>
    </form>}</section>
    <Notice state={announcements}/><section className="platform-card"><h2>Publish announcement</h2><form className="platform-form" onSubmit={async e=>{e.preventDefault();if(await announcements.save('announcements',message))setMessage(initial);}}>
      <Field label="Title"><input required value={message.title} onChange={e=>setMessage({...message,title:e.target.value})}/></Field><Field label="Message"><textarea required value={message.message} onChange={e=>setMessage({...message,message:e.target.value})}/></Field>
      <Field label="Audience"><select value={message.audience} onChange={e=>setMessage({...message,audience:e.target.value})}>{['ALL','FREE','RETAIL','RETAIL_PLUS','SELECTED'].map(a=><option key={a}>{a}</option>)}</select></Field>
      {message.audience==='SELECTED'&&<Field label="Selected organizations"><select multiple value={message.tenant_ids} onChange={e=>setMessage({...message,tenant_ids:Array.from(e.target.selectedOptions,o=>o.value)})}>{tenants.data?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
      <Field label="Starts"><input type="date" required value={message.starts_at} onChange={e=>setMessage({...message,starts_at:e.target.value})}/></Field><Field label="Ends"><input type="date" required value={message.ends_at} onChange={e=>setMessage({...message,ends_at:e.target.value})}/></Field>
      <Field label="Priority"><input type="number" min="0" max="10" value={message.priority} onChange={e=>setMessage({...message,priority:Number(e.target.value)})}/></Field><button className="primary" disabled={announcements.busy}>Publish announcement</button>
    </form></section>{announcements.data&&<Rows rows={announcements.data} columns={[{name:'Title',render:a=>a.title},{name:'Message',render:a=>a.message},{name:'Audience',render:a=>a.audience},{name:'Dates',render:a=>dateInput(a.starts_at)+' – '+dateInput(a.ends_at)}]}/>}
  </div>;
}

export function PlatformSupport(){
  const state=usePlatform<any[]>('support');return <div className="platform-page"><h1>Support windows</h1><p>Support uses an audited, visible review window. Start or end a window from the organization’s Support tab.</p><Notice state={state}/>
    {state.data&&<Rows rows={state.data} columns={[{name:'Organization',render:s=><Link to={'/platform/tenants/'+s.organization_id}>{s.organization.name}</Link>},{name:'Reason',render:s=>s.reason},
      {name:'Started',render:s=>when(s.started_at)},{name:'Expires',render:s=>when(s.expires_at)},{name:'Status',render:s=>s.status}]}/>}</div>;
}
export function PlatformAlerts(){
  const state=usePlatform<any>('alerts');return <div className="platform-page"><h1>Platform alerts</h1><Notice state={state}/>{state.data&&<>
    <section className="platform-card"><h2>Backup status</h2><p>{state.data.backup.status.replaceAll('_',' ')}{state.data.backup.last_verified?' · '+when(state.data.backup.last_verified):''}</p><Link to="/platform/backups">Open backups</Link></section>
    <h2>Shop backup requests · follow-up queue</h2><p>Requests are recorded for support. No customer call or message is sent automatically. Export prepared means the server produced the file; it does not prove the customer saved it.</p>
    <Rows rows={state.data.backup_requests||[]} columns={[{name:'Shop',render:a=><Link to={'/platform/tenants/'+a.company.organization_id}>{a.company.trade_name||a.company.legal_name}</Link>},{name:'Requested by',render:a=>a.user.display_name},{name:'Contact',render:a=>a.user.phone||a.company.phone||'No phone added'},{name:'Status',render:a=>a.status},{name:'Requested',render:a=>when(a.created_at)},{name:'Follow-up',render:a=><button disabled={state.busy} onClick={()=>void state.save('backup-requests/'+a.id+'/followup',{})}>Mark follow-up done</button>}]}/>
    <Rows rows={state.data.alerts} columns={[{name:'Organization',render:a=><Link to={'/platform/tenants/'+a.tenant_id}>{a.title}</Link>},{name:'Alert',render:a=>a.detail},{name:'Expiry',render:a=>when(a.date)}]}/></>}</div>;
}
