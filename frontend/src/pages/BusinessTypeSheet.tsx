import { useMemo,useState } from 'react';
import { ShoppingBasket, Store, ShoppingCart, Carrot, Milk, Fish, Pill, CakeSlice, Coffee, Leaf, NotebookPen, Smartphone, Wrench, Shirt, Footprints, Sparkles, Scissors, Glasses, Bike, Bath, CookingPot, PanelsTopLeft, Laptop, Shapes,Check,Search,X } from 'lucide-react';
import { Sheet } from '../retail/components/MobileControls';
export type BusinessType={code:string;name:string;icon:string;group:string;keywords:string[];suggested_features:string[]};
const icons:Record<string,typeof Store>={ShoppingBasket,Store,ShoppingCart,Carrot,Milk,Fish,Pill,CakeSlice,Coffee,Leaf,NotebookPen,Smartphone,Wrench,Shirt,Footprints,Sparkles,Scissors,Glasses,Bike,Bath,CookingPot,PanelsTopLeft,Laptop,Shapes};
const normalize=(text:string)=>text.normalize('NFKC').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu,' ');
export default function BusinessTypeSheet({types,value,onSelect,onClose}:{types:BusinessType[];value:string;onSelect:(value:string)=>void;onClose:()=>void}){
 const [search,setSearch]=useState('');
 const filtered=useMemo(()=>{const query=normalize(search);return types.filter(type=>query.split(' ').every(word=>normalize(type.name+' '+type.keywords.join(' ')).includes(word)));},[types,search]);
 const groups=[...new Set(filtered.map(type=>type.group))];
 return <div className="onboarding-type-sheet"><Sheet open title="Select business type" titleIcon={<Store size={22}/>} onClose={onClose}>
  <div className="ob-type-search"><Search size={22} aria-hidden="true"/><input autoFocus type="search" value={search} onChange={event=>setSearch(event.target.value)} aria-label="Search business types" placeholder="Search business types..."/>{search&&<button type="button" aria-label="Clear business type search" onClick={()=>setSearch('')}><X size={20}/></button>}</div>
  <div className="ob-type-results" role="group" aria-label="Business categories">
   {groups.map(group=><section key={group}><h3>{group}</h3>{filtered.filter(type=>type.group===group).map(type=>{const Icon=icons[type.icon]||Store;return <button type="button" key={type.code} aria-pressed={type.code===value} onClick={()=>{onSelect(type.code);onClose();}}><span className="ob-type-icon"><Icon size={23}/></span><span>{type.name}</span>{type.code===value&&<Check size={22} aria-hidden="true"/>}</button>;})}</section>)}
   {!filtered.length&&<div className="ob-search-empty"><Search size={32}/><h3>No matching business types</h3><p>Try another word, or choose Other and describe your business.</p><button type="button" onClick={()=>{onSelect('OTHER');onClose();}}>Choose Other</button></div>}
  </div>
 </Sheet></div>;
}
