import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { CreateDeliveryChallanDto } from './dto/create-delivery-challan.dto';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { CreateSalesQuotationDto } from './dto/create-sales-quotation.dto';
import { PricingEngineService } from '../pricing/pricing-engine.service';
import { CreditService } from '../accounting/credit.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEngine: PricingEngineService,
    private readonly creditService: CreditService,
  ) {}

  private async validateIsolation(companyId: string, payload: any, items: { item_id: string, godown_id?: string, unit_id: string }[]) {
    if (payload.branch_id) {
      const branch = await this.prisma.branch.findUnique({ where: { id: payload.branch_id } });
      if (!branch || branch.company_id !== companyId) throw new BadRequestException('Branch does not belong to the company');
    }

    if (payload.party_id) {
      const party = await this.prisma.party.findUnique({ where: { id: payload.party_id } });
      if (!party || party.company_id !== companyId) throw new BadRequestException('Party does not belong to the company');
    }

    for (const item of items) {
      const dbItem = await this.prisma.item.findUnique({ where: { id: item.item_id } });
      if (!dbItem || dbItem.company_id !== companyId) throw new BadRequestException(`Item ${item.item_id} does not belong to the company`);

      const dbUnit = await this.prisma.unit.findUnique({ where: { id: item.unit_id } });
      if (!dbUnit || dbUnit.company_id !== companyId) throw new BadRequestException(`Unit ${item.unit_id} does not belong to the company`);

      if (item.godown_id) {
        const dbGodown = await this.prisma.godown.findUnique({
          where: { id: item.godown_id },
          include: { branch: true }
        });
        if (!dbGodown || dbGodown.branch.company_id !== companyId) throw new BadRequestException(`Godown ${item.godown_id} does not belong to the company`);
      }
    }
  }

  // --- Sales Quotation ---

  async createSalesQuotation(companyId: string, dto: CreateSalesQuotationDto) {
    await this.validateIsolation(companyId, dto, dto.lines.map(l => ({ item_id: l.item_id, unit_id: l.unit_id })));

    let grandTotal = new Prisma.Decimal(0);
    const linePricingResults: any[] = [];
    const lines = [];

    for (const line of dto.lines) {
      const lineQty = new Prisma.Decimal(line.quantity);
      const pricingRes = await this.pricingEngine.calculateLinePricing(
        companyId,
        dto.party_id,
        {
          itemId: line.item_id,
          quantity: lineQty,
          unitId: line.unit_id,
          overrideRate: line.rate !== undefined && Number(line.rate) > 0 ? line.rate : undefined,
          overrideDiscountAmount: line.discount !== undefined && Number(line.discount) > 0 ? line.discount : undefined,
        },
        { branchId: dto.branch_id, documentDate: dto.document_date },
      );

      grandTotal = grandTotal.add(pricingRes.lineTotal);
      linePricingResults.push(pricingRes);

      lines.push({
        item_id: line.item_id,
        unit_id: line.unit_id,
        quantity: lineQty,
        free_quantity: pricingRes.freeQuantity,
        rate: pricingRes.resolvedRate,
        discount: pricingRes.discountAmount,
        tax: new Prisma.Decimal(0),
        line_total: pricingRes.lineTotal,
        pricing_trace_json: JSON.stringify(pricingRes.pricingTrace),
      });

      if (pricingRes.promotionalLines) {
        for (const pline of pricingRes.promotionalLines) {
          lines.push({
            item_id: pline.itemId,
            unit_id: pline.unitId || line.unit_id,
            quantity: pline.originalQuantity,
            free_quantity: pline.freeQuantity,
            rate: pline.resolvedRate,
            discount: pline.discountAmount,
            tax: new Prisma.Decimal(0),
            line_total: pline.lineTotal,
            pricing_trace_json: JSON.stringify(pline.pricingTrace),
          });
          linePricingResults.push(pline as any);
        }
      }
    }

    const quotation = await this.prisma.salesQuotation.create({
      data: {
        company_id: companyId,
        branch_id: dto.branch_id,
        party_id: dto.party_id,
        document_number: dto.document_number,
        document_date: new Date(dto.document_date),
        valid_until: dto.valid_until ? new Date(dto.valid_until) : undefined,
        notes: dto.notes,
        status: 'DRAFT',
        total: grandTotal,
        lines: { create: lines }
      },
      include: { lines: true }
    });

    await this.pricingEngine.recordPricingTraces(
      companyId,
      'SALES_QUOTATION',
      quotation.id,
      quotation.lines.map((ql, idx) => ({
        lineId: ql.id,
        pricingTrace: linePricingResults[idx].pricingTrace,
      })),
    );

    return quotation;
  }

  async getSalesQuotation(companyId: string, id: string) {
    const quote = await this.prisma.salesQuotation.findUnique({ where: { id }, include: { lines: true } });
    if (!quote || quote.company_id !== companyId) throw new NotFoundException('Sales Quotation not found');
    return quote;
  }

  async updateQuotationStatus(companyId: string, id: string, status: string, userId: string) {
    const quote = await this.prisma.salesQuotation.findUnique({ where: { id } });
    if (!quote || quote.company_id !== companyId) throw new NotFoundException('Sales Quotation not found');
    
    // Allow state transitions: DRAFT -> SENT -> ACCEPTED -> REJECTED
    // Let's assume it just sets the status and logs it
    return this.prisma.salesQuotation.update({
      where: { id },
      data: { status, posted_by: userId }
    });
  }

  // --- Sales Order ---

  async createSalesOrder(companyId: string, dto: CreateSalesOrderDto) {
    await this.validateIsolation(companyId, dto, dto.lines.map(l => ({ item_id: l.item_id, unit_id: l.unit_id })));

    let grandTotal = new Prisma.Decimal(0);
    const linePricingResults: any[] = [];
    const lines = [];

    for (const line of dto.lines) {
      const lineQty = new Prisma.Decimal(line.ordered_quantity);
      const pricingRes = await this.pricingEngine.calculateLinePricing(
        companyId,
        dto.party_id,
        {
          itemId: line.item_id,
          quantity: lineQty,
          unitId: line.unit_id,
          overrideRate: line.rate !== undefined && Number(line.rate) > 0 ? line.rate : undefined,
          overrideDiscountAmount: line.discount !== undefined && Number(line.discount) > 0 ? line.discount : undefined,
        },
        { branchId: dto.branch_id, documentDate: dto.document_date },
      );

      grandTotal = grandTotal.add(pricingRes.lineTotal);
      linePricingResults.push(pricingRes);

      lines.push({
        item_id: line.item_id,
        unit_id: line.unit_id,
        ordered_quantity: lineQty,
        free_quantity: pricingRes.freeQuantity,
        rate: pricingRes.resolvedRate,
        discount: pricingRes.discountAmount,
        tax: new Prisma.Decimal(0),
        line_total: pricingRes.lineTotal,
        pricing_trace_json: JSON.stringify(pricingRes.pricingTrace),
      });

      if (pricingRes.promotionalLines) {
        for (const pline of pricingRes.promotionalLines) {
          lines.push({
            item_id: pline.itemId,
            unit_id: pline.unitId || line.unit_id,
            ordered_quantity: pline.originalQuantity,
            free_quantity: pline.freeQuantity,
            rate: pline.resolvedRate,
            discount: pline.discountAmount,
            tax: new Prisma.Decimal(0),
            line_total: pline.lineTotal,
            pricing_trace_json: JSON.stringify(pline.pricingTrace),
          });
          linePricingResults.push(pline as any);
        }
      }
    }

    const creditRes = await this.creditService.checkCreditLimit(companyId, dto.party_id, grandTotal);
    if (!creditRes.allowed) {
      throw new BadRequestException(`Credit limit exceeded or party blocked: ${creditRes.reason}`);
    }

    const order = await this.prisma.salesOrder.create({
      data: {
        company_id: companyId,
        branch_id: dto.branch_id,
        party_id: dto.party_id,
        document_number: dto.document_number,
        document_date: new Date(dto.document_date),
        expected_delivery_date: dto.expected_delivery_date ? new Date(dto.expected_delivery_date) : undefined,
        notes: dto.notes,
        status: 'DRAFT',
        total: grandTotal,
        lines: { create: lines }
      },
      include: { lines: true }
    });

    await this.pricingEngine.recordPricingTraces(
      companyId,
      'SALES_ORDER',
      order.id,
      order.lines.map((ol, idx) => ({
        lineId: ol.id,
        pricingTrace: linePricingResults[idx].pricingTrace,
      })),
    );

    return order;
  }

  async getSalesOrder(companyId: string, id: string) {
    const order = await this.prisma.salesOrder.findUnique({ where: { id }, include: { lines: true } });
    if (!order || order.company_id !== companyId) throw new NotFoundException('Sales Order not found');
    return order;
  }

  async confirmSalesOrder(companyId: string, id: string, userId: string) {
    const order = await this.prisma.salesOrder.findUnique({ where: { id } });
    if (!order || order.company_id !== companyId) throw new NotFoundException('Sales Order not found');
    if (order.status !== 'DRAFT') throw new BadRequestException('Only DRAFT orders can be confirmed');

    return this.prisma.salesOrder.update({
      where: { id },
      data: { status: 'CONFIRMED', posted_by: userId }
    });
  }

  // --- Delivery Challan ---

  async createDeliveryChallan(companyId: string, dto: CreateDeliveryChallanDto) {
    await this.validateIsolation(companyId, dto, dto.lines.map(l => ({ item_id: l.item_id, godown_id: l.godown_id, unit_id: l.unit_id })));

    if (dto.sales_order_id) {
      const order = await this.prisma.salesOrder.findUnique({ where: { id: dto.sales_order_id } });
      if (!order || order.company_id !== companyId) throw new BadRequestException('Invalid Sales Order reference');
      if (order.status !== 'CONFIRMED' && order.status !== 'PARTIALLY_DELIVERED') {
        throw new BadRequestException(`Cannot create delivery challan for order in status ${order.status}`);
      }
    }

    const lines = dto.lines.map(line => ({
      item_id: line.item_id,
      godown_id: line.godown_id,
      unit_id: line.unit_id,
      dispatched_quantity: new Prisma.Decimal(line.dispatched_quantity),
      sales_order_line_id: line.sales_order_line_id,
    }));

    return this.prisma.deliveryChallan.create({
      data: {
        company_id: companyId,
        branch_id: dto.branch_id,
        party_id: dto.party_id,
        sales_order_id: dto.sales_order_id,
        document_number: dto.document_number,
        document_date: new Date(dto.document_date),
        status: 'DRAFT',
        lines: { create: lines }
      },
      include: { lines: true }
    });
  }

  async getDeliveryChallan(companyId: string, id: string) {
    const challan = await this.prisma.deliveryChallan.findUnique({ where: { id }, include: { lines: true } });
    if (!challan || challan.company_id !== companyId) throw new NotFoundException('Delivery Challan not found');
    return challan;
  }

  // --- Sales Invoice ---

  async createSalesInvoice(companyId: string, dto: CreateSalesInvoiceDto) {
    await this.validateIsolation(companyId, dto, dto.lines.map(l => ({ item_id: l.item_id, godown_id: l.godown_id, unit_id: l.unit_id })));

    let taxableAmount = new Prisma.Decimal(0);
    let taxAmount = new Prisma.Decimal(0);
    let discountAmount = new Prisma.Decimal(0);
    let grandTotal = new Prisma.Decimal(0);

    const linePricingResults: any[] = [];
    const lines = [];

    for (const line of dto.lines) {
      const lineQty = new Prisma.Decimal(line.quantity);
      const pricingRes = await this.pricingEngine.calculateLinePricing(
        companyId,
        dto.party_id,
        {
          itemId: line.item_id,
          quantity: lineQty,
          unitId: line.unit_id,
          overrideRate: line.rate !== undefined && Number(line.rate) > 0 ? line.rate : undefined,
          overrideDiscountAmount: line.discount_amount !== undefined && Number(line.discount_amount) > 0 ? line.discount_amount : undefined,
        },
        { branchId: dto.branch_id, documentDate: dto.document_date },
      );

      const lineTax = new Prisma.Decimal(0); // Tax implementation pending
      const lineTotal = pricingRes.taxableValue.add(lineTax);

      taxableAmount = taxableAmount.add(pricingRes.taxableValue);
      taxAmount = taxAmount.add(lineTax);
      discountAmount = discountAmount.add(pricingRes.discountAmount);
      grandTotal = grandTotal.add(lineTotal);

      linePricingResults.push(pricingRes);

      lines.push({
        item_id: line.item_id,
        godown_id: line.godown_id,
        unit_id: line.unit_id,
        quantity: lineQty,
        free_quantity: pricingRes.freeQuantity,
        rate: pricingRes.resolvedRate,
        discount_amount: pricingRes.discountAmount,
        taxable_value: pricingRes.taxableValue,
        tax_amount: lineTax,
        line_total: lineTotal,
        pricing_trace_json: JSON.stringify(pricingRes.pricingTrace),
        sales_order_line_id: line.sales_order_line_id,
        delivery_challan_line_id: line.delivery_challan_line_id,
      });

      if (pricingRes.promotionalLines) {
        for (const pline of pricingRes.promotionalLines) {
          lines.push({
            item_id: pline.itemId,
            godown_id: line.godown_id,
            unit_id: pline.unitId || line.unit_id,
            quantity: pline.originalQuantity,
            free_quantity: pline.freeQuantity,
            rate: pline.resolvedRate,
            discount_amount: pline.discountAmount,
            taxable_value: pline.taxableValue,
            tax_amount: new Prisma.Decimal(0),
            line_total: pline.lineTotal,
            pricing_trace_json: JSON.stringify(pline.pricingTrace),
            sales_order_line_id: undefined,
            delivery_challan_line_id: undefined,
          });
          linePricingResults.push(pline as any);
        }
      }
    }

    const creditRes = await this.creditService.checkCreditLimit(companyId, dto.party_id, grandTotal);
    if (!creditRes.allowed) {
      throw new BadRequestException(`Credit limit exceeded or party blocked: ${creditRes.reason}`);
    }

    const invoice = await this.prisma.salesInvoice.create({
      data: {
        company_id: companyId,
        branch_id: dto.branch_id,
        party_id: dto.party_id,
        financial_year_id: dto.financial_year_id,
        document_number: dto.document_number,
        document_date: new Date(dto.document_date),
        due_date: dto.due_date ? new Date(dto.due_date) : undefined,
        payment_terms_days: dto.payment_terms_days,
        status: 'DRAFT',
        taxable_amount: taxableAmount,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        grand_total: grandTotal,
        lines: { create: lines }
      },
      include: { lines: true }
    });

    await this.pricingEngine.recordPricingTraces(
      companyId,
      'SALES_INVOICE',
      invoice.id,
      invoice.lines.map((il, idx) => ({
        lineId: il.id,
        pricingTrace: linePricingResults[idx].pricingTrace,
      })),
    );

    return invoice;
  }

  async getSalesInvoice(companyId: string, id: string) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id },
      include: { lines: true }
    });
    if (!invoice || invoice.company_id !== companyId) {
      throw new NotFoundException('Sales Invoice not found');
    }

    const allocations = await this.prisma.billAllocation.findMany({
      where: { reference_document_type: 'SALES_INVOICE', reference_document_id: id }
    });

    let balance = new Prisma.Decimal(0);
    for (const alloc of allocations) {
      const amt = new Prisma.Decimal(alloc.amount);
      if (alloc.allocation_type === 'NEW_REFERENCE') balance = balance.add(amt);
      else balance = balance.sub(amt);
    }

    // Project fields safely without mutating database
    (invoice as any).outstanding_amount = balance;
    (invoice as any).paid_amount = new Prisma.Decimal(invoice.grand_total).sub(balance);

    return invoice;
  }

  // --- Sales Return ---

  async createSalesReturn(companyId: string, dto: CreateSalesReturnDto) {
    await this.validateIsolation(companyId, dto, dto.lines.map(l => ({ item_id: l.item_id, godown_id: l.godown_id, unit_id: l.unit_id })));

    return this.prisma.$transaction(async (tx) => {
      let invoice: any = null;
      if (dto.original_invoice_id) {
        invoice = await tx.salesInvoice.findUnique({ 
          where: { id: dto.original_invoice_id },
          include: { lines: true }
        });
        if (!invoice || invoice.company_id !== companyId) throw new BadRequestException('Invalid original invoice reference');
        if (invoice.branch_id !== dto.branch_id) throw new BadRequestException('Cannot return an invoice from a different branch');

        for (const line of dto.lines) {
          // Match by item and unit. For stricter matching, original_invoice_line_id should be used, but this is a reasonable heuristic.
          const invoiceLine = invoice.lines.find((l: any) => l.item_id === line.item_id && l.unit_id === line.unit_id);
          if (!invoiceLine) {
            throw new BadRequestException(`Item ${line.item_id} not found in the original invoice`);
          }
          
          const existingReturns = await tx.salesReturnLine.aggregate({
            where: {
              item_id: line.item_id,
              unit_id: line.unit_id,
              sales_return: { original_invoice_id: dto.original_invoice_id, status: { not: 'CANCELLED' } }
            },
            _sum: { quantity: true }
          });

          const returnedQty = existingReturns._sum.quantity || new Prisma.Decimal(0);
          const returningQty = new Prisma.Decimal(line.quantity);
          const maxAllowed = new Prisma.Decimal(invoiceLine.quantity).sub(returnedQty);

          if (returningQty.gt(maxAllowed)) {
            throw new BadRequestException(`Cannot return more than sold quantity. Max allowed for item ${line.item_id} is ${maxAllowed.toString()}`);
          }
        }
      }

      let taxableAmount = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);
      let grandTotal = new Prisma.Decimal(0);

      const lines = dto.lines.map(line => {
        const lineQty = new Prisma.Decimal(line.quantity);
        let lineRate = new Prisma.Decimal(line.rate);
        let lineTax = new Prisma.Decimal(0);
        
        // If we are referencing an original invoice, lock rate and compute proportional historical tax
        if (invoice) {
          const invLine = invoice.lines.find((l: any) => l.item_id === line.item_id && l.unit_id === line.unit_id);
          if (invLine) {
            lineRate = new Prisma.Decimal(invLine.rate);
            if (new Prisma.Decimal(invLine.quantity).gt(0)) {
              const taxPerUnit = new Prisma.Decimal(invLine.tax_amount).div(invLine.quantity);
              lineTax = taxPerUnit.mul(lineQty);
            }
          }
        }

        const taxableValue = lineQty.mul(lineRate);
        const lineTotal = taxableValue.add(lineTax);

        taxableAmount = taxableAmount.add(taxableValue);
        taxAmount = taxAmount.add(lineTax);
        grandTotal = grandTotal.add(lineTotal);

        return {
          item_id: line.item_id,
          godown_id: line.godown_id,
          unit_id: line.unit_id,
          quantity: lineQty,
          rate: lineRate,
          taxable_value: taxableValue,
          tax_amount: lineTax,
          line_total: lineTotal,
        };
      });

      return tx.salesReturn.create({
        data: {
          company_id: companyId,
          branch_id: dto.branch_id,
          party_id: dto.party_id,
          financial_year_id: dto.financial_year_id,
          original_invoice_id: dto.original_invoice_id,
          document_number: dto.document_number,
          document_date: new Date(dto.document_date),
          status: 'DRAFT',
          reason_id: dto.reason_id,
          notes: dto.notes,
          taxable_amount: taxableAmount,
          tax_amount: taxAmount,
          grand_total: grandTotal,
          lines: { create: lines }
        },
        include: { lines: true }
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  async getSalesReturn(companyId: string, id: string) {
    const sr = await this.prisma.salesReturn.findUnique({ where: { id }, include: { lines: true } });
    if (!sr || sr.company_id !== companyId) throw new NotFoundException('Sales Return not found');
    return sr;
  }

  async createReplacement(companyId: string, returnId: string, userId: string, dto: any) {
    return this.prisma.$transaction(async (tx) => {
      const salesReturn = await tx.salesReturn.findUnique({
        where: { id: returnId },
        include: { lines: true }
      });
      if (!salesReturn || salesReturn.company_id !== companyId) throw new NotFoundException('Sales Return not found');
      if (salesReturn.status !== 'POSTED') throw new BadRequestException('Can only replace a POSTED Sales Return');

      const lines = [];
      for (const line of dto.lines) {
        const returnLine = salesReturn.lines.find((l: any) => l.item_id === line.item_id && l.unit_id === line.unit_id);
        if (!returnLine) throw new BadRequestException(`Item ${line.item_id} not found in the original return`);

        const lineQty = new Prisma.Decimal(line.quantity);
        
        const existingReplacements = await tx.salesInvoiceLine.aggregate({
          where: {
            item_id: line.item_id,
            unit_id: line.unit_id,
            sales_invoice: { replaced_return_id: returnId, status: { not: 'CANCELLED' } }
          },
          _sum: { quantity: true }
        });

        const replacedQty = existingReplacements._sum.quantity || new Prisma.Decimal(0);
        const maxAllowed = new Prisma.Decimal(returnLine.quantity).sub(replacedQty);

        if (lineQty.gt(maxAllowed)) {
          throw new BadRequestException(`Replacement quantity for item ${line.item_id} exceeds returned quantity`);
        }

        lines.push({
          item_id: line.item_id,
          godown_id: line.godown_id,
          unit_id: line.unit_id,
          quantity: lineQty,
          rate: new Prisma.Decimal(0),
          discount_amount: new Prisma.Decimal(0),
          taxable_value: new Prisma.Decimal(0),
          tax_amount: new Prisma.Decimal(0),
          line_total: new Prisma.Decimal(0),
        });
      }

      return tx.salesInvoice.create({
        data: {
          company_id: companyId,
          branch_id: dto.branch_id,
          party_id: salesReturn.party_id,
          financial_year_id: dto.financial_year_id,
          document_number: dto.document_number,
          document_date: new Date(dto.document_date),
          status: 'DRAFT',
          replaced_return_id: salesReturn.id,
          taxable_amount: 0,
          tax_amount: 0,
          discount_amount: 0,
          grand_total: 0,
          paid_amount: 0,
          outstanding_amount: 0,
          lines: { create: lines }
        },
        include: { lines: true }
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }
}
