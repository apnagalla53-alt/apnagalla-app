import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PurchaseConversionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Purchase Order -> Goods Receipt (Partial/Full) ──────────────────────
  async convertPurchaseOrderToGoodsReceipt(companyId: string, purchaseOrderId: string, userId: string, conversionData: any) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { lines: true }
      });

      if (!order) throw new BadRequestException('Purchase Order not found');
      if (order.company_id !== companyId) throw new ForbiddenException('Isolation violation');
      if (order.status !== 'CONFIRMED' && order.status !== 'PARTIALLY_RECEIVED') {
        throw new BadRequestException('Only CONFIRMED or PARTIALLY_RECEIVED orders can be converted');
      }

      const conversionLines = conversionData.lines || []; // { order_line_id, godown_id, quantity }
      if (conversionLines.length === 0) throw new BadRequestException('No lines provided for conversion');

      const grnLinesToCreate: any[] = [];
      
      for (const reqLine of conversionLines) {
        const oLine = order.lines.find(l => l.id === reqLine.order_line_id);
        if (!oLine) throw new BadRequestException(`Line ${reqLine.order_line_id} not found in order`);

        const reqQty = new Prisma.Decimal(reqLine.quantity);
        if (reqQty.lte(0)) throw new BadRequestException('Conversion quantity must be positive');

        // Check already drafted or posted received quantity
        // received_quantity only tracks POSTED GRNs. We must also aggregate DRAFT GRNs to prevent over-drafting.
        const existingDrafts = await tx.goodsReceiptLine.aggregate({
          where: {
            purchase_order_line_id: oLine.id,
            goods_receipt: { status: 'DRAFT' }
          },
          _sum: { received_quantity: true }
        });
        
        const draftQty = existingDrafts._sum.received_quantity || new Prisma.Decimal(0);
        const receivedQty = new Prisma.Decimal(oLine.received_quantity);
        const orderedQty = new Prisma.Decimal(oLine.ordered_quantity);

        const availableQty = orderedQty.sub(receivedQty).sub(draftQty);

        if (reqQty.gt(availableQty)) {
          throw new BadRequestException(`Requested quantity ${reqQty.toString()} exceeds available quantity ${availableQty.toString()} for item ${oLine.item_id}`);
        }

        grnLinesToCreate.push({
          item_id: oLine.item_id,
          godown_id: reqLine.godown_id,
          unit_id: oLine.unit_id,
          received_quantity: reqQty,
          purchase_order_line_id: oLine.id
        });
      }

      const newDocumentNumber = conversionData.document_number || `GRN-${Date.now()}`;

      const grn = await tx.goodsReceipt.create({
        data: {
          company_id: order.company_id,
          branch_id: order.branch_id,
          party_id: order.party_id,
          purchase_order_id: order.id,
          document_number: newDocumentNumber,
          document_date: conversionData.document_date ? new Date(conversionData.document_date) : new Date(),
          status: 'DRAFT',
          lines: { create: grnLinesToCreate }
        },
        include: { lines: true }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          company_id: order.company_id,
          branch_id: order.branch_id,
          user_id: userId,
          action: 'PO_CONVERTED_TO_GRN',
          source_document_type: 'PURCHASE_ORDER',
          source_document_id: order.id
        }
      });

      return grn;
    });
  }

  // ── Goods Receipt -> Purchase Invoice ─────────────────────────────────────
  async convertGoodsReceiptToPurchaseInvoice(companyId: string, grnId: string, userId: string, conversionData: any) {
    return this.prisma.$transaction(async (tx) => {
      const grn = await tx.goodsReceipt.findUnique({
        where: { id: grnId },
        include: { lines: { include: { purchase_order_line: true } } }
      });

      if (!grn) throw new BadRequestException('Goods Receipt not found');
      if (grn.company_id !== companyId) throw new ForbiddenException('Isolation violation');
      if (grn.status !== 'POSTED') throw new BadRequestException('Only POSTED GRNs can be invoiced');

      // Prevent double invoicing (Idempotency)
      const existingInvoice = await tx.purchaseInvoiceLine.findFirst({
        where: { goods_receipt_line_id: { in: grn.lines.map(l => l.id) } },
        include: { purchase_invoice: true }
      });

      if (existingInvoice && existingInvoice.purchase_invoice.status !== 'CANCELLED') {
         throw new BadRequestException('GRN is already invoiced');
      }

      let taxableAmount = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);
      let discountAmount = new Prisma.Decimal(0);
      let grandTotal = new Prisma.Decimal(0);

      const invLines = grn.lines.map(l => {
        const qty = new Prisma.Decimal(l.received_quantity);
        // Inherit rate from PO line
        const rate = l.purchase_order_line ? new Prisma.Decimal(l.purchase_order_line.rate) : new Prisma.Decimal(0);
        const discount = l.purchase_order_line ? new Prisma.Decimal(l.purchase_order_line.discount) : new Prisma.Decimal(0);
        
        const taxableValue = qty.mul(rate).sub(discount);
        const tax = new Prisma.Decimal(0); // Simplified tax
        const lineTotal = taxableValue.add(tax);

        taxableAmount = taxableAmount.add(taxableValue);
        taxAmount = taxAmount.add(tax);
        discountAmount = discountAmount.add(discount);
        grandTotal = grandTotal.add(lineTotal);

        return {
          item_id: l.item_id,
          godown_id: l.godown_id,
          unit_id: l.unit_id,
          quantity: qty,
          rate: rate,
          discount_amount: discount,
          taxable_value: taxableValue,
          tax_amount: tax,
          line_total: lineTotal,
          goods_receipt_line_id: l.id,
          purchase_order_line_id: l.purchase_order_line_id
        };
      });

      const newDocumentNumber = conversionData.document_number || `PI-${Date.now()}`;

      // Use the active financial year
      const fy = await tx.financialYear.findFirst({
        where: { company_id: grn.company_id, is_active: true }
      });
      if (!fy) throw new BadRequestException('No active financial year found');

      const inv = await tx.purchaseInvoice.create({
        data: {
          company_id: grn.company_id,
          branch_id: grn.branch_id,
          party_id: grn.party_id,
          financial_year_id: fy.id,
          supplier_invoice_number: conversionData.supplier_invoice_number,
          supplier_invoice_date: conversionData.supplier_invoice_date ? new Date(conversionData.supplier_invoice_date) : undefined,
          document_number: newDocumentNumber,
          document_date: conversionData.document_date ? new Date(conversionData.document_date) : new Date(),
          due_date: conversionData.due_date ? new Date(conversionData.due_date) : undefined,
          payment_terms_days: conversionData.payment_terms_days,
          status: 'DRAFT',
          taxable_amount: taxableAmount,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          grand_total: grandTotal,
          lines: { create: invLines }
        },
        include: { lines: true }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          company_id: grn.company_id,
          branch_id: grn.branch_id,
          user_id: userId,
          action: 'GRN_CONVERTED_TO_INVOICE',
          source_document_type: 'GOODS_RECEIPT',
          source_document_id: grn.id
        }
      });

      return inv;
    });
  }
}
