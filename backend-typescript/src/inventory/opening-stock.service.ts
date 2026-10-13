import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { InventoryPostingService, PostMovementDto } from './posting.service';
import { PostingService as AccountingPostingService } from '../accounting/posting.service';
import { Prisma } from '@prisma/client';
import {costLedger} from './value-journal';

export interface PostOpeningStockDto {
  company_id: string;
  branch_id: string;
  financial_year_id: string;
  document_number: string;
  document_date: Date;
  narration?: string;
  lines: {
    item_id: string;
    godown_id: string;
    unit_id: string;
    quantity: number;
    cost_rate?: number | null;
  }[];
}

@Injectable()
export class OpeningStockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryPostingService: InventoryPostingService,
    private readonly accountingPostingService: AccountingPostingService,
  ) {}

  async postOpeningStock(data: PostOpeningStockDto, userId: string, suppliedTx?: Prisma.TransactionClient) {
    const db = suppliedTx || this.prisma;
    if (!data.lines || data.lines.length === 0) {
      throw new BadRequestException('Opening stock must have at least one line');
    }

    // Check duplicate document number
    const existing = await db.openingStock.findUnique({
      where: {
        company_id_document_number: {
          company_id: data.company_id,
          document_number: data.document_number,
        }
      }
    });

    if (existing) {
      throw new BadRequestException('Opening stock document number already exists');
    }

    // Verify Godown Isolation (Tenant/Company/Branch)
    const godownIds = [...new Set(data.lines.map(l => l.godown_id))];
    for (const gid of godownIds) {
      const godown = await db.godown.findUnique({ where: { id: gid } });
      if (!godown) {
        throw new NotFoundException(`Godown ${gid} not found`);
      }
      if (godown.branch_id !== data.branch_id) {
        throw new ForbiddenException(`Godown ${gid} does not belong to the specified branch`);
      }
    }

    const post = async (tx: Prisma.TransactionClient) => {
      // 1. Create Opening Stock Document
      const openingStock = await tx.openingStock.create({
        data: {
          company_id: data.company_id,
          branch_id: data.branch_id,
          financial_year_id: data.financial_year_id,
          document_number: data.document_number,
          document_date: data.document_date,
          status: 'POSTED',
          narration: data.narration,
          posted_at: new Date(),
          posted_by: userId,
          lines: {
            create: data.lines.map(line => ({
              item_id: line.item_id,
              godown_id: line.godown_id,
              unit_id: line.unit_id,
              quantity: line.quantity,
              cost_rate: line.cost_rate,
            }))
          }
        },
        include: { lines: true }
      });

      // 2. Post Inventory Movements
      const movementDto: PostMovementDto = {
        company_id: data.company_id,
        branch_id: data.branch_id,
        movement_type: 'OPENING_IN',
        business_date: data.document_date,
        source_document_type: 'OPENING_STOCK',
        source_document_id: openingStock.id,
        lines: openingStock.lines.map((l: any) => ({
          item_id: l.item_id,
          godown_id: l.godown_id,
          quantity: Number(l.quantity),
          unit_id: l.unit_id,
          source_line_id: l.id,
          cost_rate: l.cost_rate == null ? null : l.cost_rate.toString(),
        }))
      };

      await this.inventoryPostingService.postMovement(tx as any, movementDto);

      // 3. Post Accounting Voucher
      const getOrCreateLedger = async (code: string, name: string) => {
        let acc = await tx.ledgerAccount.findFirst({ where: { company_id: data.company_id, code } });
        if (!acc) acc = await tx.ledgerAccount.create({ data: { company_id: data.company_id, code, name, account_type: 'UNKNOWN', normal_balance: 'DEBIT' } });
        return acc;
      };

      const inventoryAccount = await costLedger(tx,data.company_id,'1200','Inventory Asset','ASSET');
      const equityAccount = await getOrCreateLedger('3000', 'Opening Stock Equity');

      let totalValue = new Prisma.Decimal(0);
      for (const line of data.lines) {
        if (line.cost_rate != null) totalValue = totalValue.plus(new Prisma.Decimal(line.quantity).mul(line.cost_rate));
      }

      if (totalValue.gt(0)) {
        await this.accountingPostingService.postVoucher(tx as any, {
          company_id: data.company_id,
          branch_id: data.branch_id,
          financial_year_id: data.financial_year_id,
          voucher_type: 'JOURNAL',
          document_number: `JV-OS-${data.document_number}`,
          voucher_date: data.document_date,
          source_document_type: 'OPENING_STOCK',
          source_document_id: openingStock.id,
          narration: `Opening Stock ${data.document_number}`,
          posted_by: userId,
          lines: [
            {
              ledger_account_id: inventoryAccount.id,
              debit: totalValue,
              credit: 0,
            },
            {
              ledger_account_id: equityAccount.id,
              debit: 0,
              credit: totalValue,
            }
          ]
        });
      }

      return openingStock;
    };
    return suppliedTx ? post(suppliedTx) : this.prisma.$transaction(post);
  }

  async getOpeningStocks(companyId: string, branchId?: string) {
    return this.prisma.openingStock.findMany({
      where: {
        company_id: companyId,
        ...(branchId ? { branch_id: branchId } : {}),
      },
      include: {
        lines: {
          include: { item: true, godown: true, unit: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });
  }
}
