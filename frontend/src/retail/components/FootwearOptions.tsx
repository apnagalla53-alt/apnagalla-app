import { useState } from 'react';
import { ui } from '../../i18n';
import './footwear-options.css';
import {footwearCombinations,variantOptionKey,type FootwearOptionsValue} from './footwearOptionsModel';

export default function FootwearOptions({value,onChange,enabled,price}:{value:FootwearOptionsValue;onChange:(value:FootwearOptionsValue)=>void;enabled:boolean;price:string}) {
 const [customSize,setCustomSize]=useState(''),[customColour,setCustomColour]=useState('');
 const update=(patch:Partial<FootwearOptionsValue>)=>onChange({...value,...patch});
 const chips=(kind:'sizes'|'colours',suggestions:string[],custom:string,setCustom:(s:string)=>void)=>{
  const options=[...new Set([...suggestions,...value[kind]])];
  return <div className="r-footwear-options"><div className="r-footwear-chips">{options.map(option=><button type="button" className="r-btn r-btn--outline" key={option} aria-pressed={value[kind].includes(option)} onClick={()=>update({[kind]:value[kind].includes(option)?value[kind].filter(s=>s!==option):[...value[kind],option]})}>{option}</button>)}</div>
   <div className="r-footwear-custom"><input className="r-input" aria-label={kind==='sizes'?'Custom Size':'Custom Colour'} maxLength={50} placeholder={kind==='sizes'?'e.g. UK 8, EU 42 or Kids 3':'Your colour'} value={custom} onChange={e=>setCustom(e.target.value)}/><button type="button" className="r-btn r-btn--outline" disabled={!custom.trim()||value[kind].length>=25} onClick={()=>{update({[kind]:[...new Set([...value[kind],custom.trim()])]});setCustom('');}}>+ {kind==='sizes'?'Add Size':'Add Colour'}</button></div>
  </div>;
 };
 const combos=footwearCombinations(value);
 return <section className="r-card xp-stack r-footwear-setup" aria-label="Sizes and colours">
  <p id="footwear-sizes-question">{ui('Does this item have different sizes?')}</p><div className="r-form-grid" role="group" aria-labelledby="footwear-sizes-question">{[false,true].map(yes=><button key={String(yes)} type="button" className="r-btn r-btn--outline" disabled={yes&&!enabled} aria-pressed={value.hasSizes===yes} onClick={()=>update({hasSizes:yes})}>{ui(yes?'Yes':'No')}</button>)}</div>
  {value.hasSizes&&enabled&&chips('sizes',['6','7','8','9','10','11'],customSize,setCustomSize)}
  <p id="footwear-colours-question">{ui('Different colours?')}</p><div className="r-form-grid" role="group" aria-labelledby="footwear-colours-question">{[false,true].map(yes=><button key={String(yes)} type="button" className="r-btn r-btn--outline" disabled={yes&&!enabled} aria-pressed={value.hasColours===yes} onClick={()=>update({hasColours:yes})}>{ui(yes?'Yes':'No')}</button>)}</div>
  {value.hasColours&&enabled&&chips('colours',['Black','White','Brown','Blue'],customColour,setCustomColour)}
  {!enabled&&<p className="r-caption">{ui('Sizes and colours require a plan with this feature.')}</p>}
  {enabled&&(value.hasSizes||value.hasColours)&&<><p className="r-caption">Same selling price for all sizes/colours · ₹{price||'0'}. Receive stock for each combination through Buy Stock.</p>
   <details><summary>Set different price (optional)</summary><label className="r-toggle-row"><input type="checkbox" checked={value.different} onChange={e=>update({different:e.target.checked})}/>Different prices for selected combinations</label>{value.different&&combos.slice(0,100).map(attributes=><label key={variantOptionKey(attributes)}>{Object.values(attributes).join(' / ')}<input className="r-input" type="number" min="0" step=".01" placeholder={price} value={value.prices[variantOptionKey(attributes)]||''} onChange={e=>update({prices:{...value.prices,[variantOptionKey(attributes)]:e.target.value}})}/></label>)}</details>
   {combos.length>100&&<p role="alert">Use up to 100 size/colour combinations.</p>}
  </>}
 </section>;
}
