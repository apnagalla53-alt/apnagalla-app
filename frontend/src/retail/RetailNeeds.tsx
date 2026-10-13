import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
import RemotePartySelect from './components/RemotePartySelect';
import { MobileSelect, Sheet, EmptyState } from './components/MobileControls';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { needListApi, khataApi, supplierApi } from './retailApi';
import api, { getApiErrorMessage } from '../shared/api';
import { AttachmentPicker } from '../shared/components/AttachmentPicker';
import {Pencil} from 'lucide-react';
import {useCanManageMaster} from './components/MasterRecordActions';
export default function RetailNeeds() {
  useUiLanguage();
  const canEdit=useCanManageMaster('items'),[editingId,setEditingId]=useState('');
  const [params] = useSearchParams(); const [needs, setNeeds] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]); const [suppliers, setSuppliers] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL'); const [show, setShow] = useState(!!params.get('name')); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [form, setForm] = useState<Record<string,string>>({ name: params.get('name') || '', quantity: '', priority: 'NORMAL', source: 'SHOP' });
  const [saving, setSaving] = useState(false); const [file, setFile] = useState<File|null>(null); const [savedId, setSavedId] = useState('');
  const load = async () => { setLoading(true); try { const [n,c,s] = await Promise.all([needListApi.getNeeds(), khataApi.getCustomers(), supplierApi.getSuppliers()]); setNeeds(n.data.data); setCustomers(c.data.data); setSuppliers(s.data.data); } catch(err) {setError(getApiErrorMessage(err));} finally {setLoading(false);} };
  useEffect(() => { load(); }, []);
  const field = (key: string, label: string, type='text', required=false, placeholder?: string) => <div className="form-group"><label htmlFor={'need-'+key}>{ui(label)}</label><input id={'need-'+key} className="r-input" type={type} min={key==='quantity' ? '.000001' : 0} step="any" required={required} placeholder={placeholder} value={form[key]||''} onChange={e => setForm({...form,[key]:e.target.value})} /></div>;
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      let id=savedId;
      if(!id) { const payload: any = { name:form.name.trim(), priority:form.priority, source:form.source };
        for(const key of ['customer_id','customer_phone','preferred_supplier_id','needed_by','note']) if(form[key]) payload[key]=form[key];else if(editingId)payload[key]=null;
        for(const key of ['quantity','expected_price']) if(form[key]) payload[key]=Number(form[key]);else if(editingId&&key==='expected_price')payload[key]=null;
        id=editingId?(await api.patch('/retail/needs/'+editingId,payload)).data.id:(await needListApi.createNeed(payload)).data.data.id; setSavedId(id); }
      if(file) {const body=new FormData();body.append('file',file);body.append('entityType','NEED');body.append('entityId',id);body.append('category','NEED_PHOTO');await api.post('/attachments',body);}
      setShow(false);setSavedId('');setEditingId('');setFile(null);setForm({name:'',quantity:'',priority:'NORMAL',source:'SHOP'});await load();
    }catch(err){setError(getApiErrorMessage(err));}finally{setSaving(false);}
  };
  return <div className="retail-page"><StitchHeader className="r-page-header"><h1>Need List · Mangwana Hai</h1><button className="r-btn r-btn--primary" onClick={()=>setShow(true)}>Add Need</button></StitchHeader>
    {error&&<p className="r-section" role="alert">{savedId?'Need saved; photo upload needs retry. ':''}{error}<button className="r-btn" onClick={load}>{ui("Try Again")}</button></p>}
    <div className="r-section"><label htmlFor="need-filter">{ui("Status")}</label><MobileSelect id="need-filter" className="r-select" value={filter} onChange={e=>setFilter(e.target.value)} presentation="segments">{['ALL','NEED','ORDERED','RECEIVED','CANCELLED'].map(s=><option key={s}>{s}</option>)}</MobileSelect>
    {loading?<p role="status">Loading needs…</p>:needs.filter(n=>filter==='ALL'||n.status===filter).length===0?<EmptyState title="No needs found" description="Keep a list of what to buy or order for customers." action="Add Need" onAction={()=>setShow(true)}/>:needs.filter(n=>filter==='ALL'||n.status===filter).map(n=><div className="item-card" key={n.id}><div><h3>{n.name}</h3><p>Qty {Number(n.quantity)} · {n.priority} · {n.source}</p><p>{n.customer?.name||n.customer_phone}{n.preferred_supplier?' · Supplier: '+n.preferred_supplier.name:''}</p>{n.needed_by&&<p>Needed by {String(n.needed_by).slice(0,10)}</p>}{n.expected_price&&<p>Expected ₹{Number(n.expected_price)}</p>}{n.note&&<p>{n.note}</p>}{n.attachment&&<AttachmentPicker existingAttachmentUrl={'/api/v1/attachments/'+n.attachment.id+'/content'}/>}
      {canEdit&&<button type="button" className="r-btn r-btn--outline" onClick={()=>{const values:Record<string,string>={};for(const key of ['name','quantity','priority','source','customer_id','customer_phone','preferred_supplier_id','needed_by','expected_price','note'])values[key]=n[key]==null?'':key==='needed_by'?String(n[key]).slice(0,10):String(n[key]);setForm(values);setEditingId(n.id);setSavedId('');setFile(null);setShow(true);}}><Pencil size={18}/>{ui('Edit Need')}</button>}<label htmlFor={'need-status-'+n.id}>Change status</label><MobileSelect id={'need-status-'+n.id} className="r-select" value={n.status} onChange={async e=>{try{await needListApi.updateNeedStatus(n.id,e.target.value);await load();}catch(err){setError(getApiErrorMessage(err));}}}>{['NEED','ORDERED','RECEIVED','CANCELLED'].map(s=><option key={s}>{s}</option>)}</MobileSelect></div></div>)}</div>
    {show&&<Sheet open onClose={()=>{setShow(false);setSavedId('');setEditingId('');setFile(null);setForm({name:'',quantity:'',priority:'NORMAL',source:'SHOP'});}} title={editingId?'Edit Need':'Add Need'}><form onSubmit={save}><fieldset disabled={saving||!!savedId} className="r-fieldset">
      {field('name','Item Name','text',true,'e.g. Dairy Milk Silk')}{field('quantity','Quantity (optional)','number')}
      <label htmlFor="need-source">Source</label><MobileSelect id="need-source" className="r-select" value={form.source} onChange={e=>setForm({...form,source:e.target.value})} presentation="segments"><option value="SHOP">Shop Need</option><option value="CUSTOMER">Customer Request</option></MobileSelect>
      <label htmlFor="need-customer">{ui("Customer (optional)")}</label><RemotePartySelect id="need-customer" className="r-select" value={form.customer_id||''} onChange={e=>setForm({...form,customer_id:e.target.value,source:e.target.value?'CUSTOMER':form.source})} records={customers} onLoaded={rows=>setCustomers(prev=>[...prev.filter(p=>!rows.some(r=>r.id===p.id)),...rows])}><option value="">{ui("Select customer")}</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name} {c.mobile}</option>)}</RemotePartySelect>
      {field('customer_phone','Customer Phone','tel')}
      <label htmlFor="need-supplier">Preferred Supplier</label><RemotePartySelect id="need-supplier" className="r-select" value={form.preferred_supplier_id||''} onChange={e=>setForm({...form,preferred_supplier_id:e.target.value})} records={suppliers} onLoaded={rows=>setSuppliers(prev=>[...prev.filter(p=>!rows.some(r=>r.id===p.id)),...rows])} supplier={true}><option value="">Select supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</RemotePartySelect>
      {field('needed_by','Needed By','date')}<label htmlFor="need-priority">Priority</label><MobileSelect id="need-priority" className="r-select" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})} presentation="segments"><option value="NORMAL">{ui("Normal")}</option><option value="URGENT">Urgent</option></MobileSelect>
      {field('expected_price','Expected Price (₹)','number')}{field('note','Note')}</fieldset><AttachmentPicker onFileSelect={setFile}/>
      {savedId&&<button type="button" className="r-btn" onClick={()=>{setShow(false);setSavedId('');setEditingId('');setFile(null);setForm({name:'',quantity:'',priority:'NORMAL',source:'SHOP'});load();}}>Continue without photo</button>}
      <button type="submit" className="r-btn r-btn--primary r-w-full" disabled={saving||!form.name.trim()}>{saving?ui("Saving…"):savedId?ui("Retry Photo Upload"):editingId?ui('Save Changes'):'SAVE NEED'}</button></form></Sheet>}
      <button className="fab" aria-label="Add Need" onClick={()=>setShow(true)}>+</button>
  </div>;
}
