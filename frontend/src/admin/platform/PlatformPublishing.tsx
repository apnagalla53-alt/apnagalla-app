import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Field, Notice, Rows, usePlatform } from './platform-ui';

export default function PlatformPublishing(){
  const state=usePlatform<any>('publishing'),requests=usePlatform<any[]>('publishing/privacy-requests');
  const [form,setForm]=useState<any>(null),[saved,setSaved]=useState(false);
  useEffect(()=>{if(state.data)setForm({...state.data,reason:''});},[state.data]);
  return <div className="platform-page"><h1>App publishing</h1><p>Fill these details after researching your business requirements. Blank fields remain unconfigured; no example support address is published.</p><Notice state={state}/>
    {form&&<form className="platform-form platform-card" onSubmit={async e=>{e.preventDefault();setSaved(false);const body:any={...form};for(const k of Object.keys(body))if(body[k]==='')delete body[k];if(await state.save('publishing',body))setSaved(true);}}>
      {[['developer_name','Developer name','EVOLIX Studio'],['legal_name','Legal business name','Add your registered legal name'],['website','Developer website','https://evolix-studio.in'],['support_email','Support email','Add a working support inbox'],['android_package','Android package name','Choose a unique reverse-domain identifier'],['business_address','Business address','Add your business contact address']].map(([k,label,placeholder])=><Field key={k} label={label}><input type={k==='support_email'?'email':k==='website'?'url':'text'} required={k==='developer_name'} value={form[k]||''} placeholder={placeholder} onChange={e=>setForm({...form,[k]:e.target.value})}/></Field>)}
      {[['retention_policy','Retention and deletion policy'],['privacy_text','Additional approved privacy policy'],['terms_text','Approved commercial terms']].map(([k,label])=><Field key={k} label={label}><textarea rows={5} value={form[k]||''} placeholder="Complete after reviewing your operating and legal requirements" onChange={e=>setForm({...form,[k]:e.target.value})}/></Field>)}
      <label><input type="checkbox" checked={form.policies_approved} onChange={e=>setForm({...form,policies_approved:e.target.checked})}/>I have reviewed and approved these public policies</label>
      <Field label="Change reason"><input required minLength={3} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></Field><button className="primary" disabled={state.busy}>Save publishing details</button>{saved&&<p role="status">Publishing details saved.</p>}
      <p><Link to="/privacy">Preview privacy policy</Link> · <Link to="/terms">Preview terms</Link> · <Link to="/delete-account">Preview deletion page</Link></p>
    </form>}
    <section className="platform-card"><h2>Account deletion requests</h2><p>Review identity and retention obligations before processing. A pending request is not proof of completed deletion. Record the operator procedure outside this queue until an audited fulfillment process is approved.</p><Notice state={requests}/>{requests.data&&<Rows rows={requests.data} columns={[{name:'Request',render:r=>r.id},{name:'Tenant',render:r=><Link to={'/platform/tenants/'+r.organization_id}>{r.organization_id}</Link>},{name:'User',render:r=>r.user_id},{name:'Status',render:r=>r.status},{name:'Created',render:r=>new Date(r.created_at).toLocaleString()}]}/>}</section>
  </div>;
}
