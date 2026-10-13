import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

export interface BatchAllocationRequest {
  itemId: string;
  variantId?: string | null;
  godownId: string;
  quantityBase: Prisma.Decimal;
  transactionDate: Date;
  manualBatchId?: string | null;
}

export interface BatchAllocationResult {
  batchId: string;
  quantity: Prisma.Decimal;
}

@Injectable()
export class BatchExpiryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Compatibility view of received lots. Current sellable quantities live in
   * stock projections; received_quantity here is receipt history, not stock. */
  async getExpiringBatches(companyId:string,daysOut:number){
    if(!Number.isInteger(daysOut)||daysOut<0||daysOut>3660)throw new BadRequestException('Invalid expiry horizon');
    const today=new Date();today.setUTCHours(0,0,0,0);const end=new Date(today.getTime()+(daysOut+1)*86400000);
    const lines=await this.prisma.goodsReceiptLine.findMany({where:{goods_receipt:{company_id:companyId},expiry_date:{gte:today,lt:end},batch_number:{not:null}},
      include:{item:true,goods_receipt:{select:{document_number:true}}},orderBy:{expiry_date:'asc'},take:200});
    return lines.map(l=>({item_id:l.item_id,item_name:l.item.name,batch_number:l.batch_number,expiry_date:l.expiry_date,received_quantity:l.received_quantity,document_number:l.goods_receipt.document_number}));
  }

  /**
   * Resolves valid batches for a sale/issue using FEFO.
   * If manualBatchId is provided, validates and allocates from that batch only.
   * Throws if insufficient non-expired stock.
   */
  async resolveBatchesForSale(
    companyId: string,
    req: BatchAllocationRequest,
    txClient?: Prisma.TransactionClient,
  ): Promise<BatchAllocationResult[]> {
    const tx = txClient || this.prisma;
    const { itemId, variantId, godownId, quantityBase, transactionDate, manualBatchId } = req;

    // Normalize transaction date to start of day for expiry comparison (Expiring today remains valid)
    const txDateStr = transactionDate.toISOString().split('T')[0];

    const item = await tx.item.findFirst({ where: { id: itemId, company_id: companyId } });
    if (!item) throw new BadRequestException(`Item not found`);

    if (!item.track_batch) {
      return []; // Return empty if not batch tracked
    }

    if (manualBatchId) {
      // Validate manual batch
      const proj = await tx.stockBalanceProjection.findFirst({
        where: {
          company_id: companyId,
          item_id: itemId,
          variant_id: variantId || null,
          godown_id: godownId,
          batch_id: manualBatchId,
          quantity: { gt: 0 }
        },
        include: { batch: true }
      });
      if (!proj || !proj.batch) {
         throw new BadRequestException(`Batch not found or out of stock in selected godown.`);
      }

      if (proj.batch.expiry_date) {
        const expiryStr = proj.batch.expiry_date.toISOString().split('T')[0];
        if (expiryStr < txDateStr) {
          throw new BadRequestException(`This batch has expired.`);
        }
      }

      if (new Prisma.Decimal(proj.quantity).lt(quantityBase)) {
        throw new BadRequestException(`Insufficient stock in selected batch.`);
      }

      return [{ batchId: manualBatchId, quantity: quantityBase }];
    }

    // Auto-allocation (FEFO)
    const projections = await tx.stockBalanceProjection.findMany({
      where: {
        company_id: companyId,
        item_id: itemId,
        variant_id: variantId || null,
        godown_id: godownId,
        batch_id: { not: null },
        quantity: { gt: 0 }
      },
      include: { batch: true }
    });

    // Filter valid and sort
    const validProjections = projections.filter(p => {
      if (p.batch?.expiry_date) {
         const expiryStr = p.batch.expiry_date.toISOString().split('T')[0];
         return expiryStr >= txDateStr;
      }
      return true;
    });

    validProjections.sort((a, b) => {
      const aExpiry = a.batch?.expiry_date ? a.batch.expiry_date.getTime() : Infinity;
      const bExpiry = b.batch?.expiry_date ? b.batch.expiry_date.getTime() : Infinity;
      return aExpiry - bExpiry; // Earliest expiry first
    });

    const allocations: BatchAllocationResult[] = [];
    let remaining = quantityBase;

    for (const proj of validProjections) {
      if (remaining.lte(0)) break;
      const projQty = new Prisma.Decimal(proj.quantity);
      const allocatedQty = Prisma.Decimal.min(remaining, projQty);

      allocations.push({
        batchId: proj.batch_id!,
        quantity: allocatedQty
      });
      remaining = remaining.sub(allocatedQty);
    }

    if (remaining.gt(0)) {
       throw new BadRequestException(`Insufficient non-expired stock for item ${item.name}.`);
    }

    return allocations;
  }
}
