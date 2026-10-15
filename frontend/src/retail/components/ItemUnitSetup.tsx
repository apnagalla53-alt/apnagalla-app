import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../shared/api';
import { useBusinessPreset } from '../experience/useBusinessPreset';
import UnitPicker, { unitLabel, type RetailUnitChoice } from './UnitPicker';

export default function ItemUnitSetup({item,features,reload}:{item:any;features:string[];reload:()=>Promise<void>}) {
 const preset=useBusinessPreset(),[unit,setUnit]=useState<RetailUnitChoice>(()=>({code:preset.family==='PHARMACY'?'STRIP':preset.family==='HARDWARE'?'ROLL':'BOX',name:preset.family==='PHARMACY'?'Strip':preset.family==='HARDWARE'?'Roll':'Box',selling_mode:'PIECE'}));
 const [factor,setFactor]=useState(''),[packPrice,setPackPrice]=useState(''),[prices,setPrices]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
 const conversions=item.unit_conversions||[],units=[item.primary_unit,...conversions.map((c:any)=>c.from_unit)];
 useEffect(()=>{setPrices(Object.fromEntries(units.map((u:any)=>[u.id,String(u.id===item.primary_unit_id?item.default_sale_rate:conversions.find((c:any)=>c.from_unit_id===u.id)?.selling_price??'')])));},[item]);
 if(item.item_type==='SERVICE'||item.is_bundle)return null;
 const save=async(work:()=>Promise<any>)=>{setBusy(true);setError('');setSaved('');try{await work();await reload();setFactor('');setPackPrice('');setSaved('Units and prices saved. Past bills and conversion factors stay unchanged.');}catch(e){setError(getApiErrorMessage(e));}finally{setBusy(false);}};
 return <section className="r-card xp-stack" id="item-unit-setup"><h2>How do you buy and sell this item?</h2>
  <p>Stock is counted in {unitLabel(item.primary_unit)}. Every pack uses this same stock balance.</p>
  {!!conversions.length&&<><p>Sell by: {units.map((u:any)=>unitLabel(u)).join(' · ')}</p>{conversions.map((c:any)=><p key={c.id}>1 {unitLabel(c.from_unit)} = {Number(c.conversion_factor)} {unitLabel(item.primary_unit)}</p>)}</>}
  {features.includes('MULTI_UNIT')?<><label>How do you buy it?</label><UnitPicker id="setup-purchase-unit" value={unit.code} title="How do you buy it?" allowedModes={['PIECE',...features]} onChange={setUnit}/>
    <label htmlFor="setup-pack-factor">How many {item.primary_unit.name} in 1 {unit.name}?</label><input id="setup-pack-factor" className="r-input" type="number" min=".000001" step="any" value={factor} onChange={e=>setFactor(e.target.value)}/>
    <label htmlFor="setup-pack-price">Selling price per {unit.name} · optional</label><input id="setup-pack-price" className="r-input" type="number" min="0" step=".01" value={packPrice} onChange={e=>setPackPrice(e.target.value)}/>
    <button type="button" className="r-btn r-btn--primary" disabled={busy||!(Number(factor)>0)||unit.code===item.primary_unit.code} onClick={()=>void save(()=>api.post('/retail/items/'+item.id+'/unit-conversions',{unit_code:unit.code,conversion_factor:Number(factor),...(packPrice!==''?{selling_price:Number(packPrice)}:{})}))}>Add Selling / Purchase Unit</button>
    {!!conversions.length&&<fieldset className="r-fieldset"><legend>Selling prices for each unit</legend><p>Set your own pack price. It does not have to equal the single-unit price multiplied by the pack size.</p>{units.map((u:any)=><label key={u.id} htmlFor={'unit-price-'+u.id}>Per {u.name}<input id={'unit-price-'+u.id} className="r-input" type="number" min="0" step=".01" placeholder={u.id===item.primary_unit_id?'0':'Base price × pack size'} value={prices[u.id]??''} onChange={e=>setPrices({...prices,[u.id]:e.target.value})}/></label>)}<button type="button" className="r-btn r-btn--primary" disabled={busy} onClick={()=>void save(()=>api.put('/retail/items/'+item.id+'/unit-prices',{prices:units.filter((u:any)=>prices[u.id]!==''&&prices[u.id]!==undefined).map((u:any)=>({unit_id:u.id,selling_price:Number(prices[u.id])}))}))}>Save Unit Prices</button></fieldset>}
  </>:<p>Your plan does not include multiple selling units. Existing stock and saved documents are kept.</p>}
  {error&&<p role="alert">{error}</p>}{saved&&<p role="status">{saved}</p>}
 </section>;
}
