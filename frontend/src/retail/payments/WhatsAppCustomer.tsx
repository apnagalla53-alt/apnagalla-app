import { useEffect,useId,useRef,useState } from 'react';
import InvoiceFileActions from '../billing/InvoiceFileActions';
import { MessageCircle,X } from 'lucide-react';
import { posApi } from '../retailApi';
import { useAuthStore } from '../../shared/store/authStore';
import { getApiErrorMessage } from '../../shared/api';
import { nativeDeviceActions,openWhatsAppChat } from '../../shared/deviceActions';
import { receiptMessage,whatsappLink,whatsappNumber } from './whatsapp';

export default function WhatsAppCustomer({billId,phone='',message='',label}:{billId?:string,phone?:string,message?:string,label?:string}){
  const [bill,setBill]=useState<any>(null);
  const shop=useAuthStore(s=>s.tenantContext?.company_name||'My Shop');
  const [open,setOpen]=useState(false),[number,setNumber]=useState(phone||''),[text,setText]=useState(message),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null),title=useId(),phoneId=useId();
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  const prepare=async()=>{
    setOpen(true);setBill(null);setError('');setNumber(phone||'');setText(message);
    if(!billId)return;
    setBusy(true);
    try{const {data}=await posApi.getBillDetail(billId);setNumber(data.party?.is_walkin?'':data.party?.phone||phone||'');setText(receiptMessage(data,shop));setBill(data);}
    catch(e){setError(getApiErrorMessage(e));setText('');}finally{setBusy(false);}
  };
  let url='',validation='';
  if(number)try{url=whatsappLink(number,text);}catch(e){validation=(e as Error).message;}
  return <>
    <button type="button" className="r-btn r-btn--outline r-btn--full" onClick={()=>void prepare()}><MessageCircle size={18}/>{label||(billId?'WhatsApp receipt':'WhatsApp')}</button>
    <dialog ref={dialog} className="r-whatsapp-dialog" aria-labelledby={title} onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)}>
      <div className="r-section-heading"><h2 id={title}>{billId?'Send receipt on WhatsApp':'Open customer WhatsApp'}</h2><button type="button" className="r-btn r-btn--icon" aria-label="Close WhatsApp preview" onClick={()=>setOpen(false)}><X size={20}/></button></div>
      {busy?<p role="status">Loading the saved bill…</p>:<>
        <label htmlFor={phoneId}>Customer WhatsApp number</label><input id={phoneId} className="r-input" type="tel" inputMode="tel" autoComplete="off" maxLength={30} value={number} onChange={e=>{setNumber(e.target.value);setError('');}} placeholder="10-digit mobile or +country code"/>
        <p className="r-caption">Check the recipient before sharing.</p>
        {(error||validation)&&<p role="alert">{error||validation}</p>}
        {text&&<div className="r-whatsapp-preview"><h3>Message preview</h3><pre>{text}</pre></div>}
        {billId&&!text&&<button className="r-btn r-btn--outline" onClick={()=>void prepare()}>Reload receipt</button>}
        {url&&(!billId||text)&&<a className="r-btn r-btn--primary r-btn--full" href={url} target="_blank" rel="noopener noreferrer" onClick={async e=>{if(nativeDeviceActions()){e.preventDefault();try{await openWhatsAppChat(url);}catch{setError('Could not open WhatsApp. Check that WhatsApp or a browser is installed.');}}}}>Open WhatsApp · +{whatsappNumber(number)}</a>}
        <p className="r-caption">Review the message, then tap Send in WhatsApp.</p>
        {bill&&<InvoiceFileActions key={bill.id+':'+bill.paid_amount+':'+bill.outstanding_amount} bill={bill} shop={shop}/>}

      </>}
    </dialog>
  </>;
}
