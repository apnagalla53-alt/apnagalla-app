import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

// Only disposable item configuration may cascade. Every other schema relation,
// including future relations, conservatively protects the item from hard deletion.
const configuration = new Set(['barcodes', 'unit_conversions', 'modifier_groups']);
const references = Object.fromEntries(Prisma.dmmf.datamodel.models.find(m => m.name === 'Item')!.fields
  .filter(f => f.kind === 'object' && f.isList && !configuration.has(f.name)).map(f => [f.name, true]));

@Injectable()
export class ItemRemovalService {
  constructor(private readonly db: PrismaService) {}

  private async inspect(tx: Prisma.TransactionClient, company: string, id: string) {
    const item = await tx.item.findFirst({where: {id, company_id: company, is_system: false},
      include: {primary_unit: true, _count: {select: references}, stock_balance_projection: true}});
    if (!item) throw new NotFoundException('Item not found');
    const reasons = Object.entries(item._count).filter(([, count]) => Number(count) > 0).map(([name]) => name);
    const photos = await tx.attachment.count({where: {company_id: company, entity_type: 'ITEM', entity_id: id}});
    if (photos) reasons.push('attachments');
    const stock = item.stock_balance_projection.reduce((sum, row) => sum.plus(row.quantity), new Prisma.Decimal(0));
    if (item.stock_balance_projection.some(row => !row.quantity.isZero())) reasons.push('nonzero_stock');
    return {id: item.id, name: item.name, sku: item.sku, active: item.is_active, unit: item.primary_unit.code,item_type:item.item_type,is_bundle:item.is_bundle,
      current_stock: stock.toString(), can_permanently_delete: reasons.length === 0, protected_references: reasons};
  }

  preflight(company: string, id: string) {return this.db.$transaction(tx => this.inspect(tx, company, id));}

  async remove(company: string, user: string, ids: string[], action: 'ARCHIVE' | 'DELETE', confirmation?: string) {
    if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length) throw new BadRequestException('Select between 1 and 100 distinct items');
    if (action === 'DELETE' && confirmation !== 'DELETE PERMANENTLY') throw new BadRequestException('Permanent deletion requires explicit confirmation');
    return this.db.$transaction(async tx => {
      // Use the same attachment lock as uploads, then lock all item references.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${company + ':attachments'},0))`;
      const ordered = [...ids].sort();
      await tx.$queryRaw(Prisma.sql`SELECT id FROM items WHERE company_id=${company}::uuid AND id IN (${Prisma.join(ordered.map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
      const inspected = [];
      for (const id of ordered) inspected.push(await this.inspect(tx, company, id));
      if (action === 'DELETE' && inspected.some(item => !item.can_permanently_delete)) throw new BadRequestException({
        message: 'These items have stock, history or protected references. Archive them or review individually. Nothing was deleted.',
        code: 'ITEM_DELETE_PROTECTED', items: inspected});
      for (const item of inspected) {
        if (action === 'ARCHIVE') await tx.item.update({where: {id: item.id}, data: {is_active: false}});
        else await tx.item.delete({where: {id: item.id}});
        await tx.auditLog.create({data: {company_id: company, user_id: user,
          action: action === 'ARCHIVE' ? 'RETAIL_ITEM_ARCHIVED' : 'RETAIL_ITEM_PERMANENTLY_DELETED',
          details: JSON.stringify({item_id: item.id, name: item.name, sku: item.sku, stock_preserved: item.current_stock})}});
      }
      return {action, affected: inspected.length, items: inspected};
    });
  }
}
