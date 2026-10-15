import { useId, useState, useRef, useEffect } from 'react';
import UnitPicker, { type RetailUnitChoice } from '../components/UnitPicker';
import { useBusinessPreset } from '../experience/useBusinessPreset';
import { useRetailEntitlements } from '../subscription/useRetailEntitlements';
import { useBillStore, type BillLineItem } from '../retailStore';
import { createUuid } from '../../shared/browserCrypto';
import { ui } from '../../i18n';

/** Draft data only. Catalog creation belongs to the successful server bill transaction. */
export default function QuickBillCandidate({ name, existing, onAdded }: { name: string; existing?: BillLineItem; onAdded: () => void }) {
  const touched=useRef(false);
  const id=useId(),preset=useBusinessPreset(),access=useRetailEntitlements();
  const allowed=['PIECE',...['WEIGHT','LENGTH'].filter(mode=>access.isFeatureEffective(mode))];
  const [unit,setUnit]=useState<RetailUnitChoice>(()=>existing?.new_item
    ? {code:existing.new_item.unit_code,name:existing.new_item.unit_name||existing.unit,selling_mode:existing.new_item.selling_mode}
    : preset.unitSuggestions.find(u=>allowed.includes(u.selling_mode))||{code:'PCS',name:'Pieces',selling_mode:'PIECE'});
  useEffect(()=>{if(!existing&&!touched.current)setUnit(preset.unitSuggestions.find(u=>allowed.includes(u.selling_mode))||{code:'PCS',name:'Pieces',selling_mode:'PIECE'});},[preset.key,preset.unitSuggestions.map(u=>u.code).join(','),access.data]);
  const [quantity,setQuantity]=useState(String(existing?.quantity||1)),[price,setPrice]=useState(existing?String(existing.rate):'');
  const candidateName=name.trim(),whole=unit.selling_mode==='PIECE';
  return <section className="r-card xp-stack" aria-label={ui('New bill item')}>
    <h3>{candidateName}</h3>
    <p className="r-caption">{ui('Add it to this bill. It will be saved in your items only when the bill succeeds.')}</p>
    <label htmlFor={id+'-qty'}>{ui('Quantity')}</label>
    <input id={id+'-qty'} className="r-input" type="number" inputMode="decimal" min={whole?1:.000001} step={whole?1:'any'} value={quantity} onChange={e=>setQuantity(e.target.value)}/>
    <UnitPicker id={id+'-unit'} title="Unit" value={unit.code} allowedModes={allowed} onChange={choice=>{touched.current=true;setUnit(choice);}}/>
    <label htmlFor={id+'-price'}>{ui('Selling Price (₹)')}</label>
    <input id={id+'-price'} className="r-input" type="number" inputMode="decimal" min="0" step=".01" value={price} onChange={e=>setPrice(e.target.value)}/>
    <button type="button" className="r-btn r-btn--primary" disabled={!candidateName||price===''||!Number.isFinite(Number(price))||Number(price)<0||!(Number(quantity)>0)||whole&&!Number.isInteger(Number(quantity))}
      onClick={()=>{const clientId=existing?.new_item?.client_id||createUuid();useBillStore.getState().putLine({row_id:existing?.row_id,item_id:'draft:'+clientId,new_item:{client_id:clientId,name:candidateName,unit_code:unit.code,unit_name:unit.name,selling_mode:unit.selling_mode||'PIECE'},name:candidateName,rate:Number(price),quantity:Number(quantity),unit:unit.code,discount_amount:existing?.discount_amount||0,total:0});onAdded();}}>
      {ui(existing?'Save Line':'Add to Bill')}
    </button>
  </section>;
}
