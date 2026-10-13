import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { InventoryPostingService, PostMovementDto } from './posting.service';
import { Prisma } from '@prisma/client';

export interface CreateTransferDto {
  company_id: string;
  branch_id: string;
  financial_year_id: string;
  user_id: string;
  document_date: Date;
  source_godown_id: string;
  destination_godown_id: string;
  narration?: string;
  lines: {
    item_id: string;
    unit_id: string;
    quantity: number;
  }[];
}

@Injectable()
export class StockTransferService {
  constructor(
    private prisma: PrismaService,
    private postingService: InventoryPostingService,
  ) {}

  async createAndPost(data: CreateTransferDto) {
    if (!data.lines || data.lines.length === 0) {
      throw new BadRequestException('Transfer must have at least one line');
    }
    if (data.source_godown_id === data.destination_godown_id) {
      throw new BadRequestException('Source and destination godowns cannot be the same');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Generate document number
      const count = await tx.stockTransfer.count({
        where: { company_id: data.company_id, financial_year_id: data.financial_year_id }
      });
      const docNum = `TRF-${data.financial_year_id.substring(0, 4)}-${(count + 1).toString().padStart(4, '0')}`;

      // Create Transfer Header & Lines
      const transfer = await tx.stockTransfer.create({
        data: {
          company_id: data.company_id,
          branch_id: data.branch_id,
          financial_year_id: data.financial_year_id,
          document_number: docNum,
          document_date: data.document_date,
          source_godown_id: data.source_godown_id,
          destination_godown_id: data.destination_godown_id,
          status: 'POSTED',
          narration: data.narration,
          posted_at: new Date(),
          posted_by: data.user_id,
          lines: {
            create: data.lines.map(l => ({
              item_id: l.item_id,
              unit_id: l.unit_id,
              quantity: l.quantity,
            }))
          }
        },
        include: { lines: true }
      });

      // Post Movements: OUT from Source
      const outDto: PostMovementDto = {
        company_id: data.company_id,
        branch_id: data.branch_id,
        movement_type: 'TRANSFER_OUT',
        business_date: data.document_date,
        source_document_type: 'STOCK_TRANSFER',
        source_document_id: transfer.id,
        lines: transfer.lines.map((l: any) => ({
          item_id: l.item_id,
          godown_id: transfer.source_godown_id,
          quantity: Number(l.quantity),
          unit_id: l.unit_id,
          source_line_id: l.id
        }))
      };

      // Post Movements: IN to Destination
      const inDto: PostMovementDto = {
        company_id: data.company_id,
        branch_id: data.branch_id,
        movement_type: 'TRANSFER_IN',
        business_date: data.document_date,
        source_document_type: 'STOCK_TRANSFER',
        source_document_id: transfer.id,
        lines: transfer.lines.map((l: any) => ({
          item_id: l.item_id,
          godown_id: transfer.destination_godown_id,
          quantity: Number(l.quantity),
          unit_id: l.unit_id,
          source_line_id: l.id
        }))
      };

      await this.postingService.postMovement(tx, outDto);
      await this.postingService.postMovement(tx, inDto);

      // Create Audit Log
      await tx.auditLog.create({
        data: {
          company_id: data.company_id,
          user_id: data.user_id,
          action: 'STOCK_TRANSFER_POSTED',
          source_document_type: 'STOCK_TRANSFER',
          source_document_id: transfer.id,
          details: JSON.stringify({ document_number: docNum, source: data.source_godown_id, destination: data.destination_godown_id })
        }
      });

      return transfer;
    });
  }

  async reverseTransfer(id: string, userId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        include: { lines: true }
      });

      if (!transfer) throw new BadRequestException('Transfer not found');
      if (transfer.status === 'REVERSED') throw new BadRequestException('Transfer already reversed');
      if (transfer.status !== 'POSTED') throw new BadRequestException('Can only reverse POSTED transfers');

      // Post compensating movements
      // To reverse a transfer, we send IN to the original Source and OUT from the original Destination
      const inDto: PostMovementDto = {
        company_id: transfer.company_id,
        branch_id: transfer.branch_id,
        movement_type: 'TRANSFER_IN',
        business_date: new Date(),
        source_document_type: 'STOCK_TRANSFER',
        source_document_id: transfer.id,
        lines: transfer.lines.map((l: any) => ({
          item_id: l.item_id,
          godown_id: transfer.source_godown_id,
          quantity: Number(l.quantity),
          unit_id: l.unit_id,
          source_line_id: l.id
        }))
      };

      const outDto: PostMovementDto = {
        company_id: transfer.company_id,
        branch_id: transfer.branch_id,
        movement_type: 'TRANSFER_OUT',
        business_date: new Date(),
        source_document_type: 'STOCK_TRANSFER',
        source_document_id: transfer.id,
        lines: transfer.lines.map((l: any) => ({
          item_id: l.item_id,
          godown_id: transfer.destination_godown_id,
          quantity: Number(l.quantity),
          unit_id: l.unit_id,
          source_line_id: l.id
        }))
      };

      await this.postingService.postMovement(tx, outDto);
      await this.postingService.postMovement(tx, inDto);

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'REVERSED',
          updated_at: new Date()
        }
      });

      // Create Audit Log
      await tx.auditLog.create({
        data: {
          company_id: transfer.company_id,
          user_id: userId,
          action: 'STOCK_TRANSFER_REVERSED',
          source_document_type: 'STOCK_TRANSFER',
          source_document_id: transfer.id,
          details: JSON.stringify({ original_document_number: transfer.document_number })
        }
      });

      return updated;
    });
  }
}
