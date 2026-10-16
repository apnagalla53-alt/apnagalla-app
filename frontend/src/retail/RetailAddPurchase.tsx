import DateInput from '../shared/components/DateInput';
import {trackExperience} from './experience/experienceEvents';
import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
import RemotePartySelect from './components/RemotePartySelect';
import { MobileSelect, Sheet } from './components/MobileControls';
import RetailPartyForm from './RetailPartyForm';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { purchaseApi, supplierApi, itemApi, type RetailItem, type RetailSupplier } from './retailApi';
import api, { getApiErrorMessage } from '../shared/api';
import { AttachmentPicker } from '../shared/components/AttachmentPicker';
import { useOptionalPhotoUpload } from '../shared/useOptionalPhotoUpload';
import PurchaseItemSearch from './components/PurchaseItemSearch';
import PaymentChoices from './components/PaymentChoices';
import { ArrowLeft } from 'lucide-react';
import './retail-entry-forms.css';
import QuickCreateItemSheet,{type QuickCreatedItem} from './experience/QuickCreateItemSheet';
import {readWorkflowDraft,useWorkflowDraft} from './experience/workflowDraft';

type Line = { item_id: string; quantity: string; purchase_rate: string; unit_id?: string; variant_id?: string; batch_number?: string; expiry_date?: string; manufacturing_date?: string; mrp?: string; selling_price?: string; length?: string; width?: string; height?: string; serial_text?: string };
const emptyLine = (): Line => ({ item_id: '', quantity: '1', purchase_rate: '' });
export default function RetailAddPurchase() {
  useUiLanguage();
  const navigate = useNavigate(); const [params]=useSearchParams();
  const [seed]=useState(()=>readWorkflowDraft<any>('purchase'));
  const [creatingItem,setCreatingItem]=useState<{index:number;name:string}|null>(null);
  const [items, setItems] = useState<RetailItem[]>([]); const [suppliers, setSuppliers] = useState<RetailSupplier[]>([]);
  const [options, setOptions] = useState<Record<string, any>>({}); const [lines, setLines] = useState<Line[]>(seed?.lines||[{...emptyLine(),item_id:params.get('item')||''}]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [supplier, setSupplier] = useState(seed?.supplier??''); const [mode, setMode] = useState(seed?.mode??'ITEMIZED');
  const [totalAmount, setTotalAmount] = useState(seed?.totalAmount??''); const [status, setStatus] = useState(seed?.status??''); const [paid, setPaid] = useState(seed?.paid??''); const [method, setMethod] = useState(seed?.method??'CASH');
  const [addingSupplier,setAddingSupplier]=useState(false);
  const supplierSaved=async(id:string)=>{trackExperience('supplier_inline_created',{workflow:'PURCHASE'});setSupplier(id);setAddingSupplier(false);try{const response=await supplierApi.getTimeline(id);const row={...response.data.data.supplier,outstanding_amount:Number(response.data.data.balance)};setSuppliers(previous=>[...previous.filter(s=>s.id!==id),row]);}catch(err){setError('Supplier saved. '+getApiErrorMessage(err));}};
  const [billNumber, setBillNumber] = useState(seed?.billNumber??''); const [date, setDate] = useState(seed?.date??new Date().toLocaleDateString('en-CA'));
  const [due, setDue] = useState(seed?.due??''); const [note, setNote] = useState(seed?.note??''); const [category, setCategory] = useState(seed?.category??'REGULAR');
  const photoUpload = useOptionalPhotoUpload('purchase'); const [savedId, setSavedId] = useState(seed?.savedId??''); const [saving, setSaving] = useState(false);
  const draft=useWorkflowDraft('purchase',{lines,supplier,mode,totalAmount,status,paid,method,billNumber,date,due,note,category,savedId,catalog:items.filter(i=>lines.some(l=>l.item_id===i.id)),suppliers:suppliers.filter(s=>s.id===supplier),hadAttachment:!!photoUpload.file});
  const load = async () => { setLoading(true); setError(''); try { const [i, s] = await Promise.all([itemApi.getItems(), supplierApi.getSuppliers()]); let restored=seed?.catalog||[];setItems([...i.data.data,...restored.filter((r:RetailItem)=>!i.data.data.some(x=>x.id===r.id))]);setSuppliers(seed?.suppliers||s.data.data); } catch (err) { setError(getApiErrorMessage(err)); } finally { setLoading(false); } };
  useEffect(() => { load();trackExperience('purchase_started',{workflow:'PURCHASE'});if(seed)trackExperience('purchase_resumed',{workflow:'PURCHASE'}); }, []);
  const optionIds=lines.map(l=>l.item_id).filter(Boolean).sort().join(',');
  useEffect(()=>{let active=true;for(const id of new Set(optionIds.split(',').filter(Boolean)))if(!options[id])void api.get('/retail/items/'+id+'/options').then(response=>{if(active)setOptions(prev=>({...prev,[id]:response.data}));}).catch(err=>{if(active)setError(getApiErrorMessage(err));});return()=>{active=false;};},[optionIds]);
  const update = (index: number, values: Partial<Line>) => setLines(previous => previous.map((l, i) => i === index ? { ...l, ...values } : l));
  const choose = async (index: number, id: string) => {
    const item = items.find(i => i.id === id),previous=lines[index];update(index,{...emptyLine(),quantity:previous.item_id?'1':previous.quantity,item_id:id,purchase_rate:!previous.item_id&&previous.purchase_rate!==''?previous.purchase_rate:String(item?.purchase_price||''),unit_id:item?.primary_unit_id});
    if (!id || options[id]) return;
    try { const response = await api.get('/retail/items/' + id + '/options'); setOptions(prev => ({ ...prev, [id]: response.data })); } catch (err) { setError(getApiErrorMessage(err)); }
  };
  const lineValue = (line: Line) => {
    const item = items.find(i => i.id === line.item_id); let qty = Number(line.quantity);
    if (item?.selling_mode === 'AREA') qty *= Number(line.length || 0) * Number(line.width || 0);
    if (item?.selling_mode === 'VOLUME') qty *= Number(line.length || 0) * Number(line.width || 0) * Number(line.height || 0);
    return qty * Number(line.purchase_rate) * (1 + Number(item?.tax_rate || 0) / 100);
  };
  const estimate = mode === 'ITEMIZED' ? lines.reduce((sum, l) => sum + lineValue(l), 0) : Number(totalAmount);
  const input = (index: number, key: keyof Line, label: string, type = 'number', required = false) => {
    const id = key === 'quantity' ? index === 0 ? 'purchase-qty' : 'purchase-qty-' + index : key === 'purchase_rate' ? index === 0 ? 'purchase-rate' : 'purchase-rate-' + index : 'purchase-' + key + '-' + index;
    return <div className="form-group"><label htmlFor={id}>{ui(label)}</label><input id={id} className="r-input" type={type} step="any" min={type === 'number' ? key === 'quantity' ? '0.000001' : 0 : undefined} value={lines[index][key] || ''} required={required} onChange={e => update(index, { [key]: e.target.value })} /></div>;
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (saving) return; if(!status){setError('Choose Paid, Credit or Partial before saving.');return;} setSaving(true); setError('');
    try {
      let id = savedId;
      if (!id) {
        const payloadLines = lines.map(line => {
          const item = items.find(i => i.id === line.item_id);
          return { item_id: line.item_id, quantity: Number(line.quantity), purchase_rate: Number(line.purchase_rate),
            unit_id: line.unit_id || undefined, variant_id: line.variant_id || undefined,
            batch_number: line.batch_number || undefined, expiry_date: line.expiry_date || undefined, manufacturing_date: line.manufacturing_date || undefined,
            mrp: line.mrp ? Number(line.mrp) : undefined, selling_price: line.selling_price ? Number(line.selling_price) : undefined,
            ...(item?.selling_mode === 'AREA' || item?.selling_mode === 'VOLUME' ? { dimensions: { length: Number(line.length), width: Number(line.width), ...(item.selling_mode === 'VOLUME' ? { height: Number(line.height) } : {}) } } : {}),
            ...(item?.track_serial ? { serial_numbers: (line.serial_text || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean) } : {}) };
        });
        const response = await purchaseApi.createPurchase({ supplier_id: supplier, ...(mode === 'ITEMIZED' ? { lines: payloadLines } : { total_amount: Number(totalAmount) }),
          payment_status: status, paid_amount: status === 'PARTIAL' ? Number(paid) : undefined, payment_method: method,
          bill_number: billNumber || undefined, purchase_date: date, due_date: due || undefined, note, purchase_category: category });
        id = response.data.data.id;setSavedId(id);trackExperience('purchase_saved',{workflow:'PURCHASE'});
      }
      await photoUpload.upload('PURCHASE', id, 'PURCHASE_BILL');
      draft.clear();navigate('/retail/purchases');
    } catch (err) { setError(getApiErrorMessage(err)); } finally { setSaving(false); }
  };
  return <div className="r-page-with-sticky r-entry-page"><StitchHeader className="r-page-header r-entry-header" hasBack><div className="r-entry-heading"><button type="button" className="r-back-btn" aria-label={ui("Back")} onClick={() => navigate(-1)}><ArrowLeft size={22}/></button><h1>{ui("Buy Stock")}</h1></div></StitchHeader><div className="r-section">
    {draft.resumed&&<p className="xp-context-note">{ui('Your unfinished purchase is restored on this device.')}</p>}{seed?.hadAttachment&&!photoUpload.file&&<p data-tone="warning">{ui('Reattach the photo after refreshing. Your purchase details are kept.')}</p>}
    {loading && <p role="status">Loading items and suppliers…</p>}{error && <p role="alert">{photoUpload.failed ? 'Purchase saved. Photo upload needs retry. ' : ''}{error}<button type="button" className="r-btn" onClick={() => savedId ? setError('') : load()}>{ui("Try Again")}</button></p>}
    <form onSubmit={save}><fieldset disabled={saving || !!savedId} className="r-fieldset">
      <div className="form-group"><label htmlFor="purchase-mode">{ui("Purchase Type")}</label><MobileSelect id="purchase-mode" className="r-select" value={mode} onChange={e => setMode(e.target.value)} presentation="segments"><option value="ITEMIZED">{ui("Buy Stock")}</option><option value="QUICK">Quick Bill Record</option></MobileSelect></div>
      <div className="form-group"><label htmlFor="purchase-supplier">{ui("Select Supplier")}</label><RemotePartySelect id="purchase-supplier" className="r-select" value={supplier} required onChange={e => setSupplier(e.target.value)} records={suppliers} onAdd={()=>setAddingSupplier(true)} addLabel="Add Supplier" onLoaded={rows=>setSuppliers(prev=>[...prev.filter(p=>!rows.some(r=>r.id===p.id)),...rows])} supplier={true}><option value="">Choose Supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</RemotePartySelect><button type="button" className="r-btn" onClick={()=>setAddingSupplier(true)}>{ui("Add Supplier")}</button></div>
      {mode === 'ITEMIZED' ? lines.map((line, index) => {
        const item = items.find(i => i.id === line.item_id), detail = options[line.item_id];
        return <div className="r-card" key={index}><div className="r-entry-line-heading"><h3>Item {index + 1}</h3>{lines.length > 1 && <button type="button" className="r-btn" data-tone="danger" onClick={() => setLines(lines.filter((_, i) => i !== index))}>Remove item</button>}</div>
          <PurchaseItemSearch onCreate={name=>setCreatingItem({index,name})} index={index} value={line.item_id} selected={item} onSelect={id=>choose(index,id)} onLoaded={rows=>setItems(prev=>[...prev.filter(i=>!rows.some(row=>row.id===i.id)),...rows])}/>

          {item?.has_variants && <div className="form-group"><label htmlFor={'purchase-variant-' + index}>Variant</label><MobileSelect id={'purchase-variant-' + index} className="r-select" required value={line.variant_id || ''} onChange={e => update(index, { variant_id: e.target.value })}><option value="">Select variant</option>{detail?.variants.map((v: any) => <option key={v.id} value={v.id}>{Object.values(v.attributes || {}).join(' / ') || v.sku || 'Variant'}</option>)}</MobileSelect></div>}
          {detail && <div className="form-group"><label htmlFor={'purchase-unit-' + index}>{ui("Unit")}</label><MobileSelect id={'purchase-unit-' + index} className="r-select" value={line.unit_id || detail.primary_unit_id} onChange={e => update(index, { unit_id: e.target.value })}><option value={detail.primary_unit_id}>{detail.primary_unit.code}</option>{detail.unit_conversions.map((c: any) => <option key={c.id} value={c.from_unit_id}>{c.from_unit.code} ({Number(c.conversion_factor)} base units)</option>)}</MobileSelect></div>}
          <div className="r-form-grid">{input(index, 'quantity', 'Quantity', 'number', true)}{input(index, 'purchase_rate', 'Purchase Rate (₹)', 'number', true)}</div>
          {(item?.selling_mode === 'AREA' || item?.selling_mode === 'VOLUME') && <div className="r-form-grid">{input(index, 'length', 'Length', 'number', true)}{input(index, 'width', 'Width', 'number', true)}{item.selling_mode === 'VOLUME' && input(index, 'height', 'Height', 'number', true)}</div>}
          <details open={!!(item?.track_batch || item?.track_serial)}><summary>{ui("Price and receiving details")}</summary><div className="r-form-grid">{input(index, 'mrp', 'MRP (₹)')}{input(index, 'selling_price', 'Selling Price (₹)')}</div>
            {item?.track_batch && <>{input(index, 'batch_number', 'Batch Number', 'text', true)}<div className="r-form-grid">{input(index, 'manufacturing_date', 'Manufacturing Date', 'date')}{input(index, 'expiry_date', 'Expiry Date', 'date')}</div></>}
            {item?.track_serial && <label>Serial numbers, one per line<textarea className="r-input" required value={line.serial_text || ''} onChange={e => update(index, { serial_text: e.target.value })} /><span className="r-caption">Enter a different serial number for every unit received.</span></label>}
          </details><p>Estimated item total: ₹{lineValue(line).toFixed(2)}{item?.tax_rate ? ' including ' + item.tax_rate + '% GST' : ''}</p>
        </div>;
      }) : <div className="form-group"><label htmlFor="purchase-total">Total Bill Amount</label><input id="purchase-total" className="r-input" type="number" min="0.01" step="any" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} required inputMode="decimal" /><p>Quick Bill Record records the bill and supplier balance. It does not receive item stock.</p></div>}
      {mode === 'ITEMIZED' && <button type="button" className="r-btn r-btn--outline" onClick={() => setLines([...lines, emptyLine()])}>{ui("Add another item")}</button>}
      <details><summary>{ui("Bill details")}</summary><label htmlFor="purchase-bill-number">{ui("Supplier Bill Number")}</label><input id="purchase-bill-number" className="r-input" value={billNumber} onChange={e => setBillNumber(e.target.value)} />
        <div className="r-form-grid"><div><label htmlFor="purchase-date">{ui("Purchase Date")}</label><DateInput id="purchase-date" className="r-input" type="date" value={date} onChange={e => setDate(e.target.value)} required lang="en-GB" /></div><div><label htmlFor="purchase-due">{ui("Due Date")}</label><DateInput id="purchase-due" className="r-input" type="date" value={due} onChange={e => setDue(e.target.value)} lang="en-GB" /></div></div>
        <label htmlFor="purchase-category">Purchase Category</label><MobileSelect id="purchase-category" className="r-select" value={category} onChange={e => setCategory(e.target.value)} presentation="segments"><option value="REGULAR">{ui("Regular")}</option><option value="GENERAL">General / Cash Purchase</option><option value="ONLINE">Online</option></MobileSelect>
        <label htmlFor="purchase-note">{ui("Note")}</label><textarea id="purchase-note" className="r-input" value={note} onChange={e => setNote(e.target.value)} /></details>
      <p>Estimated total: ₹{estimate.toFixed(2)} · Final total is calculated by the server.</p>
      <div className="form-group"><label htmlFor="purchase-payment-status">Payment status</label><MobileSelect id="purchase-payment-status" value={status} onChange={e=>setStatus(e.target.value)} presentation="segments"><option value="CREDIT">{ui("Credit")}</option><option value="PARTIAL">{ui("Partial")}</option><option value="PAID">{ui("Paid")}</option></MobileSelect></div>
      <p role="status">{!status?'Choose how this purchase is being paid.':status==='CREDIT'?'₹'+estimate.toFixed(2)+' will be added to supplier due.':status==='PAID'?'No supplier due will be created.':'₹'+(Number(paid)||0).toFixed(2)+' paid · ₹'+Math.max(0,estimate-(Number(paid)||0)).toFixed(2)+' due.'}</p>
      {status === 'PARTIAL' && <div className="form-group"><label htmlFor="purchase-paid">{ui("Amount Paid Now")}</label><input id="purchase-paid" type="number" className="r-input" min=".01" step="any" value={paid} onChange={e => setPaid(e.target.value)} required inputMode="decimal" /></div>}
      {!!status && status !== 'CREDIT' && <PaymentChoices id="purchase-method" value={method} onChange={setMethod}/>}
    </fieldset><AttachmentPicker disabled={saving} onFileSelect={photoUpload.select} />
    {photoUpload.failed && <p role="status">Purchase saved. Retry uploads this photo only. <button type="button" className="r-btn" onClick={() => {photoUpload.select(null);draft.clear();navigate('/retail/purchases');}}>Continue without photo</button></p>}
    <div className="r-sticky-footer r-entry-footer"><button type="submit" className="r-btn r-btn--primary r-w-full" disabled={saving || loading || !supplier || !status || (status==='PARTIAL'&&(!(Number(paid)>0)||Number(paid)>=estimate)) || (!savedId && estimate <= 0)}>{saving ? ui("Saving…") : photoUpload.failed ? ui("Retry Photo Upload") : ui("SAVE PURCHASE")}</button></div></form></div>
    {creatingItem&&<QuickCreateItemSheet context="purchase" initialQuantity={lines[creatingItem.index].quantity} initialCost={lines[creatingItem.index].purchase_rate} name={creatingItem.name} onClose={()=>setCreatingItem(null)} onCreated={({item,quantity,purchasePrice,purchaseUnitId}:QuickCreatedItem)=>{setItems(prev=>[...prev.filter(i=>i.id!==item.id),item]);update(creatingItem.index,{...emptyLine(),item_id:item.id,quantity:String(quantity),purchase_rate:String(purchasePrice??''),selling_price:String(item.selling_price),unit_id:purchaseUnitId||item.primary_unit_id});setCreatingItem(null);}}/>}
    <Sheet open={addingSupplier} onClose={()=>setAddingSupplier(false)} title="Add Supplier"><RetailPartyForm supplier onSaved={id=>void supplierSaved(id)}/></Sheet>
  </div>;
}
