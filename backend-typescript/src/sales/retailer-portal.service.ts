import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

export interface RetailerOrderPayload {
  company_id: string;
  branch_id: string;
  lines: {
    item_id: string;
    unit_id: string;
    quantity: number;
    rate: number;
  }[];
}

@Injectable()
export class RetailerPortalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the current outstanding balance for a retailer.
   */
  async getOutstandingBalance(partyId: string) {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        ledger_accounts: {
          include: { voucher_lines: true }
        }
      }
    });

    if (!party) {
      throw new NotFoundException('Retailer not found');
    }

    // In a real implementation, we'd sum the balances of the party's ledger accounts
    // For this mock, we just fetch the most recent statement balance or sum voucher lines.
    let balance = new Prisma.Decimal(0);
    
    // Simplistic calculation: sum of debit - sum of credit for the party's ledgers
    for (const ledger of party.ledger_accounts) {
      for (const line of ledger.voucher_lines) {
        balance = balance.add(line.debit).sub(line.credit);
      }
    }

    return {
      party_id: party.id,
      name: party.name,
      outstanding_balance: balance
    };
  }

  /**
   * Retrieves past sales invoices for the retailer to download/view.
   */
  async getPastInvoices(partyId: string, limit = 10) {
    return this.prisma.salesInvoice.findMany({
      where: { party_id: partyId, status: { not: 'DRAFT' } },
      orderBy: { document_date: 'desc' },
      take: limit,
      select: {
        id: true,
        document_number: true,
        document_date: true,
        grand_total: true,
        status: true
      }
    });
  }

  /**
   * Places a self-service order from the retailer.
   */
  async placeOrder(partyId: string, payload: RetailerOrderPayload) {
    const party = await this.prisma.party.findUnique({ where: { id: partyId } });
    if (!party) throw new NotFoundException('Retailer not found');

    let total = new Prisma.Decimal(0);
    const linesData = payload.lines.map(line => {
      const lineTotal = new Prisma.Decimal(line.quantity).mul(line.rate);
      total = total.add(lineTotal);
      return {
        item_id: line.item_id,
        unit_id: line.unit_id,
        ordered_quantity: line.quantity,
        rate: line.rate,
        line_total: lineTotal
      };
    });

    // Create Sales Order
    const order = await this.prisma.salesOrder.create({
      data: {
        company_id: payload.company_id,
        branch_id: payload.branch_id,
        party_id: partyId,
        document_number: `RET-${Date.now()}`,
        document_date: new Date(),
        status: 'CONFIRMED', // Directly confirmed for processing
        total: total,
        notes: 'Order placed via Retailer Portal',
        lines: {
          create: linesData
        }
      }
    });

    return order;
  }
}
