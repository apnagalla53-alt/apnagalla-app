import { useState } from 'react';
import api, { getApiErrorMessage } from '../../shared/api';
import { useBusinessPreset } from '../experience/useBusinessPreset';

export default function ContextualTracking({item,features,reload}:{item:any;features:string[];reload:()=>Promise<void>}) {
 const preset=useBusinessPreset(),serial=preset.family==='ELECTRONICS',pharmacy=preset.family==='PHARMACY';
 const [enabled,setEnabled]=useState(serial?item.track_serial:item.track_batch),[days,setDays]=useState(String(item.warranty_days||0)),[model,setModel]=useState(item.custom_attributes?.model||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!serial&&!pharmacy)return null;
 const entitled=features.includes(serial?'SERIAL_TRACKING':'BATCH_TRACKING');
 return <section className="r-card xp-stack" id="item-context-tracking"><h2>{serial?'Track serial numbers and warranty?':'Track Batch & Expiry?'}</h2>
  <label className="r-toggle-row"><input type="checkbox" disabled={!entitled||busy} checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Yes</label>
  {!entitled&&<p>Your plan does not include this feature. You can keep billing simple items.</p>}
  {serial&&<><label htmlFor="item-model">Model · optional</label><input id="item-model" className="r-input" maxLength={150} value={model} onChange={e=>setModel(e.target.value)}/>{enabled&&<><label htmlFor="context-warranty">Warranty in days</label><input id="context-warranty" className="r-input" type="number" min="0" max="36500" value={days} onChange={e=>setDays(e.target.value)}/></>}</>}
  {error&&<p role="alert">{error}</p>}
  {entitled&&<button type="button" className="r-btn r-btn--primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api.post('/retail/items/'+item.id,{...(serial?{track_serial:enabled,warranty_days:Number(days),custom_attributes:{...(item.custom_attributes||{}),model:model.trim()}}:{track_batch:enabled}),...(enabled?{inventory_tracking:true}:{})});await reload();}catch(e){setError(getApiErrorMessage(e));}finally{setBusy(false);}}}>Save {serial?'Serial & Warranty':'Batch & Expiry'} Settings</button>}
 </section>;
}
