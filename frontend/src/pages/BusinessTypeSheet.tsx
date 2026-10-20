import { useMemo, useState } from 'react';
import { Store, Check, Search, X, ArrowLeft } from 'lucide-react';
import { Sheet } from '../retail/components/MobileControls';
export type BusinessType={code:string;name:string;icon:string;group:string;keywords:string[];suggested_features:string[]};
const normalize=(text:string)=>text.normalize('NFKC').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu,' ');

export default function BusinessTypeSheet({types,value,additional=[],onSelect,onClose}:{types:BusinessType[];value:string;additional?:string[];onSelect:(value:string,additional:string[])=>void;onClose:()=>void}) {
 const [search,setSearch]=useState(''),[selected,setSelected]=useState<string[]>([...new Set([value,...additional].filter(Boolean))]);
 const [primary,setPrimary]=useState(value),[choosingPrimary,setChoosingPrimary]=useState(false);
 const filtered=useMemo(()=>{const query=normalize(search);return types.filter(type=>query.split(' ').every(word=>normalize(type.name+' '+type.keywords.join(' ')).includes(word)));},[types,search]);
 const groups=[...new Set(filtered.map(type=>type.group))];
 const toggle=(code:string)=>{const next=selected.includes(code)?selected.filter(key=>key!==code):[...selected,code];setSelected(next);setPrimary(next.length===1?next[0]:next.includes(primary)?primary:'');};
 function finish(){const main=selected.length===1?selected[0]:primary;if(main){onSelect(main,selected.filter(code=>code!==main));onClose();}}
 return <div className="onboarding-type-sheet"><Sheet open title={choosingPrimary?'Which one is your main business?':'What do you sell or do?'} titleIcon={<Store size={22}/>} onClose={onClose}>
  <p>{choosingPrimary?"We'll use this to personalise your main experience.":'Select everything that applies to your business.'}</p>
  {choosingPrimary?<div className="ob-type-results" role="radiogroup" aria-label="Primary Business Type">
   {types.filter(type=>selected.includes(type.code)).map(type=><button type="button" key={type.code} role="radio" aria-checked={primary===type.code} onClick={()=>setPrimary(type.code)}><span>{type.name}</span>{primary===type.code&&<Check size={22} aria-hidden="true"/>}</button>)}
   <button type="button" onClick={()=>setChoosingPrimary(false)}><ArrowLeft size={18}/>Change selected activities</button>
  </div>:<>
   <div className="ob-type-search"><Search size={22} aria-hidden="true"/><input autoFocus type="search" value={search} onChange={event=>setSearch(event.target.value)} aria-label="Search business types" placeholder="Search business types..."/>{search&&<button type="button" aria-label="Clear business type search" onClick={()=>setSearch('')}><X size={20}/></button>}</div>
   <div className="ob-type-results" role="group" aria-label="Business activities">
    {groups.map(group=><section key={group}><h3>{group}</h3>{filtered.filter(type=>type.group===group).map(type=><button type="button" key={type.code} role="checkbox" aria-checked={selected.includes(type.code)} disabled={!selected.includes(type.code)&&selected.length>=13} onClick={()=>toggle(type.code)}><span>{type.name}</span>{selected.includes(type.code)&&<Check size={22} aria-hidden="true"/>}</button>)}</section>)}
    {!filtered.length&&<div className="ob-search-empty"><p>No matching business types. Try another word or choose Other.</p><button type="button" onClick={()=>toggle('OTHER')}>Choose Other</button></div>}
   </div>
  </>}
  <div className="ob-business-selection-action"><span>{selected.length} selected</span><button type="button" className="r-btn r-btn--primary" disabled={!selected.length||choosingPrimary&&!primary} onClick={()=>{if(selected.length>1&&!choosingPrimary){setChoosingPrimary(true);if(value==='')setPrimary('');}else finish();}}>{choosingPrimary?'Use these activities':selected.length>1?'Choose main business':'Use this business'}</button></div>
 </Sheet></div>;
}
