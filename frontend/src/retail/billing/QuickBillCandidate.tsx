import { useId, useState, useRef, useEffect } from 'react';
import UnitPicker, { type RetailUnitChoice } from '../components/UnitPicker';
import { useBusinessPreset } from '../experience/useBusinessPreset';
import { useRetailEntitlements } from '../subscription/useRetailEntitlements';
import { useBillStore, type BillLineItem } from '../retailStore';
import { createUuid } from '../../shared/browserCrypto';
import { useAuthStore } from '../../shared/store/authStore';
import { useStableGestureUpdates } from '../components/useStableGestureUpdates';

import { ui } from '../../i18n';
import { itemApi, type RetailItem } from '../retailApi';
import { getApiErrorMessage } from '../../shared/api';
import { BULK_ITEM_NUMBER_MAX } from '../experience/bulkRows';
import { readWorkflowDraft, useWorkflowDraft } from '../experience/workflowDraft';

const lookupScope=()=>{const s=useAuthStore.getState();return [s.authEpoch,s.user?.id,s.tenantContext?.company_id,s.tenantContext?.branch_id,s.tenantContext?.financial_year_id].join(':');};

/** Draft data only. Catalog creation belongs to the successful server bill transaction. */
export default function QuickBillCandidate({ name = '', existing, onAdded, compact = false, onExistingItem, purpose = 'ITEM' }: { purpose?:'ITEM'|'SERVICE'|'PART'; name?: string; existing?: BillLineItem; onAdded: () => void; compact?: boolean; onExistingItem?: (item: RetailItem, quantity: number) => void }) {
  const [seed]=useState(()=>compact&&!name?readWorkflowDraft<{name:string;quantity:string;price:string;unit:RetailUnitChoice;gst?:string}>('quick-manual-line:'+purpose):null);
  const touched=useRef(!!seed);
  const id=useId(),preset=useBusinessPreset(),access=useRetailEntitlements();
  const allowed=purpose==='SERVICE'?['PIECE']:['PIECE',...['WEIGHT','LENGTH'].filter(mode=>access.isFeatureEffective(mode))];
  const [unit,setUnit]=useState<RetailUnitChoice>(()=>existing?.new_item
    ? {code:existing.new_item.unit_code,name:existing.new_item.unit_name||existing.unit,selling_mode:existing.new_item.selling_mode}
    : seed?.unit||(purpose==='SERVICE'?{code:'JOB',name:'Job',selling_mode:'PIECE'}:undefined)||preset.unitSuggestions.find(u=>allowed.includes(u.selling_mode))||{code:'PCS',name:'Pieces',selling_mode:'PIECE'});
  useEffect(()=>{if(!existing&&!touched.current)setUnit((purpose==='SERVICE'?{code:'JOB',name:'Job',selling_mode:'PIECE'}:undefined)||preset.unitSuggestions.find(u=>allowed.includes(u.selling_mode))||{code:'PCS',name:'Pieces',selling_mode:'PIECE'});},[preset.key,preset.unitSuggestions.map(u=>u.code).join(','),access.data]);
  const [typedName,setTypedName]=useState(seed?.name||name),[matches,setMatches]=useState<RetailItem[]>([]),[lookupBusy,setLookupBusy]=useState(false),[lookupError,setLookupError]=useState(''),[retry,setRetry]=useState(0);
  const gstTouched=useRef(!!existing);
  const [gst,setGst]=useState(String(existing?.gst_rate??existing?.tax_rate??seed?.gst??0));
  const [quantity,setQuantity]=useState(seed?.quantity||String(existing?.quantity||1)),[price,setPrice]=useState(seed?.price||(existing?String(existing.rate):''));
  const draft=useWorkflowDraft('quick-manual-line:'+purpose,{name:typedName,quantity,price,unit,gst},compact);
  const candidateName=(compact?typedName:name).trim();
  const scope=useAuthStore(s=>[s.authEpoch,s.user?.id,s.tenantContext?.company_id,s.tenantContext?.branch_id,s.tenantContext?.financial_year_id].join(':'));
  const [submitting,setSubmitting]=useState(false);
  const gesture=useStableGestureUpdates();
  const adding=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const request=useRef<{name:string;scope:string;purpose:string;promise:Promise<RetailItem[]>}|null>(null);
  const findItems=(value:string)=>{
    if(request.current?.name===value&&request.current.scope===scope&&request.current.purpose===purpose)return request.current.promise;
    const promise=itemApi.getItems(value,0,undefined,false,purpose==='ITEM'?undefined:purpose).then(response=>response.data.data);
    request.current={name:value,scope,purpose,promise};
    void promise.catch(()=>{if(request.current?.promise===promise)request.current=null;});
    return promise;
  };
  useEffect(()=>{
    if(!compact||!candidateName){setMatches([]);setLookupBusy(false);setLookupError('');return;}
    let active=true;setMatches([]);setLookupBusy(true);setLookupError('');
    const timer=setTimeout(()=>{findItems(candidateName).then(rows=>gesture.update(()=>{if(active)setMatches(rows);})).catch(error=>gesture.update(()=>{if(active)setLookupError(getApiErrorMessage(error));})).finally(()=>{if(active)setLookupBusy(false);});},200);
    return()=>{active=false;clearTimeout(timer);};
  },[candidateName,compact,retry,purpose,scope]);
  const exact=matches.filter(item=>item.name.trim().toLocaleLowerCase()===candidateName.toLocaleLowerCase());
  const matched=exact.length===1?exact[0]:null,whole=purpose!=='SERVICE'&&matched?.item_type!=='SERVICE'&&(matched?.selling_mode||unit.selling_mode)==='PIECE';
  const matchedUnit=matched?(preset.unitSuggestions.find(choice=>choice.code===matched.unit)?.name||matched.unit):'';
  const priceRef=useRef<HTMLInputElement>(null),submitRef=useRef<HTMLButtonElement>(null);
  const validQuantity=Number.isFinite(Number(quantity))&&Number(quantity)>0&&Number(quantity)<=BULK_ITEM_NUMBER_MAX&&(!whole||Number.isInteger(Number(quantity)));
  const validPrice=price.trim()!==''&&Number.isFinite(Number(price))&&Number(price)>=0&&Number(price)<=BULK_ITEM_NUMBER_MAX;
  const available=(item:RetailItem)=>item.inventory_tracking===false||item.current_stock>0||!!item.is_bundle||item.item_type==='SERVICE';
  const addExisting=(item:RetailItem)=>{if(validQuantity&&(!(item.selling_mode==='PIECE'&&item.item_type!=='SERVICE')||Number.isInteger(Number(quantity)))&&available(item)&&onExistingItem){draft.clear();onExistingItem({...item,tax_rate:gstTouched.current?Number(gst):item.tax_rate||0,gst_rate:gstTouched.current?Number(gst):item.tax_rate||0},Number(quantity));}};
  return <section className={'r-card xp-stack'+(compact?' r-quick-manual':'')} data-item-editor={compact?undefined:'true'} aria-label={ui('New bill item')} aria-busy={lookupBusy||submitting} onPointerDownCapture={event=>gesture.start(event.pointerId)}>
    {compact?<><h2>{ui(purpose==='SERVICE'?'Service / Labour':purpose==='PART'?'Spare Parts':'Quick item')}</h2><label htmlFor={id+'-name'}>{ui(purpose==='SERVICE'?'Service Name':purpose==='PART'?'Part Name':'Item Name')}</label><input disabled={submitting} id={id+'-name'} className="r-input" maxLength={255} value={typedName} placeholder={ui(purpose==='SERVICE'?'Type or find a service':purpose==='PART'?'Search or type a part name':'Type an item name')} autoComplete="off" onChange={e=>{setTypedName(e.target.value);setLookupBusy(!!e.target.value.trim());setMatches([]);}}/></>:<><h3>{candidateName}</h3><p className="r-caption">{ui('Saved in Items when this bill succeeds.')}</p></>}
    {compact&&lookupError&&<p role="alert">{lookupError}<button type="button" className="r-btn" disabled={submitting} onClick={()=>setRetry(n=>n+1)}>{ui('Try Again')}</button></p>}
    {compact&&!!matches.length&&<div className="r-quick-matches" aria-label={ui('Existing items')}>{matches.slice(0,5).map(item=><button type="button" className="r-sheet-option" key={item.id} disabled={submitting||!validQuantity||item.inventory_tracking!==false&&item.current_stock<=0&&!item.is_bundle&&item.item_type!=='SERVICE'} onClick={()=>addExisting(item)}><span>{item.name} · {item.unit}</span><strong>₹{item.selling_price}</strong></button>)}</div>}
    <div className={compact?'r-quick-line-fields':'xp-stack'}><div>
    <label htmlFor={id+'-qty'}>{ui('Quantity')}</label>
    <input disabled={submitting} id={id+'-qty'} className="r-input" type="number" inputMode="decimal" enterKeyHint={price?'done':'next'} min={whole?1:.000001} step={whole?1:'any'} value={quantity} onChange={e=>setQuantity(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(price)submitRef.current?.click();else priceRef.current?.focus();}}}/>
    </div><div>
    <label htmlFor={id+'-price'}>{ui('Selling Price (₹)')}</label>
    <input disabled={submitting} ref={priceRef} id={id+'-price'} className="r-input" type="number" inputMode="decimal" enterKeyHint="done" min="0" max={BULK_ITEM_NUMBER_MAX} step=".01" readOnly={!!matched} value={matched?String(matched.selling_price):price} onChange={e=>setPrice(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();submitRef.current?.click();}}}/>
    </div></div>
    <div className="r-quick-line-fields"><div><label htmlFor={id+'-unit'}>Unit</label>{matched?<input disabled={submitting} id={id+'-unit'} className="r-input" value={matchedUnit} readOnly/>:<UnitPicker disabled={submitting} dropdown id={id+'-unit'} title="Unit" value={unit.code} allowedModes={allowed} onChange={choice=>{touched.current=true;setUnit(choice);}}/>}</div><div><label htmlFor={id+'-gst'}>GST %</label><input disabled={submitting} id={id+'-gst'} className="r-input" type="number" inputMode="decimal" min="0" max="100" step=".01" value={matched&&!gstTouched.current?String(matched.tax_rate||0):gst} onChange={e=>{gstTouched.current=true;setGst(e.target.value);}}/></div></div>
    <button ref={submitRef} type="button" className="r-btn r-btn--primary" disabled={!Number.isFinite(Number(gst))||Number(gst)<0||Number(gst)>100||!candidateName||!validQuantity||!allowed.includes(unit.selling_mode||'PIECE')||(exact.length===0&&!validPrice)||exact.length>1||exact.length===1&&!available(exact[0])||compact&&!!lookupError||submitting}
      onClick={async()=>{
        if(adding.current)return;
        adding.current=true;setSubmitting(true);setLookupError('');
        try {
          // A first tap starts any outstanding debounce now and shares an in-flight search.
          const rows=compact?await findItems(candidateName):[];
          if(!mounted.current||lookupScope()!==scope)return;
          setMatches(rows);setLookupBusy(false);
          const selected=rows.filter(item=>item.name.trim().toLocaleLowerCase()===candidateName.toLocaleLowerCase());
          if(selected.length>1){setLookupError('Choose the matching item from the list above.');return;}
          if(selected.length){addExisting(selected[0]);return;}
          if(!validPrice)return;
          const pending=!existing&&useBillStore.getState().items.find(line=>line.new_item&&line.new_item.name.trim().toLocaleLowerCase()===candidateName.toLocaleLowerCase()&&(line.new_item.item_type||'STOCK_ITEM')===(purpose==='SERVICE'?'SERVICE':'STOCK_ITEM')&&line.new_item.unit_code===unit.code&&line.rate===Number(price)&&(line.gst_rate||0)===Number(gst));if(pending){useBillStore.getState().putLine({...pending,quantity:pending.quantity+Number(quantity)});draft.clear();onAdded();return;}const clientId=existing?.new_item?.client_id||createUuid();useBillStore.getState().putLine({gst_rate:Number(gst),tax_rate:Number(gst),row_id:existing?.row_id,item_id:'draft:'+clientId,item_type:purpose==='SERVICE'?'SERVICE':'STOCK_ITEM',new_item:{item_type:purpose==='SERVICE'?'SERVICE':'STOCK_ITEM',client_id:clientId,name:candidateName,unit_code:unit.code,unit_name:unit.name,selling_mode:unit.selling_mode||'PIECE'},name:candidateName,rate:Number(price),quantity:Number(quantity),unit:unit.code,discount_amount:existing?.discount_amount||0,total:0});draft.clear();onAdded();
        }catch(error){if(mounted.current){setLookupError(getApiErrorMessage(error));setLookupBusy(false);}}
        finally{adding.current=false;if(mounted.current)setSubmitting(false);}
      }}>
      {submitting?ui('Checking item…'):ui(existing?'Save Line':exact.length?'Use existing item':compact?purpose==='SERVICE'?'+ Add Service':purpose==='PART'?'+ Add Part':'+ Add Item':'Add to Bill')}
    </button>
  </section>;
}
