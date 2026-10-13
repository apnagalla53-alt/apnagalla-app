import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PharmacyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates if a party is authorized to purchase specific restricted drugs (e.g., Schedule H, Narcotics).
   * Since there are no native drug_license fields, we simulate this by checking if the party is blocked
   * or by checking a mocked list of restricted items.
   */
  async validatePharmacySale(partyId: string, itemIds: string[]) {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId }
    });

    if (!party) {
      throw new NotFoundException('Party not found');
    }

    if (party.is_blocked) {
      throw new BadRequestException(`Cannot sell to ${party.name}: License suspended or party blocked (Reason: ${party.block_reason || 'Unknown'})`);
    }

    const items = await this.prisma.item.findMany({
      where: { id: { in: itemIds } }
    });

    // Mock Restricted Items validation
    // In a real system, items would have `is_schedule_h` or `narcotic_class` fields.
    // We'll simulate by checking if the item name contains "(Sch H)" or "(Narcotic)".
    const restrictedItems = items.filter(item => 
      item.name.toLowerCase().includes('(sch h)') || 
      item.name.toLowerCase().includes('(narcotic)')
    );

    if (restrictedItems.length > 0) {
      // Suppose we have a strict mock rule: Retailers (walk-ins) cannot buy restricted items directly
      // without a prescription ID (which we skip for B2B). For B2B, party_type CUSTOMER needs license.
      // We will assume "walk-in" parties cannot buy them.
      if (party.is_walkin) {
        const itemNames = restrictedItems.map(i => i.name).join(', ');
        throw new BadRequestException(`Restricted drugs (${itemNames}) cannot be sold to walk-in customers without prescription verification.`);
      }
    }

    return { valid: true, restricted_items_flagged: restrictedItems.length };
  }

  /**
   * Generates a Narcotic Drug Register report (mocked).
   */
  async getNarcoticRegister(companyId: string, fromDate: string, toDate: string) {
    // Queries Sales Invoices containing items with "(Narcotic)" in the name.
    const invoices = await this.prisma.salesInvoiceLine.findMany({
      where: {
        sales_invoice: {
          company_id: companyId,
          document_date: {
            gte: new Date(fromDate),
            lte: new Date(toDate)
          },
          status: 'POSTED'
        },
        item: {
          name: { contains: '(Narcotic)', mode: 'insensitive' }
        }
      },
      include: {
        item: true,
        sales_invoice: {
          include: { party: true }
        }
      }
    });

    return invoices.map(invLine => ({
      date: invLine.sales_invoice.document_date,
      document_number: invLine.sales_invoice.document_number,
      party_name: invLine.sales_invoice.party.name,
      item_name: invLine.item.name,
      quantity_sold: invLine.quantity
    }));
  }
}
