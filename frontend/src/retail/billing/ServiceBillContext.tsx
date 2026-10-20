import { useBusinessPreset } from '../experience/useBusinessPreset';
import { useBillStore } from '../retailStore';

/** Optional bill note, never a vehicle register or separate transaction. */
export default function ServiceBillContext({onServiceName}:{onServiceName:(name:string)=>void}) {
 const preset=useBusinessPreset(),note=useBillStore(s=>s.details.note);
 const vehicle=note.split('\n').find(line=>line.startsWith('Vehicle: '))?.slice(9)||'';
 return <section className="r-section"><div className="r-card xp-stack">
  <p className="r-caption">Service charges + spare parts in one bill</p>
  <label htmlFor="service-vehicle">Vehicle / Bike Number · optional</label><input id="service-vehicle" className="r-input" maxLength={40} value={vehicle} onChange={e=>{
   const value=e.target.value;const stripped=note.split('\n').filter(line=>!line.startsWith('Vehicle: ')).join('\n');
   useBillStore.getState().setDetails({note:[value.trim()?'Vehicle: '+value:'',stripped].filter(Boolean).join('\n').slice(0,4000)});
  }}/>
  <div className="r-footwear-chips" aria-label="Service suggestions">{preset.serviceSuggestions?.map(name=><button type="button" className="r-btn r-btn--outline" key={name} onClick={()=>onServiceName(name)}>{name}</button>)}</div>
 </div></section>;
}
