import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../shared/api';
import { useBusinessPreset } from '../experience/useBusinessPreset';
import { ui } from '../../i18n';

export default function ContextualVariants({item,features,reload}:{item:any;features:string[];reload:()=>Promise<void>}) {
  const preset=useBusinessPreset(),footwear=preset.family==='FOOTWEAR';
  const existingSizes=[...new Set<string>((item.variants||[]).map((v:any)=>v.attributes.Size).filter(Boolean))].join(', '),existingColours=[...new Set<string>((item.variants||[]).map((v:any)=>v.attributes.Colour).filter(Boolean))].join(', ');
  const [yes,setYes]=useState(!!item.has_variants),[sizes,setSizes]=useState(existingSizes||(footwear?'':'S, M, L, XL, XXL')),[colours,setColours]=useState(existingColours||(item.has_variants||footwear?'':'Black, White, Blue'));
  const [different,setDifferent]=useState((item.variants||[]).some((v:any)=>v.default_sale_rate!==null&&v.default_sale_rate!==undefined&&Number(v.default_sale_rate)!==Number(item.default_sale_rate))),[prices,setPrices]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const priceKey=(attributes:object)=>JSON.stringify(Object.entries(attributes).sort(([a],[b])=>a.localeCompare(b)));
  useEffect(()=>{setPrices(Object.fromEntries((item.variants||[]).filter((v:any)=>v.default_sale_rate!==null&&v.default_sale_rate!==undefined).map((v:any)=>[priceKey(v.attributes),String(v.default_sale_rate)])));},[item]);
  if(!['CLOTHING','FOOTWEAR'].includes(preset.family))return null;
  const values=(text:string)=>[...new Set(text.split(',').map(s=>s.trim()).filter(Boolean))];
  const combos=values(sizes).flatMap(Size=>(values(colours).length?values(colours):['']).map(Colour=>({Size,...(Colour?{Colour}:{})})));
  return <section className="r-card xp-stack" id="item-size-setup">
    <h2>{ui(footwear?'Does this item have different sizes?':'Does this item have different sizes or colours?')}</h2>
    <div className="r-form-grid"><button className="r-btn r-btn--outline" type="button" aria-pressed={!yes} onClick={()=>setYes(false)}>No</button><button type="button" className="r-btn r-btn--outline" aria-pressed={yes} disabled={!features.includes('VARIANTS')} onClick={()=>setYes(true)}>Yes</button></div>
    {!features.includes('VARIANTS')&&<p className="r-caption">Sizes and colours require a plan with this feature.</p>}
    {yes&&features.includes('VARIANTS')&&<><p className="r-caption">{footwear?'Use your own shoe-size system. Enter sizes separated by commas.':'Choose sizes and colours below. You can type your own values.'}</p>
      <label htmlFor="context-sizes">Sizes</label><input id="context-sizes" className="r-input" maxLength={500} value={sizes} onChange={e=>setSizes(e.target.value)} placeholder={footwear?'e.g. UK 6, UK 7, UK 8':'S, M, L, XL, XXL'}/>
      <label htmlFor="context-colours">Colours · optional</label><input id="context-colours" className="r-input" maxLength={500} value={colours} onChange={e=>setColours(e.target.value)} placeholder="Black, White, Blue"/>
      <label className="r-toggle-row"><input type="checkbox" checked={different} onChange={e=>setDifferent(e.target.checked)}/>Different price for some sizes or colours</label>
      {!different&&<p>{item.variants?.length?'New sizes use the item price; saved size prices are kept':'Same price for all'} · ₹{Number(item.default_sale_rate)}</p>}
      {different&&combos.slice(0,100).map(attributes=>{const key=priceKey(attributes);return <label key={key}>{Object.values(attributes).join(' / ')}<input className="r-input" type="number" min="0" step=".01" placeholder={String(item.default_sale_rate)} value={prices[key]??''} onChange={e=>setPrices({...prices,[key]:e.target.value})} inputMode="decimal"/></label>;})}
      <p>{combos.length} combinations. Existing sizes are kept. Prices change only where you enter a price.</p>
      {error&&<p role="alert">{error}</p>}
      <button type="button" className="r-btn r-btn--primary" disabled={busy||!combos.length||combos.length>100} onClick={async()=>{setBusy(true);setError('');try{await api.post('/retail/items/'+item.id+'/variants/setup',{variants:combos.map(attributes=>({attributes,...(different&&prices[priceKey(attributes)]!==undefined&&prices[priceKey(attributes)]!==''?{default_sale_rate:Number(prices[priceKey(attributes)])}:{})}))});await reload();}catch(e){setError(getApiErrorMessage(e));}finally{setBusy(false);}}}>{busy?'Saving…':'Save Sizes & Colours'}</button>
      {item.variants?.length>0&&<p role="status">{item.variants.length} sizes/colours saved. Receive stock for each size through Buy Stock.</p>}
    </>}
  </section>;
}
