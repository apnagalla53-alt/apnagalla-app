import { ui, useUiLanguage } from "../i18n";
import { MobileSelect } from './components/MobileControls';
import { useState } from 'react';
import { khataApi, supplierApi } from './retailApi';
import api, { getApiErrorMessage } from '../shared/api';
import { ChevronDown, UserRound, MapPin, BadgeIndianRupee } from 'lucide-react';
import { gstInputMode } from './gst/gstInput';
import DateInput from '../shared/components/DateInput';
import { readWorkflowDraft,useWorkflowDraft } from './experience/workflowDraft';
import CustomerContactField from './components/CustomerContactField';

export default function RetailPartyForm({ supplier = false, stickyActions = false, initial,initialName='', onSaved }: { supplier?: boolean; stickyActions?: boolean; initial?: any;initialName?:string; onSaved: (id: string) => void }) {
  useUiLanguage();
  const flow=(supplier?'supplier-form:':'customer-form:')+(initial?.id||initialName||'new');const [seed]=useState(()=>readWorkflowDraft<{form:Record<string,string>;credit:boolean;advanced:boolean}>(flow));
  const [form, setForm] = useState<Record<string, string>>(() => { if(seed)return {...(!supplier&&!initial?{opening_balance:'0'}:{}),...seed.form};const values:Record<string,string>={name:initialName,mobile:'',supplier_category:'REGULAR',credit_days:'0',...(!supplier&&!initial?{opening_balance:'0'}:{})}; if(initial)for(const key of ['name','mobile','code','nickname','supplier_category','credit_days','credit_limit','max_credit_bills','address','state','email','gstin','pan','visit_cycle','visit_date'])values[key]=initial[key]==null?'':key==='visit_date'?String(initial[key]).slice(0,10):String(initial[key]);return values; });
  const [credit, setCredit] = useState(seed?.credit??initial?.credit_allowed ?? true); const [advanced, setAdvanced] = useState(seed?.advanced||false);
  const draft=useWorkflowDraft(flow,{form,credit,advanced});
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const field = (key: string, label: string, type = 'text', required = false, placeholder?: string) => {const Input=type==='date'?DateInput:'input';return <div className="form-group" key={key}>
    <label htmlFor={(supplier ? 'supplier-' : 'customer-') + key}>{ui(label)}{required && !label.includes('*') && <span className="r-required-hint" aria-hidden="true"> · Required</span>}</label>
    <Input id={(supplier ? 'supplier-' : 'customer-') + key} className="r-input" type={type} min={type === 'number' ? 0 : undefined} step={['opening_balance','credit_limit'].includes(key)?'0.01':undefined}
      inputMode={key==='gstin'?gstInputMode(form[key]||''):type==='number'?'decimal':type==='tel'?'tel':'text'} autoCapitalize={['gstin','pan'].includes(key)?'characters':'sentences'} spellCheck={['gstin','pan'].includes(key)?false:undefined} maxLength={key==='gstin'?15:key==='pan'?10:undefined}
      placeholder={placeholder} required={required} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: ['gstin','pan'].includes(key)?e.target.value.toUpperCase().trim():e.target.value })} />
  </div>;};
  return <form onSubmit={async e => {
    e.preventDefault(); if (saving) return; setSaving(true); setError('');
    const payload: any = { name: form.name.trim(), credit_allowed: credit };
    for (const [key, value] of Object.entries(form)) if (key !== 'name' && (supplier || !['supplier_category','nickname','max_credit_bills','visit_cycle','visit_date','state','gstin'].includes(key)) && (!initial || key!=='opening_balance')) {
      if(value.trim())payload[key]=['credit_days','credit_limit','max_credit_bills','opening_balance'].includes(key)?Number(value):value.trim();
      else if(initial&&['mobile','nickname','address','state','email','gstin','pan','visit_date','credit_limit','max_credit_bills'].includes(key))payload[key]=null;
    }
    try { const response = await (initial ? api.patch('/retail/'+(supplier?'suppliers':'customers')+'/'+initial.id,payload) : supplier ? supplierApi.createSupplier(payload) : khataApi.createCustomer(payload)); draft.clear();onSaved(initial?.id || response.data.data.id); }
    catch (err) { setError(getApiErrorMessage(err)); } finally { setSaving(false); }
  }}>
    <div className="r-card r-form-section">{supplier&&<h2><UserRound size={21}/>{ui("Supplier details")}</h2>}
      {supplier && <div className="form-group"><label htmlFor="supplier-category">{ui("Supplier Category")}</label><MobileSelect id="supplier-category" className="r-select" value={form.supplier_category} onChange={e => setForm({ ...form, supplier_category: e.target.value })} presentation="segments"><option value="REGULAR">{ui("Regular")}</option><option value="DISTRIBUTOR">{ui("Distributor")}</option></MobileSelect></div>}
    {field('name', supplier ? 'Supplier Name*' : 'Customer Name', 'text', true, supplier ? 'e.g. ABC Distributors' : undefined)}
    {supplier?field('mobile', 'Mobile (optional)', 'tel'):<>
      <CustomerContactField value={form.mobile||''} disabled={saving} onChange={mobile=>setForm(current=>({...current,mobile}))}
        onContact={(name,mobile)=>setForm(current=>({...current,name:current.name.trim()?current.name:name,mobile}))}/>
      <label className="r-customer-credit"><span>{ui('Credit allowed')}</span><input type="checkbox" role="switch" checked={credit} onChange={e=>setCredit(e.target.checked)} disabled={saving}/></label>
      {!initial&&<>{field('opening_balance', 'Opening Due (₹)', 'number')}<p className="r-caption r-customer-opening-note">{ui('Old udhaar before using Apna Galla')}</p></>}
    </>}
    {supplier&&<p className="r-caption">{ui("A name is enough to get started. Add the rest when you need it.")}</p>}</div>
    {supplier && <details className="r-card"><summary>{ui("Supplier visits (optional)")}</summary>{field('visit_date','Next supplier visit','date')}<label htmlFor="supplier-visit-cycle">{ui("Repeat visit")}</label><MobileSelect id="supplier-visit-cycle" className="r-select" value={form.visit_cycle||'NONE'} onChange={e=>setForm({...form,visit_cycle:e.target.value})} presentation="segments"><option value="NONE">{ui("Once")}</option><option value="WEEKLY">{ui("Every week")}</option><option value="MONTHLY">{ui("Every month on this date")}</option></MobileSelect><p className="r-caption">Monthly visits on the 29th-31st use the last day in shorter months. Visible in Calendar.</p></details>}
    <button type="button" className="r-btn r-btn--outline r-btn--full" aria-expanded={advanced} aria-controls="party-advanced-details" onClick={() => setAdvanced(!advanced)}>{ui(supplier?"Advanced details":"More details (optional)")} <ChevronDown size={20}/></button>
    {advanced && <div id="party-advanced-details" className="r-card r-form-section">
      {field('code', 'Party Code (optional)')}{supplier && field('nickname', 'Nickname')}

      <h2><MapPin size={21}/>{ui("Address & business details")}</h2>
      {field('address', 'Address')}{supplier&&field('state', 'State')}{field('email', 'Email', 'email')}{supplier&&field('gstin', 'GSTIN')}{field('pan', 'PAN')}
      <h2><BadgeIndianRupee size={21}/>{supplier?ui("Credit purchases"):ui("Udhar policy")}</h2>
      {supplier&&<label className="r-toggle-row"><input type="checkbox" checked={credit} onChange={e => setCredit(e.target.checked)} />{ui("Credit allowed")}</label>}
      {field('credit_days', 'Credit Days', 'number')}{field('credit_limit', 'Credit Limit (₹)', 'number')}
      {supplier && field('max_credit_bills', 'Maximum Credit Bills', 'number')}
    </div>}
    {error && <p role="alert" className="r-error">{error}</p>}
    <div className={stickyActions ? 'r-sticky-footer r-entry-footer' : undefined}><button type="submit" className={'r-btn r-btn--primary r-w-full' + (stickyActions ? '' : ' r-mt-lg')} disabled={saving || !form.name.trim()}>{saving ? ui("Saving…") : initial ? ui('Save Changes') : supplier ? ui("SAVE SUPPLIER") : ui("Save Customer")}</button></div>
  </form>;
}
