import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma, TaxClass } from '@prisma/client';

export interface GstCalculationResult {
  taxable_amount: Prisma.Decimal;
  cgst_amount: Prisma.Decimal;
  sgst_amount: Prisma.Decimal;
  igst_amount: Prisma.Decimal;
  total_tax_amount: Prisma.Decimal;
  total_amount: Prisma.Decimal;
  is_interstate: boolean;
}

@Injectable()
export class GstService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates GST for a single line item based on Party and Company states
   */
  calculateGstForLine(
    partyStateOrCode: string | null,
    companyStateOrCode: string | null,
    taxableAmount: number | Prisma.Decimal,
    taxClass: TaxClass
  ): GstCalculationResult {
    const amount = new Prisma.Decimal(taxableAmount.toString());
    const isInterstate = this.checkInterstate(partyStateOrCode, companyStateOrCode);

    let cgstAmount = new Prisma.Decimal(0);
    let sgstAmount = new Prisma.Decimal(0);
    let igstAmount = new Prisma.Decimal(0);

    if (isInterstate) {
      igstAmount = amount.mul(taxClass.igst_rate).div(100);
    } else {
      cgstAmount = amount.mul(taxClass.cgst_rate).div(100);
      sgstAmount = amount.mul(taxClass.sgst_rate).div(100);
    }

    const totalTaxAmount = cgstAmount.add(sgstAmount).add(igstAmount);
    const totalAmount = amount.add(totalTaxAmount);

    return {
      taxable_amount: amount,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      total_tax_amount: totalTaxAmount,
      total_amount: totalAmount,
      is_interstate: isInterstate
    };
  }

  private checkInterstate(partyState: string | null, companyState: string | null): boolean {
    if (!partyState || !companyState) {
      // Default to intra-state if states are unknown
      return false;
    }
    return partyState.trim().toLowerCase() !== companyState.trim().toLowerCase();
  }

  /**
   * Mocks the generation of an E-Way Bill for an invoice exceeding the threshold.
   * Standard threshold in India is ₹50,000 for interstate and varies for intrastate.
   */
  async generateMockEwayBill(invoiceId: string, invoiceAmount: number): Promise<{ eway_bill_no: string; valid_until: Date }> {
    if (invoiceAmount < 50000) {
      throw new BadRequestException('E-Way Bill generation not mandatory for amounts less than ₹50,000 (standard threshold)');
    }

    // Mock API call delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate random 12-digit E-Way Bill Number
    const ewbNo = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 1); // Valid for 1 day as mock

    return {
      eway_bill_no: ewbNo,
      valid_until: validUntil,
    };
  }

  /**
   * Retrieves summary data for GSTR-1 (Outward Supplies)
   * This is a simplified mock representation querying Sales Invoices.
   */
  async getGstr1Summary(companyId: string, fromDate: string, toDate: string) {
    // In a real scenario, this would aggregate by HSN, B2B, B2C etc.
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        company_id: companyId,
        invoice_date: {
          gte: new Date(fromDate),
          lte: new Date(toDate)
        },
        status: { not: 'DRAFT' } // Only count confirmed/posted invoices
      },
      include: {
        party: true,
        lines: {
          include: { item: { include: { tax_class: true } } }
        }
      }
    });

    let totalTaxable = new Prisma.Decimal(0);
    let totalCgst = new Prisma.Decimal(0);
    let totalSgst = new Prisma.Decimal(0);
    let totalIgst = new Prisma.Decimal(0);

    for (const inv of invoices) {
      totalTaxable = totalTaxable.add(inv.taxable_amount || 0); // Assuming net_amount is taxable
      // Normally we'd sum the exact tax lines from the invoice
      // If we don't have separate tax amounts on SalesInvoice model, we'd calculate or fetch from voucher
    }

    return {
      total_invoices: invoices.length,
      total_taxable_value: totalTaxable,
      total_cgst: totalCgst,
      total_sgst: totalSgst,
      total_igst: totalIgst,
      // We would return b2b, b2c, hsn_wise_summary arrays here
    };
  }
}
