import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

import { PricingEngineService } from '../pricing/pricing-engine.service';

@Injectable()
export class SalesConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEngine: PricingEngineService
  ) {}

  // ── Quotation -> Sales Order ──────────────────────────────────────────────
  async convertQuotationToSalesOrder(companyId: string, quotationId: string, userId: string, conversionData: any) {
    return this.prisma.$transaction(async (tx) => {
      const quotation = await tx.salesQuotation.findUnique({
        where: { id: quotationId },
        include: { lines: true }
      });

      if (!quotation) throw new BadRequestException('Quotation not found');
      if (quotation.company_id !== companyId) throw new ForbiddenException('Isolation violation');
      if (quotation.status === 'CONVERTED') throw new BadRequestException('Quotation already converted');
      if (quotation.status !== 'ACCEPTED' && quotation.status !== 'SENT') {
         throw new BadRequestException('Only ACCEPTED or SENT quotations can be converted');
      }

      // Check if already converted to an SO (Idempotency fallback)
      const existingSo = await tx.salesOrder.findFirst({
        where: { sales_quotation_id: quotation.id }
      });
      if (existingSo) throw new BadRequestException('Quotation is already converted to a Sales Order');

      // Create Sales Order
      const newDocumentNumber = conversionData.document_number || `SO-${Date.now()}`;
      
      const soLines = quotation.lines.map(l => ({
        item_id: l.item_id,
        unit_id: l.unit_id,
        ordered_quantity: l.quantity,
        free_quantity: l.free_quantity,
        rate: l.rate,
        discount: l.discount,
        tax: l.tax,
        line_total: l.line_total,
        pricing_trace_json: l.pricing_trace_json,
        sales_quotation_line_id: l.id
      }));

      const so = await tx.salesOrder.create({
        data: {
          company_id: quotation.company_id,
          branch_id: quotation.branch_id,
          party_id: quotation.party_id,
          sales_quotation_id: quotation.id,
          document_number: newDocumentNumber,
          document_date: conversionData.document_date ? new Date(conversionData.document_date) : new Date(),
          status: 'DRAFT',
          total: quotation.total,
          notes: quotation.notes,
          lines: { create: soLines }
        },
        include: { lines: true }
      });

      // 3. Preserve Pricing Trace Lineage
      const tracePayload = so.lines
        .filter(l => l.pricing_trace_json)
        .map(l => ({
          lineId: l.id,
          pricingTrace: JSON.parse(l.pricing_trace_json as string)
        }));

      if (tracePayload.length > 0) {
        await this.pricingEngine.recordPricingTraces(
          companyId,
          'SALES_ORDER',
          so.id,
          tracePayload,
          tx
        );
      }

      // Update Quotation Status
      await tx.salesQuotation.update({
        where: { id: quotation.id },
        data: { status: 'CONVERTED' }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          company_id: quotation.company_id,
          branch_id: quotation.branch_id,
          user_id: userId,
          action: 'QUOTATION_CONVERTED_TO_SO',
          source_document_type: 'SALES_QUOTATION',
          source_document_id: quotation.id
        }
      });

      return so;
    });
  }

  // ── Sales Order -> Delivery Challan (Partial/Full) ──────────────────────
  async convertSalesOrderToDeliveryChallan(companyId: string, salesOrderId: string, userId: string, conversionData: any) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: { lines: true }
      });

      if (!order) throw new BadRequestException('Sales Order not found');
      if (order.company_id !== companyId) throw new ForbiddenException('Isolation violation');
      if (order.status !== 'CONFIRMED' && order.status !== 'PARTIALLY_DELIVERED') {
        throw new BadRequestException('Only CONFIRMED or PARTIALLY_DELIVERED orders can be converted');
      }

      const conversionLines = conversionData.lines || []; // { order_line_id, godown_id, quantity }
      if (conversionLines.length === 0) throw new BadRequestException('No lines provided for conversion');

      const dcLinesToCreate: any[] = [];
      
      for (const reqLine of conversionLines) {
        const oLine = order.lines.find(l => l.id === reqLine.order_line_id);
        if (!oLine) throw new BadRequestException(`Line ${reqLine.order_line_id} not found in order`);

        const reqQty = new Prisma.Decimal(reqLine.quantity);
        if (reqQty.lte(0)) throw new BadRequestException('Conversion quantity must be positive');

        const orderedQty = new Prisma.Decimal(oLine.ordered_quantity);
        const fraction = reqQty.div(orderedQty);
        const freeQtyToDispatch = oLine.free_quantity ? new Prisma.Decimal(oLine.free_quantity).mul(fraction) : new Prisma.Decimal(0);

        // Check already drafted or dispatched quantity
        // The authoritative delivered_quantity ONLY tracks POSTED challans.
        // We must also sum up DRAFT challans to prevent draft over-allocation race condition!
        const existingDrafts = await tx.deliveryChallanLine.aggregate({
          where: {
            sales_order_line_id: oLine.id,
            delivery_challan: { status: 'DRAFT' }
          },
          _sum: { dispatched_quantity: true }
        });
        
        const draftQty = existingDrafts._sum.dispatched_quantity || new Prisma.Decimal(0);
        const deliveredQty = new Prisma.Decimal(oLine.delivered_quantity);

        const availableQty = orderedQty.sub(deliveredQty).sub(draftQty);

        if (reqQty.gt(availableQty)) {
          throw new BadRequestException(`Requested quantity ${reqQty.toString()} exceeds available quantity ${availableQty.toString()} for item ${oLine.item_id}`);
        }

        dcLinesToCreate.push({
          item_id: oLine.item_id,
          godown_id: reqLine.godown_id,
          unit_id: oLine.unit_id,
          dispatched_quantity: reqQty,
          free_quantity: freeQtyToDispatch,
          sales_order_line_id: oLine.id
        });
      }

      const newDocumentNumber = conversionData.document_number || `DC-${Date.now()}`;

      const dc = await tx.deliveryChallan.create({
        data: {
          company_id: order.company_id,
          branch_id: order.branch_id,
          party_id: order.party_id,
          sales_order_id: order.id,
          document_number: newDocumentNumber,
          document_date: conversionData.document_date ? new Date(conversionData.document_date) : new Date(),
          status: 'DRAFT',
          lines: { create: dcLinesToCreate }
        },
        include: { lines: true }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          company_id: order.company_id,
          branch_id: order.branch_id,
          user_id: userId,
          action: 'SO_CONVERTED_TO_DC',
          source_document_type: 'SALES_ORDER',
          source_document_id: order.id
        }
      });

      return dc;
    });
  }

  // ── Delivery Challan -> Sales Invoice ─────────────────────────────────────
  async convertDeliveryChallanToSalesInvoice(companyId: string, challanId: string, userId: string, conversionData: any) {
    return this.prisma.$transaction(async (tx) => {
      const challan = await tx.deliveryChallan.findUnique({
        where: { id: challanId },
        include: { lines: { include: { sales_order_line: true } } }
      });

      if (!challan) throw new BadRequestException('Delivery Challan not found');
      if (challan.company_id !== companyId) throw new ForbiddenException('Isolation violation');
      if (challan.status !== 'DISPATCHED') throw new BadRequestException('Only DISPATCHED challans can be invoiced');

      // Prevent double invoicing (Idempotency)
      const existingInvoice = await tx.salesInvoiceLine.findFirst({
        where: { delivery_challan_line_id: { in: challan.lines.map(l => l.id) } },
        include: { sales_invoice: true }
      });

      if (existingInvoice && existingInvoice.sales_invoice.status !== 'CANCELLED') {
         throw new BadRequestException('Challan is already invoiced');
      }

      let taxableAmount = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);
      let discountAmount = new Prisma.Decimal(0);
      let grandTotal = new Prisma.Decimal(0);

      const invLines = challan.lines.map(l => {
        const qty = new Prisma.Decimal(l.dispatched_quantity);
        const freeQty = l.free_quantity ? new Prisma.Decimal(l.free_quantity) : new Prisma.Decimal(0);

        // Inherit rate from Sales Order Line if exists, else 0 or fallback
        const rate = l.sales_order_line ? new Prisma.Decimal(l.sales_order_line.rate) : new Prisma.Decimal(0);
        const discount = l.sales_order_line ? new Prisma.Decimal(l.sales_order_line.discount) : new Prisma.Decimal(0);
        const traceJson = l.sales_order_line ? l.sales_order_line.pricing_trace_json : null;
        
        const taxableValue = qty.mul(rate).sub(discount);
        const tax = new Prisma.Decimal(0); // Assuming no complex tax calc here for simplicity
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
          free_quantity: freeQty,
          rate: rate,
          discount_amount: discount,
          taxable_value: taxableValue,
          tax_amount: tax,
          line_total: lineTotal,
          pricing_trace_json: traceJson,
          delivery_challan_line_id: l.id,
          sales_order_line_id: l.sales_order_line_id
        };
      });

      const newDocumentNumber = conversionData.document_number || `INV-${Date.now()}`;

      // We use the active financial year
      const fy = await tx.financialYear.findFirst({
        where: { company_id: challan.company_id, is_active: true }
      });
      if (!fy) throw new BadRequestException('No active financial year found');

      const inv = await tx.salesInvoice.create({
        data: {
          company_id: challan.company_id,
          branch_id: challan.branch_id,
          party_id: challan.party_id,
          financial_year_id: fy.id,
          document_number: newDocumentNumber,
          document_date: conversionData.document_date ? new Date(conversionData.document_date) : new Date(),
          due_date: conversionData.due_date ? new Date(conversionData.due_date) : undefined,
          status: 'DRAFT',
          taxable_amount: taxableAmount,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          grand_total: grandTotal,
          lines: { create: invLines }
        },
        include: { lines: true }
      });

      // Preserve Pricing Trace Lineage (Scaled)
      const tracePayload = inv.lines
        .filter(l => l.pricing_trace_json)
        .map(l => {
           const trace = JSON.parse(l.pricing_trace_json as string);
           const originalCharged = new Prisma.Decimal(trace.chargedQuantity);
           const fraction = originalCharged.gt(0) ? new Prisma.Decimal(l.quantity).div(originalCharged) : new Prisma.Decimal(0);

           trace.originalQuantity = new Prisma.Decimal(trace.originalQuantity).mul(fraction).toString();
           trace.chargedQuantity = new Prisma.Decimal(trace.chargedQuantity).mul(fraction).toString();
           trace.freeQuantity = new Prisma.Decimal(trace.freeQuantity).mul(fraction).toString();
           trace.discountAmount = new Prisma.Decimal(trace.discountAmount).mul(fraction).toString();
           trace.finalLineAmount = new Prisma.Decimal(trace.finalLineAmount).mul(fraction).toString();
           
           return {
             lineId: l.id,
             pricingTrace: trace
           };
        });

      if (tracePayload.length > 0) {
        await this.pricingEngine.recordPricingTraces(
          companyId,
          'SALES_INVOICE',
          inv.id,
          tracePayload,
          tx
        );
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          company_id: challan.company_id,
          branch_id: challan.branch_id,
          user_id: userId,
          action: 'DC_CONVERTED_TO_INVOICE',
          source_document_type: 'DELIVERY_CHALLAN',
          source_document_id: challan.id
        }
      });

      return inv;
    });
  }
}
