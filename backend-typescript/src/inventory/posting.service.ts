import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { postInventoryCost } from './costing';
import { businessDate } from '../common/business-date';

export type MovementType = 
  | 'PURCHASE_IN' 
  | 'SALES_OUT' 
  | 'SALES_RETURN_IN' 
  | 'PURCHASE_RETURN_OUT' 
  | 'TRANSFER_OUT' 
  | 'TRANSFER_IN' 
  | 'ADJUSTMENT_IN' 
  | 'ADJUSTMENT_OUT' 
  | 'OPENING_IN';

export interface MovementLine {
  item_id: string;
  godown_id: string;
  quantity: string | number; // Strictly positive. Direction is derived from MovementType
  unit_id: string;
  variant_id?: string | null;
  batch_id?: string | null;
  serial_id?: string | null;
  source_line_id?: string;
  cost_rate?: string | number | null;
  cost_line_id?: string;
  cost_origin_document_id?: string;
  cost_origin_line_id?: string;
  cost_reversal_movement_id?: string;
}

export interface PostMovementDto {
  company_id: string;
  branch_id: string;
  movement_type: MovementType;
  business_date: Date;
  source_document_type: string;
  source_document_id: string;
  lines: MovementLine[];
}

@Injectable()
export class InventoryPostingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates whether a movement type represents an inflow or outflow of physical stock.
   */
  private getMovementDirection(type: MovementType): 1 | -1 {
    switch (type) {
      case 'PURCHASE_IN':
      case 'SALES_RETURN_IN':
      case 'TRANSFER_IN':
      case 'ADJUSTMENT_IN':
      case 'OPENING_IN':
        return 1;
      case 'SALES_OUT':
      case 'PURCHASE_RETURN_OUT':
      case 'TRANSFER_OUT':
      case 'ADJUSTMENT_OUT':
        return -1;
      default:
        throw new BadRequestException(`Unknown movement type: ${type}`);
    }
  }

  /**
   * The canonical inventory engine. All business events mutating stock MUST pass through here.
   */
  async postMovement(
    tx: Prisma.TransactionClient,
    dto: PostMovementDto
  ): Promise<void> {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Cannot post inventory movement with zero lines');
    }

    const direction = this.getMovementDirection(dto.movement_type);

    for (const line of [...dto.lines].sort((a,b) => a.item_id.localeCompare(b.item_id) || (a.serial_id || '').localeCompare(b.serial_id || ''))) {
      const absQty = new Prisma.Decimal(line.quantity);

      if (absQty.lte(0)) {
        throw new BadRequestException(`Invalid inventory quantity: ${absQty.toString()}. Must be positive. Direction is determined by movement type.`);
      }

      // Security & Isolation Checks
      await tx.$queryRaw`SELECT id FROM items WHERE id = ${line.item_id}::uuid AND company_id = ${dto.company_id}::uuid FOR UPDATE`;
      const item = await tx.item.findFirst({ where: { id: line.item_id, company_id: dto.company_id } });
      if (!item) {
        throw new BadRequestException(`Item ${line.item_id} not found or does not belong to company ${dto.company_id}`);
      }
      if (line.variant_id && !await tx.itemVariant.findFirst({where:{id:line.variant_id,item_id:item.id}}))
        throw new BadRequestException('Variant does not belong to this item');

      // Services do not maintain inventory, reject invalid mixed requests
      if (item.item_type === 'SERVICE') {
        throw new BadRequestException(`Cannot post inventory movement for SERVICE item: ${item.id}`);
      }

      if (item.inventory_tracking === false) {
        if (!['PURCHASE_IN', 'OPENING_IN', 'ADJUSTMENT_IN'].includes(dto.movement_type)) {
          throw new BadRequestException('Receive or count actual stock before posting a physical stock movement');
        }
        // Start counting at a real receipt/count, under the authoritative item lock.
        // Historical uncounted sale lines retain their own immutable snapshot.
        await tx.item.update({ where: { id: item.id }, data: { inventory_tracking: true } });
      }

      const godown = await tx.godown.findFirst({ where: { id: line.godown_id, branch_id: dto.branch_id } });
      if (!godown) {
        throw new BadRequestException(`Godown ${line.godown_id} not found or does not belong to branch ${dto.branch_id}`);
      }

      if (item.selling_mode === 'PIECE' && !absQty.isInteger()) {
        throw new BadRequestException(`Fractional quantity not allowed for PIECE item: ${item.id}`);
      }

      let conversionFactor = new Prisma.Decimal(1);
      let baseQty = absQty;

      if (line.unit_id !== item.primary_unit_id) {
        const conversion = await tx.itemUnitConversion.findFirst({
          where: {
            item_id: line.item_id,
            from_unit_id: line.unit_id,
            to_unit_id: item.primary_unit_id
          }
        });

        if (!conversion) {
          throw new BadRequestException(`No unit conversion found for item ${item.id} from unit ${line.unit_id} to base unit ${item.primary_unit_id}`);
        }

        conversionFactor = new Prisma.Decimal(conversion.conversion_factor);
        baseQty = absQty.mul(conversionFactor);
      }

      const quantityDelta = absQty.mul(direction);
      const baseQuantityDelta = baseQty.mul(direction);
      if(baseQty.decimalPlaces()>6)throw new BadRequestException('Base stock quantity supports at most six decimal places');

      if (item.track_serial) {
        if (!line.serial_id || !baseQty.eq(1)) throw new BadRequestException('Serial stock must post one selected serial per base unit');
        await tx.$queryRaw`SELECT id FROM item_serials WHERE id = ${line.serial_id}::uuid FOR UPDATE`;
        const serial = await tx.itemSerial.findFirst({ where: { id: line.serial_id, company_id: dto.company_id,
          item_id: item.id, godown_id: line.godown_id, variant_id: line.variant_id || null, batch_id: line.batch_id || null } });
        const expected = dto.movement_type === 'PURCHASE_IN' || dto.movement_type === 'OPENING_IN' ? 'RECEIVING'
          : dto.movement_type === 'SALES_RETURN_IN' ? 'SOLD' : direction < 0 ? 'AVAILABLE' : null;
        if (!serial || !expected || serial.status !== expected) throw new BadRequestException('Serial is unavailable or does not match this item, variant and stock location');
        const status = direction > 0 ? 'AVAILABLE' : dto.movement_type === 'SALES_OUT' ? 'SOLD'
          : dto.movement_type === 'ADJUSTMENT_OUT' ? 'DAMAGED' : 'REMOVED';
        await tx.itemSerial.update({ where: { id: serial.id }, data: { status } });
      } else if (line.serial_id) throw new BadRequestException('Serial tracking is disabled for this item');

      // 1. Check idempotency / double posting (Assuming a unique index exists on DB side too, but application logic first)
      const existingMovement = await tx.stockMovement.findFirst({
        where: {
          company_id: dto.company_id,
          source_document_type: dto.source_document_type,
          source_document_id: dto.source_document_id,
          source_line_id: line.source_line_id,
          movement_type: dto.movement_type,
          batch_id: line.batch_id || null,
          serial_id: line.serial_id || null,
        }
      });
      if (existingMovement) {
        throw new BadRequestException(`Duplicate inventory posting prevented for source: ${dto.source_document_id}`);
      }

      // 2. Insert authoritative movement
      const cost = await postInventoryCost(tx, dto, line, baseQty, conversionFactor);
      await tx.stockMovement.create({
        data: {
          company_id: dto.company_id,
          branch_id: dto.branch_id,
          godown_id: line.godown_id,
          item_id: line.item_id,
          business_date: dto.business_date,
          movement_type: dto.movement_type,
          quantity_delta: quantityDelta,
          base_quantity_delta: baseQuantityDelta,
          unit_id: line.unit_id,
          variant_id: line.variant_id ?? null,
          batch_id: line.batch_id ?? null,
          serial_id: line.serial_id ?? null,
          source_document_type: dto.source_document_type,
          source_document_id: dto.source_document_id,
          source_line_id: line.source_line_id,
          ...cost,
        },
      });

      // 3. Mutate derived StockBalanceProjection
      const balance = await tx.stockBalanceProjection.findFirst({
        where: { 
          company_id: dto.company_id, 
          branch_id: dto.branch_id, 
          godown_id: line.godown_id, 
          item_id: line.item_id,
          variant_id: line.variant_id ?? null,
          batch_id: line.batch_id ?? null,
        },
      });

      if (balance) {
        const newQty = new Prisma.Decimal(balance.quantity).plus(baseQuantityDelta);
        if (newQty.lt(0)) {
           throw new BadRequestException(`Negative stock blocked for item ${line.item_id} in godown ${line.godown_id}. Current: ${balance.quantity}, Delta: ${baseQuantityDelta}`);
        }

        await tx.stockBalanceProjection.update({
          where: { id: balance.id },
          data: { quantity: newQty },
        });
      } else {
        if (baseQuantityDelta.lt(0)) {
           throw new BadRequestException(`Negative stock blocked for item ${line.item_id} in godown ${line.godown_id}. Current: 0, Delta: ${baseQuantityDelta}`);
        }

        await tx.stockBalanceProjection.create({
          data: {
            company_id: dto.company_id,
            branch_id: dto.branch_id,
            godown_id: line.godown_id,
            item_id: line.item_id,
            variant_id: line.variant_id ?? null,
            batch_id: line.batch_id ?? null,
            quantity: baseQuantityDelta,
          },
        });
      }
    }
  }

  /**
   * Reverses a stock movement transaction atomically.
   */
  async reverseMovement(
    tx: Prisma.TransactionClient,
    companyId: string,
    sourceDocumentType: string,
    sourceDocumentId: string,
    reversalDocumentType: string
  ): Promise<void> {
    const originalMovements = await tx.stockMovement.findMany({
      where: {
        company_id: companyId,
        source_document_type: sourceDocumentType,
        source_document_id: sourceDocumentId,
      }
    });

    if (originalMovements.length === 0) return; // Nothing to reverse
    for(const itemId of [...new Set(originalMovements.map(m=>m.item_id))].sort())
      await tx.$queryRaw`SELECT id FROM items WHERE id=${itemId}::uuid AND company_id=${companyId}::uuid FOR UPDATE`;

    // Check if already reversed
    const alreadyReversed = await tx.stockMovement.findFirst({
      where: {
        company_id: companyId,
        source_document_type: reversalDocumentType,
        source_document_id: sourceDocumentId,
      }
    });

    if (alreadyReversed) {
      throw new BadRequestException('Double reversal rejected. Inventory movement already reversed.');
    }

    for (const mov of [...originalMovements].sort((a,b)=>a.item_id.localeCompare(b.item_id))) {
      await tx.$queryRaw`SELECT id FROM items WHERE id = ${mov.item_id}::uuid FOR UPDATE`;
      if(mov.serial_id)throw new BadRequestException('Serial documents require an original serial return; generic reversal is disabled');
      // Create opposite movement
      const reverseType = this.getReversalMovementType(mov.movement_type as MovementType);
      
      const reverseQtyDelta = new Prisma.Decimal(mov.quantity_delta).mul(-1);
      const reverseBaseDelta = new Prisma.Decimal(mov.base_quantity_delta).mul(-1);
      const cost = await postInventoryCost(tx, { company_id: mov.company_id, branch_id: mov.branch_id,
        source_document_type: reversalDocumentType, source_document_id: sourceDocumentId,
        business_date: new Date(businessDate()), movement_type: reverseType, lines: [] }, {
          item_id: mov.item_id, godown_id: mov.godown_id, unit_id: mov.unit_id,
          quantity: reverseBaseDelta.abs().toString(), variant_id: mov.variant_id,
          source_line_id: mov.source_line_id || undefined, cost_reversal_movement_id: mov.id,
          cost_line_id: mov.cost_line_id || undefined }, reverseBaseDelta.abs(), new Prisma.Decimal(1));

      await tx.stockMovement.create({
        data: {
          company_id: mov.company_id,
          branch_id: mov.branch_id,
          godown_id: mov.godown_id,
          item_id: mov.item_id,
          business_date: new Date(businessDate()),
          movement_type: reverseType,
          quantity_delta: reverseQtyDelta,
          base_quantity_delta: reverseBaseDelta,
          unit_id: mov.unit_id,
          variant_id: mov.variant_id ?? null,
          batch_id: mov.batch_id ?? null,
          serial_id: mov.serial_id ?? null,
          source_document_type: reversalDocumentType,
          source_document_id: mov.source_document_id,
          source_line_id: mov.source_line_id,
          ...cost,
        },
      });

      // Update projection
      const balance = await tx.stockBalanceProjection.findFirst({
        where: { 
          company_id: mov.company_id, 
          branch_id: mov.branch_id, 
          godown_id: mov.godown_id, 
          item_id: mov.item_id,
          variant_id: mov.variant_id ?? null,
          batch_id: mov.batch_id ?? null,
        },
      });

      if (balance) {
         const newQty = new Prisma.Decimal(balance.quantity).plus(reverseBaseDelta);
         if (newQty.lt(0)) {
           throw new BadRequestException(`Negative stock blocked during reversal for item ${mov.item_id} in godown ${mov.godown_id}.`);
         }
         await tx.stockBalanceProjection.update({
           where: { id: balance.id },
           data: { quantity: newQty },
         });
      }
    }
  }

  private getReversalMovementType(type: MovementType): MovementType {
    switch (type) {
      case 'PURCHASE_IN': return 'PURCHASE_RETURN_OUT';
      case 'PURCHASE_RETURN_OUT': return 'PURCHASE_IN';
      case 'SALES_OUT': return 'SALES_RETURN_IN';
      case 'SALES_RETURN_IN': return 'SALES_OUT';
      case 'TRANSFER_IN': return 'TRANSFER_OUT';
      case 'TRANSFER_OUT': return 'TRANSFER_IN';
      case 'ADJUSTMENT_IN': return 'ADJUSTMENT_OUT';
      case 'ADJUSTMENT_OUT': return 'ADJUSTMENT_IN';
      case 'OPENING_IN': return 'ADJUSTMENT_OUT';
      default: throw new BadRequestException(`Cannot map reversal type for ${type}`);
    }
  }
}
