import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface ProductionPayload {
  company_id: string;
  branch_id: string;
  godown_id: string;
  finished_item_id: string;
  finished_unit_id: string;
  produced_quantity: number;
  raw_materials: {
    item_id: string;
    unit_id: string;
    consumed_quantity: number;
  }[];
}

@Injectable()
export class ManufacturingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Processes a production order: consumes raw materials and produces finished goods.
   */
  async recordProduction(payload: ProductionPayload) {
    if (payload.raw_materials.length === 0) {
      throw new BadRequestException('Production requires at least one raw material to consume');
    }

    return this.prisma.$transaction(async (tx) => {
      const documentId = uuidv4();
      const documentDate = new Date();
      
      // 1. Consume Raw Materials (Stock Out)
      for (const rm of payload.raw_materials) {
        await tx.stockMovement.create({
          data: {
            company_id: payload.company_id,
            branch_id: payload.branch_id,
            godown_id: payload.godown_id,
            item_id: rm.item_id,
            unit_id: rm.unit_id,
            business_date: documentDate,
            movement_type: 'PRODUCTION_CONSUME',
            quantity_delta: -rm.consumed_quantity,
            base_quantity_delta: -rm.consumed_quantity,
            source_document_type: 'PRODUCTION',
            source_document_id: documentId
          }
        });
      }

      // 2. Add Finished Goods (Stock In)
      await tx.stockMovement.create({
        data: {
          company_id: payload.company_id,
          branch_id: payload.branch_id,
          godown_id: payload.godown_id,
          item_id: payload.finished_item_id,
          unit_id: payload.finished_unit_id,
          business_date: documentDate,
          movement_type: 'PRODUCTION_PRODUCE',
          quantity_delta: payload.produced_quantity,
          base_quantity_delta: payload.produced_quantity,
          source_document_type: 'PRODUCTION',
          source_document_id: documentId
        }
      });

      return {
        success: true,
        document_id: documentId,
        message: `Produced ${payload.produced_quantity} of Finished Good. Consumed ${payload.raw_materials.length} Raw Materials.`
      };
    });
  }
}
