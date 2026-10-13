import type { BillLineItem } from '../retailStore';
type Line = Pick<BillLineItem,'quantity'|'unit_id'|'variant_id'|'batch_id'|'dimensions'>;
export function baseQuantity(item:any,line:Line) {
  const factor=line.unit_id&&line.unit_id!==item.primary_unit_id?Number(item.unit_conversions?.find((c:any)=>c.from_unit_id===line.unit_id)?.conversion_factor||1):1;
  return Number(line.quantity)*factor*(line.dimensions?Number(line.dimensions.length)*Number(line.dimensions.width||1)*Number(line.dimensions.height||1):1);
}
export function stockWarning(item:any,line:Line,otherLines:Line[]=[]):string|null {
  if(!item||item.inventory_tracking===false||item.item_type==='SERVICE'||item.is_bundle||item.has_variants&&!line.variant_id)return null;
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
  const rows=(item.stock_balance_projection||[]).filter((r:any)=>
    (!item.has_variants||r.variant_id===line.variant_id)&&(!line.batch_id||r.batch_id===line.batch_id)&&
    (!r.batch_id||!item.batches?.find((b:any)=>b.id===r.batch_id)?.expiry_date||item.batches.find((b:any)=>b.id===r.batch_id).expiry_date.slice(0,10)>=today));
  const available=rows.reduce((sum:number,r:any)=>sum+Number(r.quantity),0);
  const requested=baseQuantity(item,line)+otherLines.filter(l=>!item.has_variants||l.variant_id===line.variant_id).reduce((sum,l)=>sum+baseQuantity(item,l),0);
  return requested>available+0.000001?`Only ${available.toLocaleString('en-IN')} ${item.primary_unit.code} available. ${(requested-available).toLocaleString('en-IN')} ${item.primary_unit.code} more than available stock. Edit quantity or remove the line.`:null;
}
