import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Receipt preparation shared by Retail purchases and ERP goods receipts. Stock still posts through InventoryPostingService. */
export async function receiveSerials(tx: Prisma.TransactionClient, context: {
  company_id: string; item_id: string; godown_id: string; variant_id?: string | null; batch_id?: string | null;
  quantity: number; numbers: unknown; date: Date; document_id: string;
}) {
  const numbers = Array.isArray(context.numbers) ? context.numbers.map(n => typeof n === 'string' ? n.trim().toUpperCase() : '') : [];
  if (!Number.isInteger(context.quantity) || context.quantity < 1 || numbers.length !== context.quantity)
    throw new BadRequestException('Enter exactly one serial number per base unit received');
  if (numbers.some(n => !n || n.length > 100) || new Set(numbers).size !== numbers.length)
    throw new BadRequestException('Serial numbers must be distinct and contain 1–100 characters');
  await tx.$queryRaw`SELECT id FROM companies WHERE id = ${context.company_id}::uuid FOR UPDATE`;
  if (await tx.itemSerial.findFirst({ where: { company_id: context.company_id, serial_number: { in: numbers } } }))
    throw new BadRequestException('A serial number is already registered in this shop');
  const serials = [];
  for (const number of numbers) serials.push(await tx.itemSerial.create({ data: {
    company_id: context.company_id, item_id: context.item_id, godown_id: context.godown_id,
    variant_id: context.variant_id, batch_id: context.batch_id, serial_number: number, status: 'RECEIVING',
    received_date: context.date, receipt_document_id: context.document_id,
  } }));
  return serials;
}
