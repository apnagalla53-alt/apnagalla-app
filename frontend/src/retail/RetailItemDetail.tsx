import StitchHeader from './design/StitchHeader';
import { ui, useUiLanguage } from "../i18n";
import ItemStockDetails from './components/ItemStockDetails';
import ContextualTracking from './components/ContextualTracking';
import {useBusinessPreset} from './experience/useBusinessPreset';
import ItemPhoto from './components/ItemPhoto';
import { MobileSelect } from './components/MobileControls';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Package, SlidersHorizontal, Plus } from 'lucide-react';
import api, { getApiErrorMessage } from '../shared/api';
import RetailItemUnitsVariants from './RetailItemUnitsVariants';
import ItemEditSheet from './components/ItemEditSheet';
import MasterRecordActions from './components/MasterRecordActions';
type Group = { name:string; min_select:number; max_select:number; options:{name:string;price_delta:number}[] };
export default function RetailItemDetail() {
  useUiLanguage();
 const preset=useBusinessPreset(),[otherOptions,setOtherOptions]=useState(false);
 const {id}=useParams(),navigate=useNavigate(),location=useLocation();
 const [editing,setEditing]=useState(false);
 const [item,setItem]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saved,setSaved]=useState(''),[busy,setBusy]=useState(false);
 const [features,setFeatures]=useState<string[]>([]),[search,setSearch]=useState(''),[choices,setChoices]=useState<any[]>([]);
 const [components,setComponents]=useState<{item_id:string;quantity:number;name:string}[]>([]),[groups,setGroups]=useState<Group[]>([]);
 const load=async()=>{setLoading(!item);setError('');try{const [detail,account]=await Promise.all([api.get('/retail/items/'+id+'/options'),api.get('/retail/account')]);setItem(detail.data);setFeatures(account.data.features.filter((f:any)=>f.enabled).map((f:any)=>f.key));setComponents(detail.data.bundle_components.map((c:any)=>({item_id:c.component_item_id,quantity:Number(c.quantity),name:c.component_item.name})));setGroups((detail.data.modifier_groups||[]).map((g:any)=>({name:g.name,min_select:g.min_select,max_select:g.max_select,options:g.options.map((o:any)=>({name:o.name,price_delta:Number(o.price_delta)}))})));}catch(e){setError(getApiErrorMessage(e));}finally{setLoading(false);}};
 useEffect(()=>{void load();},[id]);
 useEffect(()=>{if(item&&location.hash)document.getElementById(location.hash.slice(1))?.scrollIntoView({block:"start"});},[item?.id,location.hash]);
 useEffect(()=>{let active=true;const timer=setTimeout(()=>{api.get('/retail/items',{params:{search,limit:50}}).then(r=>{if(active)setChoices(r.data.filter((i:any)=>i.id!==id&&!i.is_bundle&&!i.has_variants&&!i.track_serial));}).catch(e=>{if(active)setError(getApiErrorMessage(e));});},300);return()=>{active=false;clearTimeout(timer);};},[search,id]);
 const save=async(kind:'bundle'|'modifiers')=>{setBusy(true);setError('');setSaved('');try{await api.put('/retail/items/'+id+'/'+kind,kind==='bundle'?{components:components.map(({item_id,quantity})=>({item_id,quantity}))}:{groups});setSaved(kind==='bundle'?'Bundle contents saved.':'Options saved.');await load();}catch(e){setError(getApiErrorMessage(e));}finally{setBusy(false);}};
 const updateGroup=(index:number,update:Partial<Group>)=>setGroups(groups.map((g,i)=>i===index?{...g,...update}:g));
 return <div className="r-section"><StitchHeader className="r-page-header" hasBack><button className="r-btn r-btn--icon" aria-label="Back to Items" onClick={()=>navigate('/retail/items')}><ArrowLeft size={22}/></button><h1>{item?.name||ui("Item Details")}</h1><span className="r-header-spacer"/></StitchHeader>
 {error&&<div role="alert" className="r-card">{error}<button className="r-btn" onClick={load}>{ui("Try Again")}</button></div>}{saved&&<p role="status" data-tone="success">{saved}</p>}
 {item&&<><MasterRecordActions kind="items" id={item.id} name={item.name} active={item.is_active} onEdit={()=>setEditing(true)} onChanged={()=>void load()}/>{!item.is_active&&<p role="status" data-tone="warning">{ui('Removed. Past records are kept.')}</p>}</>}
 {editing&&id&&<ItemEditSheet id={id} onClose={()=>setEditing(false)} onSaved={()=>{setEditing(false);void load();}}/>}
 {loading?<p role="status">Loading item…</p>:item&&<><div className="r-card r-item-summary">{item.image&&<ItemPhoto id={item.image.id} name={item.name}/>}<div><p>Selling Price: ₹{Number(item.default_sale_rate)}</p><p>{item.item_type==='SERVICE'?'Service. No physical stock.':item.inventory_tracking===false?'Stock not counted. Receive stock through Buy Stock to start counting.':item.is_bundle?'Bundle stock comes from its components.':'Stock: '+item.stock_balance_projection.reduce((s:number,b:any)=>s+Number(b.quantity),0)+' '+item.primary_unit.code}</p><p>SKU: {item.sku}</p>{item.custom_attributes?.description&&<p>{item.custom_attributes.description}</p>}</div></div><button className="r-btn r-btn--primary" disabled={!item.is_active} onClick={()=>navigate('/retail/bill')}>{ui("Make Bill")}</button>
 {item.item_type!=='SERVICE'&&<button className="r-btn r-btn--outline" onClick={()=>navigate('/retail/reports/financial/valuation?item_id='+id)}>View Stock Cost &amp; Valuation</button>}
 <button className="r-btn r-btn--outline" onClick={()=>navigate('/retail/reports/financial/items?item_id='+id)}>View Item Profit</button>
 <ContextualTracking key={item.id} item={item} features={features} reload={load}/><RetailItemUnitsVariants item={item} features={features} reload={load}/><ItemStockDetails item={item}/>
 {item.is_bundle&&<details className="r-card" open><summary><Package size={18}/> Bundle contents</summary><p>Use each component’s base unit. Serial, variant and nested bundle items are billed separately.</p>{features.includes('BUNDLES')?<>
 <label htmlFor="component-search">Find a component</label><input id="component-search" className="r-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by item name or SKU"/>
 <label htmlFor="component-add">Add component</label><MobileSelect id="component-add" className="r-select" value="" onChange={e=>{const found=choices.find(i=>i.id===e.target.value);if(found&&!components.some(c=>c.item_id===found.id))setComponents([...components,{item_id:found.id,quantity:1,name:found.name}]);}}><option value="">Choose an item</option>{choices.map(c=><option key={c.id} value={c.id}>{c.name} · {c.unit}</option>)}</MobileSelect>
 {components.map((c,index)=><div key={c.item_id} className="r-card"><label htmlFor={'component-qty-'+index}>{c.name} · quantity per kit</label><input id={'component-qty-'+index} className="r-input" type="number" min=".000001" step="any" value={c.quantity} onChange={e=>setComponents(components.map((v,i)=>i===index?{...v,quantity:Number(e.target.value)}:v))}/><button className="r-btn" data-tone="danger" aria-label={'Remove '+c.name} onClick={()=>setComponents(components.filter(v=>v.item_id!==c.item_id))}>{ui("Remove")}</button></div>)}
 <button className="r-btn r-btn--primary" disabled={busy||!components.length} onClick={()=>save('bundle')}>Save Bundle Contents</button></>:<p>Your plan does not enable new bundle configuration. Saved records remain available.</p>}</details>}
 {preset.family!=='EATERY'&&!groups.length&&<button className="r-btn r-btn--outline" onClick={()=>setOtherOptions(v=>!v)}>Other item options</button>}
 {(preset.family==='EATERY'||groups.length>0||otherOptions)&&<details className="r-card" id="item-modifier-setup"><summary><SlidersHorizontal size={18}/>{preset.family==='EATERY'?'Any options or add-ons?':'Choices & extras'}</summary><p>Option prices are added per sold unit. Existing invoices keep their original choices and prices.</p>{features.includes('MODIFIERS')?<>
 {groups.map((g,index)=><fieldset key={index} className="r-fieldset"><legend>Option group {index+1}</legend><label htmlFor={'group-name-'+index}>Group name</label><input id={'group-name-'+index} className="r-input" maxLength={100} value={g.name} onChange={e=>updateGroup(index,{name:e.target.value})}/><div className="r-form-grid">{(['min_select','max_select'] as const).map(key=><div key={key}><label htmlFor={key+index}>{key==='min_select'?'Minimum choices':'Maximum choices'}</label><input id={key+index} className="r-input" type="number" min="0" max="20" value={g[key]} onChange={e=>updateGroup(index,{[key]:Number(e.target.value)})}/></div>)}</div>
 {g.options.map((o,j)=><div key={j} className="r-card"><label htmlFor={`option-name-${index}-${j}`}>Option name</label><input id={`option-name-${index}-${j}`} className="r-input" maxLength={100} value={o.name} onChange={e=>updateGroup(index,{options:g.options.map((v,k)=>k===j?{...v,name:e.target.value}:v)})}/><label htmlFor={`option-price-${index}-${j}`}>Price adjustment per unit (₹)</label><input id={`option-price-${index}-${j}`} className="r-input" type="number" step=".01" value={o.price_delta} onChange={e=>updateGroup(index,{options:g.options.map((v,k)=>k===j?{...v,price_delta:Number(e.target.value)}:v)})}/><button className="r-btn" data-tone="danger" onClick={()=>updateGroup(index,{options:g.options.filter((_,k)=>k!==j)})}>Remove Option</button></div>)}
 <button className="r-btn" disabled={g.options.length>=20} onClick={()=>updateGroup(index,{options:[...g.options,{name:'',price_delta:0}]})}><Plus size={18}/> Add Option</button><button className="r-btn" data-tone="danger" onClick={()=>setGroups(groups.filter((_,i)=>i!==index))}>Remove Group</button></fieldset>)}
 <button className="r-btn" disabled={groups.length>=10} onClick={()=>setGroups([...groups,{name:'',min_select:0,max_select:1,options:[{name:'',price_delta:0}]}])}><Plus size={18}/> Add Option Group</button><button className="r-btn r-btn--primary" disabled={busy} onClick={()=>save('modifiers')}>Save Options</button></>:<p>Your plan does not enable new modifiers. Saved records remain available.</p>}</details>}</>}
 </div>;
}
