import { useId, useState, useRef, useEffect } from 'react';
import UnitPicker, { type RetailUnitChoice } from '../components/UnitPicker';
import { useBusinessPreset } from '../experience/useBusinessPreset';
import { useRetailEntitlements } from '../subscription/useRetailEntitlements';
import { useBillStore, type BillLineItem } from '../retailStore';
import { createUuid } from '../../shared/browserCrypto';
import { ui } from '../../i18n';
import { itemApi, type RetailItem } from '../retailApi';
import { getApiErrorMessage } from '../../shared/api';
import { BULK_ITEM_NUMBER_MAX } from '../experience/bulkRows';
import { readWorkflowDraft, useWorkflowDraft } from '../experience/workflowDraft';

/** Draft data only. Catalog creation belongs to the successful server bill transaction. */
export default function QuickBillCandidate({ name = '', existing, onAdded, compact = false, onExistingItem }: { name?: string; existing?: BillLineItem; onAdded: () => void; compact?: boolean; onExistingItem?: (item: RetailItem, quantity: number) => void }) {
  const [seed]=useState(()=>compact&&!name?readWorkflowDraft<{name:string;quantity:string;price:string;unit:RetailUnitChoice}>('quick-manual-line'):null);
  const touched=useRef(!!seed);
  const id=useId(),preset=useBusinessPreset(),access=useRetailEntitlements();
  const allowed=['PIECE',...['WEIGHT','LENGTH'].filter(mode=>access.isFeatureEffective(mode))];
  const [unit,setUnit]=useState<RetailUnitChoice>(()=>existing?.new_item
    ? {code:existing.new_item.unit_code,name:existing.new_item.unit_name||existing.unit,selling_mode:existing.new_item.selling_mode}
    : seed?.unit||preset.unitSuggestions.find(u=>allowed.includes(u.selling_mode))||{code:'PCS',name:'Pieces',selling_mode:'PIECE'});
  useEffect(()=>{if(!existing&&!touched.current)setUnit(preset.unitSuggestions.find(u=>allowed.includes(u.selling_mode))||{code:'PCS',name:'Pieces',selling_mode:'PIECE'});},[preset.key,preset.unitSuggestions.map(u=>u.code).join(','),access.data]);
  const [typedName,setTypedName]=useState(seed?.name||name),[matches,setMatches]=useState<RetailItem[]>([]),[lookupBusy,setLookupBusy]=useState(false),[lookupError,setLookupError]=useState(''),[retry,setRetry]=useState(0);
  const [quantity,setQuantity]=useState(seed?.quantity||String(existing?.quantity||1)),[price,setPrice]=useState(seed?.price||(existing?String(existing.rate):''));
  const draft=useWorkflowDraft('quick-manual-line',{name:typedName,quantity,price,unit},compact);
  const candidateName=(compact?typedName:name).trim();
  useEffect(()=>{
    if(!compact||!candidateName){setMatches([]);setLookupBusy(false);setLookupError('');return;}
    let active=true;setLookupBusy(true);setLookupError('');
    const timer=setTimeout(()=>{itemApi.getItems(candidateName).then(response=>{if(active)setMatches(response.data.data);}).catch(error=>{if(active)setLookupError(getApiErrorMessage(error));}).finally(()=>{if(active)setLookupBusy(false);});},200);
    return()=>{active=false;clearTimeout(timer);};
  },[candidateName,compact,retry]);
  const exact=matches.filter(item=>item.name.trim().toLocaleLowerCase()===candidateName.toLocaleLowerCase());
  const matched=exact.length===1?exact[0]:null,whole=(matched?.selling_mode||unit.selling_mode)==='PIECE';
  const matchedUnit=matched?(preset.unitSuggestions.find(choice=>choice.code===matched.unit)?.name||matched.unit):'';
  const priceRef=useRef<HTMLInputElement>(null),submitRef=useRef<HTMLButtonElement>(null);
  const validQuantity=Number.isFinite(Number(quantity))&&Number(quantity)>0&&Number(quantity)<=BULK_ITEM_NUMBER_MAX&&(!whole||Number.isInteger(Number(quantity)));
  const validPrice=price.trim()!==''&&Number.isFinite(Number(price))&&Number(price)>=0&&Number(price)<=BULK_ITEM_NUMBER_MAX;
  const available=(item:RetailItem)=>item.inventory_tracking===false||item.current_stock>0||!!item.is_bundle||item.item_type==='SERVICE';
  const addExisting=(item:RetailItem)=>{if(validQuantity&&available(item)&&onExistingItem){draft.clear();onExistingItem(item,Number(quantity));}};
  return <section className={'r-card xp-stack'+(compact?' r-quick-manual':'')} data-item-editor={compact?undefined:'true'} aria-label={ui('New bill item')}>
    {compact?<><h2>{ui('Quick item')}</h2><label htmlFor={id+'-name'}>{ui('Item Name')}</label><input id={id+'-name'} className="r-input" maxLength={255} value={typedName} placeholder={ui('Type an item name')} autoComplete="off" onChange={e=>{setTypedName(e.target.value);setLookupBusy(!!e.target.value.trim());setMatches([]);}}/></>:<><h3>{candidateName}</h3><p className="r-caption">{ui('Saved in Items when this bill succeeds.')}</p></>}
    {compact&&lookupError&&<p role="alert">{lookupError}<button type="button" className="r-btn" onClick={()=>setRetry(n=>n+1)}>{ui('Try Again')}</button></p>}
    {compact&&!!matches.length&&<div className="r-quick-matches" aria-label={ui('Existing items')}>{matches.slice(0,5).map(item=><button type="button" className="r-sheet-option" key={item.id} disabled={!validQuantity||item.inventory_tracking!==false&&item.current_stock<=0&&!item.is_bundle&&item.item_type!=='SERVICE'} onClick={()=>addExisting(item)}><span>{item.name} · {item.unit}</span><strong>₹{item.selling_price}</strong></button>)}</div>}
    <div className={compact?'r-quick-line-fields':'xp-stack'}><div>
    <label htmlFor={id+'-qty'}>{ui('Quantity')}</label>
    <input id={id+'-qty'} className="r-input" type="number" inputMode="decimal" enterKeyHint={price?'done':'next'} min={whole?1:.000001} step={whole?1:'any'} value={quantity} onChange={e=>setQuantity(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(price)submitRef.current?.click();else priceRef.current?.focus();}}}/>
    </div><div>
    <label htmlFor={id+'-price'}>{ui('Selling Price (₹)')}</label>
    <input ref={priceRef} id={id+'-price'} className="r-input" type="number" inputMode="decimal" enterKeyHint="done" min="0" max={BULK_ITEM_NUMBER_MAX} step=".01" readOnly={!!matched} value={matched?String(matched.selling_price):price} onChange={e=>setPrice(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();submitRef.current?.click();}}}/>
    </div></div>
    {matched?<p className="r-caption">{ui('Unit')}: {ui(matchedUnit)}</p>:<details className="r-quick-unit" open={compact?undefined:true}><summary>{ui('Unit')}: {ui(unit.name)}</summary><UnitPicker id={id+'-unit'} title="Unit" value={unit.code} allowedModes={allowed} onChange={choice=>{touched.current=true;setUnit(choice);}}/></details>}
    <button ref={submitRef} type="button" className="r-btn r-btn--primary" disabled={!candidateName||!validQuantity||!allowed.includes(unit.selling_mode||'PIECE')||(exact.length===0&&!validPrice)||exact.length>1||exact.length===1&&!available(exact[0])||compact&&(lookupBusy||!!lookupError)}
      onClick={()=>{if(exact.length){addExisting(exact[0]);return;}const clientId=existing?.new_item?.client_id||createUuid();useBillStore.getState().putLine({row_id:existing?.row_id,item_id:'draft:'+clientId,new_item:{client_id:clientId,name:candidateName,unit_code:unit.code,unit_name:unit.name,selling_mode:unit.selling_mode||'PIECE'},name:candidateName,rate:Number(price),quantity:Number(quantity),unit:unit.code,discount_amount:existing?.discount_amount||0,total:0});draft.clear();onAdded();}}>
      {ui(existing?'Save Line':exact.length?'Use existing item':compact?'+ Add Item':'Add to Bill')}
    </button>
  </section>;
}
