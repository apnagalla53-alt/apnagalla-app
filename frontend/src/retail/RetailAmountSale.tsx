import DateInput from '../shared/components/DateInput';
import { indiaToday } from '../shared/dateFormat';
import { readWorkflowDraft,useWorkflowDraft } from './experience/workflowDraft';
import {trackExperience} from './experience/experienceEvents';
import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
import RemotePartySelect from './components/RemotePartySelect';
import { MobileSelect } from './components/MobileControls';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../shared/store/authStore';
import api, { getApiErrorMessage } from '../shared/api';
import { AttachmentPicker } from '../shared/components/AttachmentPicker';
import { useOptionalPhotoUpload } from '../shared/useOptionalPhotoUpload';
import {notifyPayment} from './payments/paymentVoice';
import UpiQr from './payments/UpiQr';
import ManualUpiConfirmation from './payments/ManualUpiConfirmation';
import PaymentChoices from './components/PaymentChoices';
import { ArrowLeft, Plus } from 'lucide-react';
import './retail-entry-forms.css';
export default function RetailAmountSale({ udhar=false }: { udhar?: boolean }) {
  useUiLanguage();
  const user=useAuthStore(state=>state.user),canCustomers=['OWNER','ADMIN','TENANT_ADMIN'].includes(user?.role||'')||!!user?.permissions.includes('accounting.read');
  const navigate=useNavigate();const [searchParams]=useSearchParams();const [customers,setCustomers]=useState<any[]>([]);
  const [seed]=useState(()=>readWorkflowDraft<any>(udhar?'udhar-entry':'amount-sale'));
  const [amount,setAmount]=useState(()=>{const requested=!udhar?searchParams.get('amount'):null;return requested&&Number.isFinite(Number(requested))&&Number(requested)>0?requested:seed?.amount||'';});const [method,setMethod]=useState(seed?.method||'CASH');const [customer,setCustomer]=useState(seed?.customer||'');
  const [date,setDate]=useState(seed?.date||indiaToday());const [due,setDue]=useState(seed?.due||'');const [note,setNote]=useState(seed?.note||'');const [channel,setChannel]=useState(seed?.channel||'COUNTER');
  const photoUpload = useOptionalPhotoUpload(udhar?'udhar-entry':'amount-sale');const [invoice,setInvoice]=useState<any>(seed?.invoice||null);const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  const [upiConfirmed,setUpiConfirmed]=useState(false),[receivingProfile,setReceivingProfile]=useState(seed?.receivingProfile||''),[alternate,setAlternate]=useState(!!seed?.alternate),[receivingMobile,setReceivingMobile]=useState(seed?.receivingMobile||'');
  const draft=useWorkflowDraft(udhar?'udhar-entry':'amount-sale',{amount,method,customer,date,due,note,channel,invoice,receivingProfile,alternate,receivingMobile});
  useEffect(()=>{setUpiConfirmed(false);},[method,amount,receivingProfile,alternate,receivingMobile]);
  return <div className="r-page-with-sticky r-entry-page r-stitch-amount-sale">
    <StitchHeader className="r-page-header r-entry-header" hasBack><div className="r-entry-heading"><button type="button" className="r-back-btn" aria-label={ui("Back")} onClick={()=>navigate('/retail/home')}><ArrowLeft size={22}/></button><h1>{udhar?ui("Udhar Entry"):ui("Amount-only Sale")}</h1></div></StitchHeader>
    <div className="r-section"><div className="r-entry-intro"><div><strong>{ui('Amount-only Sale')}</strong><p>{ui('No item is selected, so item stock will not update and exact profit cannot be calculated.')}</p></div><button type="button" className="r-btn r-btn--outline" onClick={()=>navigate('/retail/quick-sale')}><Plus size={18}/>{ui("Quick Bill")}</button></div>
    {error&&<p role="alert">{photoUpload.failed?'Bill saved; photo upload needs retry. ':''}{error}</p>}
    <form onSubmit={async e=>{e.preventDefault();if(saving||!udhar&&method==='UPI'&&!invoice&&!upiConfirmed)return;setSaving(true);setError('');try{let sale=invoice;if(!sale){sale=(await api.post('/retail/bills/amount-sale',{amount:Number(amount),payment_method:udhar?'UDHAR':method,customer_id:customer||undefined,date,due_date:due||undefined,note,sales_channel:channel,...(method==='UPI'?{receipt_confirmed:upiConfirmed,...(alternate?{received_on_mobile:receivingMobile}:receivingProfile?{receiving_profile_id:receivingProfile}:{})}:{})})).data;setInvoice(sale);trackExperience('amount_only_sale_used',{workflow:'PAYMENT'});if(!udhar)void notifyPayment(sale.id);}
      await photoUpload.upload('SALES_INVOICE', sale.id, 'SALE_PROOF');draft.clear();navigate('/retail/bills/'+sale.id+'/print');}catch(err){setError(getApiErrorMessage(err));}finally{setSaving(false);}}}>
      <fieldset className="r-fieldset" disabled={saving||!!invoice}>
      {udhar&&<section className="r-card r-sale-customer"><label htmlFor="amount-sale-customer">{ui('Customer')} <span aria-hidden='true'>*</span></label><RemotePartySelect id="amount-sale-customer" className="r-select" value={customer} onChange={e=>setCustomer(e.target.value)} required records={customers} onLoaded={rows=>setCustomers(prev=>[...prev.filter(p=>!rows.some(r=>r.id===p.id)),...rows])} filter={p=>p.active!==false&&!!p.credit_allowed}><option value="">{ui('Select customer')}</option>{customers.filter(c=>c.active&&c.credit_allowed).map(c=><option key={c.id} value={c.id}>{c.name} {c.mobile}</option>)}</RemotePartySelect></section>}
      <section className="r-card r-sale-amount"><label htmlFor="amount-sale-amount">{ui('Amount (₹)')} <span aria-hidden='true'>*</span></label><input id="amount-sale-amount" className="r-input r-currency-input" type="number" min=".01" step="any" value={amount} placeholder="0" onChange={e=>setAmount(e.target.value)} required inputMode="decimal"/>{!udhar&&<div className="r-amount-shortcuts">{[50,100,200,500].map(n=><button type="button" key={n} onClick={()=>setAmount(String((Number(amount)||0)+n))}>+₹{n}</button>)}</div>}</section>
      {!udhar&&canCustomers&&<section className="r-card r-sale-customer"><label htmlFor="amount-sale-customer">{ui('Customer')} · {ui('optional')}</label><RemotePartySelect id="amount-sale-customer" className="r-select" value={customer} onChange={e=>setCustomer(e.target.value)} records={customers} onLoaded={rows=>setCustomers(prev=>[...prev.filter(p=>!rows.some(r=>r.id===p.id)),...rows])} filter={p=>p.active!==false}><option value="">{ui('Walk-in Customer')}</option>{customers.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.name} {c.mobile}</option>)}</RemotePartySelect></section>}
      {!udhar&&<section className="r-card"><PaymentChoices id="amount-sale-method" value={method} onChange={setMethod}/>{method==='UPI'&&Number(amount)>0&&<><UpiQr amount={Number(amount)} selectedProfileId={receivingProfile} onProfileChange={setReceivingProfile}/><label className="r-upi-confirmation"><input type="checkbox" checked={alternate} onChange={e=>setAlternate(e.target.checked)}/>Received payment on another number</label>{alternate&&<label>Receiving mobile number<input type="tel" inputMode="numeric" className="r-input" value={receivingMobile} maxLength={10} minLength={10} pattern="[6-9][0-9]{9}" required onChange={e=>setReceivingMobile(e.target.value.replace(/\D/g,''))}/></label>}<ManualUpiConfirmation checked={upiConfirmed} onChange={setUpiConfirmed}/></>}</section>}
      <section className="r-card"><label htmlFor="amount-sale-date">{ui(udhar?'Bill Date':'Date')}</label><DateInput id="amount-sale-date" className="r-input" type="date" required value={date} onChange={e=>setDate(e.target.value)} lang="en-GB"/>{udhar&&<><label htmlFor="amount-sale-due">{ui('Due Date')}</label><DateInput id="amount-sale-due" className="r-input" type="date" value={due} onChange={e=>setDue(e.target.value)} lang="en-GB"/><p className="r-caption">{ui('When will the customer pay? The date appears in Calendar.')}</p></>}</section>
      <details className="r-card"><summary>{ui('Optional Details')}</summary><label htmlFor="amount-sale-channel">{ui('Sales Channel')}</label><MobileSelect id="amount-sale-channel" className="r-select" value={channel} onChange={e=>setChannel(e.target.value)} presentation="segments">{['COUNTER','PHONE','WHATSAPP','ONLINE','OTHER'].map(m=><option key={m}>{m}</option>)}</MobileSelect><label htmlFor="amount-sale-note">{ui('Note')}</label><textarea id="amount-sale-note" className="r-input" value={note} onChange={e=>setNote(e.target.value)}/><AttachmentPicker onFileSelect={photoUpload.select}/></details>
      <section className="r-card r-sale-guarantee"><h2>{ui(udhar?'Ledger Confirmation':'Daily Galla')}</h2><p className="r-caption">{ui(udhar?'This records an unpaid customer due. No money-received greeting plays.':'The payment updates your recorded money movements. This amount-only sale does not deduct item stock.')}</p></section>
      </fieldset>
      {photoUpload.failed&&<button type="button" className="r-btn" onClick={()=>{photoUpload.select(null);draft.clear();navigate('/retail/bills/'+invoice.id+'/print');}}>{ui('Continue without photo')}</button>}
      <div className="r-sticky-footer r-entry-footer"><button type="submit" className="r-btn r-btn--primary r-w-full" disabled={saving||Number(amount)<=0||udhar&&!customer||!udhar&&method==='UPI'&&!invoice&&!upiConfirmed}>{saving?ui("Saving…"):photoUpload.failed?ui("Retry Photo Upload"):udhar?'Save Udhar':'Save Quick Bill'}</button></div>
    </form></div></div>;
}
