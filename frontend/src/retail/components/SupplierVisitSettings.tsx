import DateInput from '../../shared/components/DateInput';
import { ui, useUiLanguage } from "../../i18n";
import { MobileSelect } from './MobileControls';
import {useState} from 'react';
import api,{getApiErrorMessage} from '../../shared/api';
export default function SupplierVisitSettings({supplier}:{supplier:any}){
  useUiLanguage();
  const [date,setDate]=useState((supplier?.visit_date||'').slice(0,10)),[cycle,setCycle]=useState(supplier?.visit_cycle||'NONE'),[message,setMessage]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  return <details className="r-card"><summary>Supplier visit schedule</summary><form onSubmit={async e=>{e.preventDefault();setSaving(true);setError('');try{await api.patch('/retail/calendar/suppliers/'+supplier.id,{date,cycle});setMessage('Visit schedule saved in Calendar.');}catch(error){setError(getApiErrorMessage(error));}finally{setSaving(false);}}}><label htmlFor="edit-visit-date">Next visit</label><DateInput id="edit-visit-date" className="r-input" type="date" required value={date} onChange={e=>setDate(e.target.value)} lang="en-GB"/><label htmlFor="edit-visit-cycle">Repeat</label><MobileSelect id="edit-visit-cycle" className="r-select" value={cycle} onChange={e=>setCycle(e.target.value)} presentation="segments"><option value="NONE">{ui("Once")}</option><option value="WEEKLY">{ui("Every week")}</option><option value="MONTHLY">Every month</option></MobileSelect><button className="r-btn r-btn--primary" disabled={saving||!date}>{saving?ui("Saving…"):'Save Visit Schedule'}</button>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</form></details>;
}
