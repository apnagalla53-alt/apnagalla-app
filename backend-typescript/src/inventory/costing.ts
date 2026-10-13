import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MovementLine, PostMovementDto } from './posting.service';

// Preserve more intermediate precision than the persisted 24,12 value scale.
Prisma.Decimal.set({precision:40,rounding:Prisma.Decimal.ROUND_HALF_UP});

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const precise = (v: Prisma.Decimal) => v.toDecimalPlaces(12, Prisma.Decimal.ROUND_HALF_UP);

/** Called only under InventoryPostingService's scoped item lock, inside its transaction. */
export async function postInventoryCost(tx: Prisma.TransactionClient, dto: PostMovementDto, line: MovementLine,
  baseQty: Prisma.Decimal, factor: Prisma.Decimal) {
  const key = { company_id: dto.company_id, item_id: line.item_id, variant_key: line.variant_id || 'BASE' };
  let state = await tx.inventoryCostState.findUnique({ where: { company_id_item_id_variant_key: key } });
  if (!state) {
    const physical = await tx.stockBalanceProjection.aggregate({ where: { company_id: dto.company_id, item_id: line.item_id,
      variant_id: line.variant_id || null }, _sum: { quantity: true } });
    const quantity = D(physical._sum.quantity || 0);
    // Never infer the price of existing stock from a master field or legacy zero movement.
    state = await tx.inventoryCostState.create({ data: { ...key, quantity, unknown_quantity: quantity } });
  }
  const qty = D(state.quantity), unknown = D(state.unknown_quantity), value = D(state.known_value);
  const incoming = ['PURCHASE_IN', 'OPENING_IN', 'ADJUSTMENT_IN', 'SALES_RETURN_IN', 'TRANSFER_IN'].includes(dto.movement_type);
  const transfer = dto.movement_type.startsWith('TRANSFER_');
  let cost: Prisma.Decimal | null = null, movedValue = D(0), movedUnknown = D(0);
  if (transfer) {
    if (qty.gt(0)) { movedValue = value.mul(baseQty).div(qty); movedUnknown = unknown.mul(baseQty).div(qty); }
    if (unknown.eq(0) && qty.gt(0)) cost = value.div(qty);
  } else if (line.cost_reversal_movement_id) {
    const original = await tx.stockMovement.findFirst({ where: { id: line.cost_reversal_movement_id,
      company_id: dto.company_id, item_id: line.item_id } });
    if (!original) throw new BadRequestException('Original inventory cost movement not found');
    movedValue = D(original.value_delta).abs();
    movedUnknown = original.unknown_quantity_delta == null ? baseQty : D(original.unknown_quantity_delta).abs();
    if (original.cost_status === 'KNOWN') cost = movedValue.div(baseQty);
  } else if (line.cost_origin_document_id) {
    let originals = await tx.stockMovement.findMany({ where: { company_id: dto.company_id,
      source_document_id: line.cost_origin_document_id, item_id: line.item_id, variant_id: line.variant_id || null,
      ...(line.cost_origin_line_id ? { OR: [{ cost_line_id: line.cost_origin_line_id }, { source_line_id: line.cost_origin_line_id }] } : {}),
      ...(line.serial_id ? { serial_id: line.serial_id } : {}), ...(line.batch_id ? { batch_id: line.batch_id } : {}),
      movement_type: dto.movement_type === 'SALES_RETURN_IN' ? 'SALES_OUT' : 'PURCHASE_IN' } });
    if(!originals.length&&dto.movement_type==='SALES_RETURN_IN'&&line.cost_origin_line_id){
      const sale=await tx.salesInvoiceLine.findFirst({where:{id:line.cost_origin_line_id,sales_invoice:{id:line.cost_origin_document_id,company_id:dto.company_id}}});
      if(sale?.delivery_challan_line_id)originals=await tx.stockMovement.findMany({where:{company_id:dto.company_id,source_document_type:'DELIVERY_CHALLAN',source_line_id:sale.delivery_challan_line_id,item_id:line.item_id,movement_type:'SALES_OUT'}});
    }
    const originalQty = originals.reduce((s, m) => s.plus(D(m.base_quantity_delta).abs()), D(0));
    if (originalQty.gt(0)) {
      const originalValue = originals.reduce((s, m) => s.plus(D(m.value_delta).abs()), D(0));
      movedValue = originalValue.mul(baseQty).div(originalQty);
      movedUnknown = originals.reduce((s,m) => s.plus(m.unknown_quantity_delta == null ? D(m.base_quantity_delta).abs() : D(m.unknown_quantity_delta).abs()), D(0)).mul(baseQty).div(originalQty);
      if (originals.every(m => m.cost_status === 'KNOWN')) cost = originalValue.div(originalQty);
    } else movedUnknown = baseQty;
  } else if (incoming) {
    // A sale return without an original cost snapshot is unknown, regardless of an entered sales rate.
    if (dto.movement_type !== 'SALES_RETURN_IN' && line.cost_rate != null) {
      cost = D(line.cost_rate).div(factor);
      if (!cost.isFinite() || cost.lt(0)) throw new BadRequestException('Inventory acquisition cost must be non-negative');
      movedValue = cost.mul(baseQty);
    } else movedUnknown = baseQty;
  } else {
    if (qty.lt(baseQty)) throw new BadRequestException('Negative stock blocked: cost quantity cannot become negative');
    if (qty.gt(0)) { movedValue = value.mul(baseQty).div(qty); movedUnknown = unknown.mul(baseQty).div(qty); }
    if (unknown.eq(0) && qty.gt(0)) cost = value.div(qty);
  }
  const sign = incoming ? 1 : -1;
  if (!transfer) {
    const nextQty = precise(qty.plus(baseQty.mul(sign)));
    const nextValue = precise(value.plus(movedValue.mul(sign)));
    const nextUnknown = precise(unknown.plus(movedUnknown.mul(sign)));
    if (nextQty.lt(0) || nextValue.lt('-0.000001') || nextUnknown.lt('-0.000001') || nextUnknown.gt(nextQty.plus('0.000001')))
      throw new BadRequestException('Cost reversal exceeds available inventory value or quantity; review the original receipt');
    await tx.inventoryCostState.update({ where: { id: state.id }, data: { quantity: nextQty,
      known_value: nextQty.eq(0) ? D(0) : Prisma.Decimal.max(nextValue, 0),
      unknown_quantity: nextQty.eq(0) ? D(0) : Prisma.Decimal.max(nextUnknown, 0) } });
  }
  return { cost_status: cost == null ? 'UNKNOWN' : 'KNOWN', cost_rate: cost == null ? D(0) : precise(cost),
    value_delta: precise(movedValue.mul(sign)), unknown_quantity_delta: precise(movedUnknown.mul(sign)),
    cost_line_id: line.cost_line_id || line.source_line_id };
}
