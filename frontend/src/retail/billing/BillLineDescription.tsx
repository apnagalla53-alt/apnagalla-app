// Show the customer's entered units, rather than the inventory base quantity.
export function billLineQuantity(line: any) {
  const quantity = Number(line.sold_entered_quantity ?? line.entered_quantity ?? line.quantity);
  if (line.dimensions) return `${quantity} ${quantity === 1 ? 'piece' : 'pieces'}`;
  const unit = line.entered_unit?.code ?? line.unit?.code ?? '';
  return `${quantity}${unit ? ' ' + unit : ''}`;
}

export default function BillLineDescription({ line }: { line: any }) {
  const dimensions = line.dimensions;
  const warranty = line.warranty_snapshot;
  return <div style={{ fontSize: 'inherit', overflowWrap: 'anywhere' }}>
    <div>{billLineQuantity(line)}{dimensions ? ` · ${Object.values(dimensions).join(' × ')} · measured quantity ${Number(line.base_quantity ?? line.quantity)} ${line.unit?.code ?? ''}` : ''} · ₹{Number(line.rate)} / {line.entered_unit?.code ?? line.unit?.code ?? 'unit'}</div>
    {line.variant && <div>Variant: {Object.values(line.variant.attributes || {}).join(' / ') || line.variant.sku}</div>}
    {line.serial_allocations?.map((allocation: any) => <div key={allocation.serial_id}>Serial: {allocation.serial?.serial_number}{allocation.returned_at ? ' · Returned' : ''}</div>)}
    {warranty && Number(warranty.days) > 0 && <div>Warranty: {warranty.days} days · {warranty.start} to {warranty.end}</div>}
  </div>;
}
