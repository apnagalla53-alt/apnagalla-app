import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PostingService } from './posting.service';
import { Prisma } from '@prisma/client';
import { CreateRetailPurchaseDto } from '../retail/dto/retail-purchase.dto';
import { PostingService as AccountingPostingService } from '../accounting/posting.service';
import { InventoryPostingService, MovementLine } from '../inventory/posting.service';
import { randomUUID } from 'crypto';
import { receiveSerials } from '../inventory/serial-tracking';
import {allocateCurrency} from '../common/currency-allocation';
import {costLedger} from '../inventory/value-journal';

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingService: PostingService,
    private readonly accounting: AccountingPostingService,
    private readonly inventory: InventoryPostingService,
  ) {}

  // ── Purchase Orders ────────────────────────────────────────────────────────

  /** Retail facade: one atomic document through the existing inventory and accounting engines. */
  async postRetailPurchase(companyId: string, branchId: string, financialYearId: string, userId: string, dto: CreateRetailPurchaseDto) {
    return this.prisma.$transaction(async tx => {
      const date = dto.purchase_date ? new Date(dto.purchase_date) : new Date();
      const fy = await tx.financialYear.findFirst({ where: { id: financialYearId, company_id: companyId, is_closed: false,
        start_date: { lte: date }, end_date: { gte: new Date(date.toISOString().slice(0, 10)) } } });
      const branch = await tx.branch.findFirst({ where: { id: branchId, company_id: companyId } });
      if (!fy || !branch) throw new BadRequestException('Choose a valid branch and open financial year for the purchase date');
      for (const id of [...new Set((dto.lines||[]).map(l=>l.item_id))].sort()) await tx.$queryRaw`SELECT id FROM items WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM parties WHERE id = ${dto.supplier_id}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
      const party = await tx.party.findFirst({ where: { id: dto.supplier_id, company_id: companyId, party_type: 'SUPPLIER', is_active: true } });
      if (!party) throw new BadRequestException('Supplier not found');
      if (dto.bill_number && await tx.purchaseInvoice.findFirst({ where: { company_id: companyId, party_id: party.id, supplier_invoice_number: dto.bill_number, status: 'POSTED' } })) throw new BadRequestException('This supplier bill number was already recorded');
      const godown = await tx.godown.findFirst({ where: { branch_id: branchId, is_active: true, branch: {company_id:companyId} }, orderBy: [{created_at: 'asc'}, {id: 'asc'}] });
      if (dto.lines?.length && !godown) throw new BadRequestException('No stock location configured');
      const normalized: any[] = [];
      const purchaseId = randomUUID();
      let taxable = new Prisma.Decimal(0), tax = new Prisma.Decimal(0);
      for (const input of dto.lines || []) {
        const item = await tx.item.findFirst({ where: { id: input.item_id, company_id: companyId, is_active: true }, include: { tax_class: true } });
        if (!item || item.is_system) throw new BadRequestException('Item not found');
        if (item.is_bundle) throw new BadRequestException('Receive bundle components separately');
        if (item.has_variants && !input.variant_id) throw new BadRequestException('Select a variant');
        if (input.variant_id && !await tx.itemVariant.findFirst({ where: { id: input.variant_id, item_id: item.id, is_active: true } })) throw new BadRequestException('Variant not found');
        const line: any = { ...input, unit_id: input.unit_id || item.primary_unit_id };
        await this.calculatePurchaseLineQuantities(companyId, [line], tx);
        if (line.base_quantity <= 0) throw new BadRequestException('Purchase quantity must be positive');
        const chargedQuantity = input.dimensions ? line.base_quantity : input.quantity;
        const value = new Prisma.Decimal(chargedQuantity).mul(input.purchase_rate).minus(input.discount_amount||0).toDecimalPlaces(2);
        if(value.lt(0))throw new BadRequestException('Purchase discount exceeds line value');
        if (item.tax_class && item.tax_class.company_id !== companyId) throw new BadRequestException('Tax class not found');
        const lineTax = value.mul(item.tax_class?.tax_rate || 0).div(100).toDecimalPlaces(2);
        let batchId = input.batch_id;
        if (item.track_batch) {
          if (!batchId && !input.batch_number?.trim()) throw new BadRequestException('Batch number is required');
          if (!batchId) {
            const number = input.batch_number!.trim();
            await tx.$queryRaw`SELECT id FROM items WHERE id = ${item.id}::uuid FOR UPDATE`;
            let batch = await tx.itemBatch.findFirst({ where: { company_id: companyId, item_id: item.id, batch_number: number } });
            if (batch && input.expiry_date && batch.expiry_date?.toISOString().slice(0, 10) !== input.expiry_date.slice(0, 10)) throw new BadRequestException('Batch expiry differs from the existing batch');
            if (!batch) batch = await tx.itemBatch.create({ data: { company_id: companyId, item_id: item.id, batch_number: number,
              manufacturing_date: input.manufacturing_date ? new Date(input.manufacturing_date) : undefined,
              expiry_date: input.expiry_date ? new Date(input.expiry_date) : undefined, mrp: input.mrp, purchase_rate: input.purchase_rate } });
            batchId = batch.id;
          }
          if (!await tx.itemBatch.findFirst({ where: { id: batchId, company_id: companyId, item_id: item.id } })) throw new BadRequestException('Batch not found');
        } else if (batchId || input.batch_number) throw new BadRequestException('Batch tracking is disabled for this item');
        if (!item.track_serial && input.serial_numbers?.length) throw new BadRequestException('Serial tracking is disabled for this item');
        const serials = item.track_serial ? await receiveSerials(tx, { company_id: companyId, item_id: item.id,
          godown_id: godown!.id, variant_id: input.variant_id, batch_id: batchId, quantity: line.base_quantity,
          numbers: input.serial_numbers, date, document_id: purchaseId }) : [];
        normalized.push({ item_id: item.id, godown_id: godown!.id, unit_id: item.primary_unit_id,
          serial_ids: serials.length ? serials.map(s => s.id) : undefined,
          entered_quantity: line.entered_quantity, entered_unit_id: line.entered_unit_id, conversion_factor: line.conversion_factor,
          base_quantity: line.base_quantity, quantity: line.base_quantity, variant_id: input.variant_id, batch_id: batchId,
          dimensions: input.dimensions, entered_purchase_rate:input.purchase_rate, discount_amount:input.discount_amount||0,
          effective_inventory_cost: value, base_unit_cost_snapshot: value.div(line.base_quantity), rate: value.div(line.base_quantity), taxable_value: value, tax_amount: lineTax, line_total: value.plus(lineTax),
          tax_snapshot_json: item.tax_class ? JSON.stringify({ id: item.tax_class.id, rate: item.tax_class.tax_rate.toNumber(), hsn: item.tax_class.hsn_code }) : null,
          stock: item.item_type !== 'SERVICE' });
        taxable = taxable.plus(value); tax = tax.plus(lineTax);
        if (input.selling_price !== undefined || input.mrp !== undefined) {
          if (input.variant_id) await tx.itemVariant.update({ where: { id: input.variant_id }, data: { default_sale_rate: input.selling_price, mrp: input.mrp } });
          else await tx.item.update({ where: { id: item.id }, data: { default_sale_rate: input.selling_price, mrp: input.mrp } });
        }
      }
      if (!normalized.length) {
        if (!dto.total_amount || dto.total_amount <= 0) throw new BadRequestException('Enter the purchase amount');
        taxable = new Prisma.Decimal(dto.total_amount).toDecimalPlaces(2);
      }
      const landed=new Prisma.Decimal(dto.landed_cost_amount||0).toDecimalPlaces(2);
      if(landed.gt(0)){
        const eligible=normalized.filter(l=>l.stock),basis=eligible.reduce((sum,l)=>sum.plus(l.taxable_value),new Prisma.Decimal(0));
        if(!eligible.length||basis.lte(0))throw new BadRequestException('Purchase charges require itemized stock with a positive acquisition value');
        const shares=allocateCurrency(landed,eligible.map(l=>l.taxable_value));
        eligible.forEach((l,index)=>{const share=shares[index];
          l.landed_cost_allocation=share;l.effective_inventory_cost=new Prisma.Decimal(l.taxable_value).plus(share);
          l.base_unit_cost_snapshot=l.effective_inventory_cost.div(l.base_quantity);});
      }
      const total = taxable.plus(tax).plus(landed);
      if (total.lte(0)) throw new BadRequestException('Purchase total must be positive');
      const paid = dto.payment_status === 'PAID' ? total : new Prisma.Decimal(dto.payment_status === 'CREDIT' ? 0 : dto.paid_amount || 0);
      if (paid.lt(0) || paid.gt(total) || (dto.payment_status === 'PARTIAL' && (paid.lte(0) || paid.gte(total)))) throw new BadRequestException('Enter a partial payment between zero and the total');
      if (paid.lt(total) && !party.credit_allowed) throw new BadRequestException('Credit is disabled for this supplier');
      const due = dto.due_date ? new Date(dto.due_date) : new Date(date.getTime() + (party.credit_days || 0) * 86400000);
      if (due.getTime() < new Date(date.toISOString().slice(0, 10)).getTime()) throw new BadRequestException('Due date must be on or after the purchase date');
      let purchases = await tx.ledgerAccount.findFirst({ where: { company_id: companyId, OR: [{ code: '5000' }, { code: 'PURCH' }, { name: 'Purchase Account' }] } });
      if (!purchases) purchases = await tx.ledgerAccount.create({ data: { company_id: companyId, name: 'Purchase Account', code: 'PURCH', account_type: 'EXPENSE' } });
      const payable = await tx.ledgerAccount.findFirst({ where: { company_id: companyId, party_id: party.id } });
      let inputTax = tax.gt(0) ? await tx.ledgerAccount.findFirst({ where: { company_id: companyId, OR: [{ code: '2200' }, { code: 'INPUT_GST' }, { name: 'Input Tax' }] } }) : null;
      if (tax.gt(0) && !inputTax) inputTax = await tx.ledgerAccount.create({ data: { company_id: companyId, name: 'Input GST', code: 'INPUT_GST', account_type: 'ASSET' } });
      if (!payable || (tax.gt(0) && !inputTax)) throw new BadRequestException('Supplier or input tax ledger is not configured');
      const invoice = await tx.purchaseInvoice.create({ data: { id: purchaseId, company_id: companyId, branch_id: branchId, financial_year_id: fy.id,
        party_id: party.id, document_number: 'PUR-' + randomUUID(), document_date: date, supplier_invoice_number: dto.bill_number,
        supplier_invoice_date: date, status: 'POSTED', notes: dto.note, purchase_category: dto.purchase_category || 'REGULAR',
        payment_terms_days: party.credit_days, due_date: due, taxable_amount: taxable, tax_amount: tax, landed_cost_amount:landed, grand_total: total,
        outstanding_amount: total, posted_at: new Date(), posted_by: userId,
        payment_snapshot: paid.gt(0) ? [{ method: dto.payment_method || 'CASH', amount: paid.toNumber() }] : [],
        lines: { create: normalized.map(({ stock, ...line }) => line) } }, include: { lines: true } });
      const movements: MovementLine[] = invoice.lines.filter(l => normalized.find(n => n.item_id === l.item_id)?.stock).flatMap(l => (Array.isArray(l.serial_ids) && l.serial_ids.length ? l.serial_ids : [null]).map(serialId => ({
        item_id: l.item_id, godown_id: l.godown_id, unit_id: l.unit_id, variant_id: l.variant_id, batch_id: l.batch_id,
        serial_id: serialId as string | null, quantity: serialId ? 1 : l.quantity.toString(), cost_rate: (l.base_unit_cost_snapshot||l.rate).toString(), source_line_id: serialId as string || l.id, cost_line_id:l.id })));
      if (movements.length) await this.inventory.postMovement(tx, { company_id: companyId, branch_id: branchId, business_date: date,
        movement_type: 'PURCHASE_IN', source_document_type: 'PURCHASE_INVOICE', source_document_id: invoice.id, lines: movements });
      const stockCost = normalized.filter(l => l.stock).reduce((sum,l) => sum.plus(l.effective_inventory_cost), new Prisma.Decimal(0));
      const inventoryAsset=stockCost.gt(0)?await costLedger(tx,companyId,'1200','Inventory Asset','ASSET'):null;
      const journal = await this.accounting.postVoucher(tx, { company_id: companyId, branch_id: branchId, financial_year_id: fy.id,
        voucher_type: 'JOURNAL', document_number: 'PURJ-' + randomUUID(), voucher_date: date, posted_by: userId,
        source_document_type: 'PURCHASE_INVOICE', source_document_id: invoice.id, narration: dto.note,
        lines: [...(taxable.plus(landed).minus(stockCost).gt(0) ? [{ledger_account_id:purchases.id,debit:taxable.plus(landed).minus(stockCost),credit:0}] : []),
          ...(stockCost.gt(0) ? [{ledger_account_id:inventoryAsset!.id,debit:stockCost,credit:0}] : []),
          ...(inputTax ? [{ ledger_account_id: inputTax.id, debit: tax, credit: 0 }] : []),
          { ledger_account_id: payable!.id, party_id: party.id, debit: 0, credit: total }] });
      await tx.billAllocation.create({ data: { company_id: companyId, party_id: party.id,
        voucher_line_id: journal.lines.find(l => l.party_id === party.id)!.id, reference_document_type: 'PURCHASE_INVOICE',
        reference_document_id: invoice.id, allocation_type: 'NEW_REFERENCE', amount: total, due_date: due } });
      if (paid.gt(0)) await this.accounting.settlePartyBalance(tx, { company_id: companyId, branch_id: branchId, financial_year_id: fy.id,
        user_id: userId, party_id: party.id, party_type: 'SUPPLIER', amount: paid.toNumber(), payment_method: dto.payment_method || 'CASH', date, note: dto.note, reference_id: invoice.id });
      return tx.purchaseInvoice.findUnique({ where: { id: invoice.id }, include: { lines: true, party: { select: { id: true, name: true } } } });
    }, { timeout: 30000 });
  }

  async createPurchaseOrder(data: Prisma.PurchaseOrderCreateInput) {
    return this.prisma.purchaseOrder.create({
      data,
      include: { lines: true, party: true },
    });
  }

  async getPurchaseOrders(companyId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { company_id: companyId },
      include: { party: true },
      orderBy: { document_date: 'desc' },
    });
  }

  async getPurchaseOrderById(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        party: true,
        lines: {
          include: { item: true, unit: true },
        },
        goods_receipts: true,
      },
    });
    if (!po) throw new NotFoundException('PO not found');
    return po;
  }

  // ── Goods Receipts ─────────────────────────────────────────────────────────

  async createGoodsReceipt(data: Prisma.GoodsReceiptCreateInput) {
    return this.prisma.goodsReceipt.create({
      data,
      include: { lines: true },
    });
  }

  async calculatePurchaseLineQuantities(companyId: string, lines: any[], db: Prisma.TransactionClient = this.prisma) {
    for (const line of lines) {
      const item = await db.item.findUnique({ where: { id: line.item_id } });
      if (!item || item.company_id !== companyId) throw new BadRequestException(`Item ${line.item_id} not found`);

      let lineQty = new Prisma.Decimal(line.received_quantity || line.quantity || 0);
      let conversionFactor = new Prisma.Decimal(1);

      if (['AREA','VOLUME'].includes(item.selling_mode) && line.dimensions) {
        const l = new Prisma.Decimal(line.dimensions.length || 0);
        const w = new Prisma.Decimal(line.dimensions.width || 0);
        if (l.lte(0) || w.lte(0)) throw new BadRequestException(`Dimensions > 0 required for AREA item: ${item.id}`);
        const height = item.selling_mode === 'VOLUME' ? new Prisma.Decimal(line.dimensions.height || 0) : new Prisma.Decimal(1);
        if (height.lte(0)) throw new BadRequestException('Height must be positive for VOLUME');
        const area = l.mul(w).mul(height);
        lineQty = area.mul(lineQty);
      } else if (line.unit_id !== item.primary_unit_id) {
        const conv = await db.itemUnitConversion.findFirst({
          where: { item_id: item.id, from_unit_id: line.unit_id, to_unit_id: item.primary_unit_id }
        });
        if (!conv) throw new BadRequestException('No conversion configured for this item and unit');
        conversionFactor = new Prisma.Decimal(conv.conversion_factor);
      }

      line.entered_quantity = line.received_quantity || line.quantity;
      line.entered_unit_id = line.unit_id;
      line.conversion_factor = conversionFactor.toNumber();
      line.base_quantity = lineQty.mul(conversionFactor).toNumber();

      // Override quantity and unit to normalize for inventory
      if (line.received_quantity !== undefined) {
         line.received_quantity = line.base_quantity;
      } else {
         line.quantity = line.base_quantity;
      }
      line.unit_id = item.primary_unit_id;
    }
  }

  async createGoodsReceiptWithQuantities(companyId: string, data: any) {
    await this.calculatePurchaseLineQuantities(companyId, data.lines);
    // map payload
    const createdLines = await Promise.all(data.lines.map(async (l: any) => {
      let batchId = null;
      if (l.batch_number) {
        let batch = await this.prisma.itemBatch.findFirst({
          where: { item_id: l.item_id, batch_number: l.batch_number }
        });
        if (!batch) {
          batch = await this.prisma.itemBatch.create({
            data: {
              company_id: companyId,
              item_id: l.item_id,
              batch_number: l.batch_number,
              manufacturing_date: l.manufacturing_date ? new Date(l.manufacturing_date) : undefined,
              expiry_date: l.expiry_date ? new Date(l.expiry_date) : undefined,
              mrp: l.mrp || undefined,
              purchase_rate: l.rate || undefined
            }
          });
        }
        batchId = batch.id;
      }

      const lp: any = {
        ...l,
        acquisition_cost_rate:l.rate==null?null:new Prisma.Decimal(l.rate).div(l.conversion_factor||1),
        received_quantity: l.quantity || l.received_quantity,
        item: { connect: { id: l.item_id } },
        godown: { connect: { id: l.godown_id } },
        unit: { connect: { id: l.unit_id } },
        entered_unit: { connect: { id: l.entered_unit_id } }
      };
      if (l.variant_id) lp.variant = { connect: { id: l.variant_id } };
      if (batchId) lp.batch = { connect: { id: batchId } };

      delete lp.item_id; delete lp.godown_id; delete lp.unit_id; delete lp.entered_unit_id; delete lp.rate; delete lp.quantity; delete lp.variant_id;
      delete lp.batch_number; delete lp.manufacturing_date; delete lp.expiry_date; delete lp.mrp;

      if (l.purchase_order_line_id) lp.purchase_order_line = { connect: { id: l.purchase_order_line_id } };
      return lp;
    }));

    const payload: Prisma.GoodsReceiptCreateInput = {
      ...data,
      document_date: new Date(data.document_date),
      status: 'DRAFT',
      company: { connect: { id: companyId } },
      branch: { connect: { id: data.branch_id } },
      party: { connect: { id: data.party_id } },
      purchase_order: data.purchase_order_id ? { connect: { id: data.purchase_order_id } } : undefined,
      lines: {
        create: createdLines
      }
    };
    delete (payload as any).company_id;
    delete (payload as any).branch_id;
    delete (payload as any).party_id;
    delete (payload as any).purchase_order_id;
    return this.createGoodsReceipt(payload);
  }


  async getGoodsReceipts(companyId: string) {
    return this.prisma.goodsReceipt.findMany({
      where: { company_id: companyId },
      include: { party: true, purchase_order: true },
      orderBy: { document_date: 'desc' },
    });
  }

  async getGoodsReceiptById(id: string) {
    const grn = await this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        party: true,
        purchase_order: true,
        lines: {
          include: { item: true, unit: true, godown: true },
        },
      },
    });
    if (!grn) throw new NotFoundException('GRN not found');
    return grn;
  }

  async postGoodsReceipt(id: string, userId: string) {
    return this.postingService.postGoodsReceipt(id, userId);
  }

  // ── Purchase Invoices & 3-Way Match ────────────────────────────────────────

  async createPurchaseInvoice(data: Prisma.PurchaseInvoiceCreateInput) {
    return this.prisma.purchaseInvoice.create({
      data,
      include: { lines: true },
    });
  }

  async createPurchaseInvoiceWithQuantities(companyId: string, data: any) {
    await this.calculatePurchaseLineQuantities(companyId, data.lines);
    const payload: Prisma.PurchaseInvoiceCreateInput = {
      ...data,
      document_date: new Date(data.document_date),
      supplier_invoice_date: data.supplier_invoice_date ? new Date(data.supplier_invoice_date) : undefined,
      due_date: data.due_date ? new Date(data.due_date) : undefined,
      company: { connect: { id: companyId } },
      branch: { connect: { id: data.branch_id } },
      party: { connect: { id: data.party_id } },
      financial_year: { connect: { id: data.financial_year_id } },
      lines: {
        create: data.lines.map((l: any) => {
          const lp: any = {
            ...l,
            item: { connect: { id: l.item_id } },
            godown: { connect: { id: l.godown_id } },
            unit: { connect: { id: l.unit_id } },
            entered_unit: { connect: { id: l.entered_unit_id } }
          };
          delete lp.item_id; delete lp.godown_id; delete lp.unit_id; delete lp.entered_unit_id;
          if (l.purchase_order_line_id) lp.purchase_order_line = { connect: { id: l.purchase_order_line_id } };
          if (l.goods_receipt_line_id) lp.goods_receipt_line = { connect: { id: l.goods_receipt_line_id } };
          return lp;
        })
      }
    };
    delete (payload as any).company_id; delete (payload as any).branch_id; delete (payload as any).party_id; delete (payload as any).financial_year_id;
    return this.createPurchaseInvoice(payload);
  }


  async perform3WayMatch(invoiceId: string) {
    const inv = await this.prisma.purchaseInvoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { include: { purchase_order_line: true, goods_receipt_line: true } } },
    });

    if (!inv) throw new NotFoundException('Invoice not found');

    const discrepancies = [];
    let matchStatus = 'MATCHED';

    for (const line of inv.lines) {
      if (line.purchase_order_line) {
        const poLine = line.purchase_order_line;
        // Price check
        if (Number(line.rate) !== Number(poLine.rate)) {
          discrepancies.push(`Price variance on item ${line.item_id}: PO rate ${poLine.rate}, Invoice rate ${line.rate}`);
          matchStatus = 'PRICE_VARIANCE';
        }
        // Quantity check (Invoice vs PO)
        if (Number(line.quantity) > Number(poLine.ordered_quantity)) {
          discrepancies.push(`Quantity variance on item ${line.item_id}: Invoiced > Ordered`);
          matchStatus = matchStatus === 'MATCHED' ? 'QUANTITY_VARIANCE' : 'MULTIPLE_VARIANCES';
        }
      }
      if (line.goods_receipt_line) {
        const grnLine = line.goods_receipt_line;
        // Quantity check (Invoice vs Received)
        if (Number(line.quantity) > Number(grnLine.received_quantity)) {
           discrepancies.push(`Quantity variance on item ${line.item_id}: Invoiced > Received`);
           matchStatus = matchStatus === 'MATCHED' ? 'QUANTITY_VARIANCE' : 'MULTIPLE_VARIANCES';
        }
      }
    }

    return {
      status: matchStatus,
      discrepancies,
    };
  }

  async getPurchaseInvoices(companyId: string) {
    return this.prisma.purchaseInvoice.findMany({
      where: { company_id: companyId },
      include: { party: true },
      orderBy: { document_date: 'desc' },
    });
  }
  
  async getPurchaseInvoiceById(id: string) {
    const inv = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: {
        party: true,
        lines: { include: { item: true, unit: true } }
      }
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  async postPurchaseInvoice(id: string, userId: string) {
    return this.postingService.postPurchaseInvoice(id, userId);
  }

  // ── Dashboard KPIs ─────────────────────────────────────────────────────────

  async getPurchasingDashboard(companyId: string) {
    const pos = await this.prisma.purchaseOrder.findMany({ where: { company_id: companyId } });
    const grns = await this.prisma.goodsReceipt.findMany({ where: { company_id: companyId } });
    const invoices = await this.prisma.purchaseInvoice.findMany({ where: { company_id: companyId } });

    const openPOs = pos.filter((po: any) => po.status !== 'CLOSED' && po.status !== 'CANCELLED' && po.status !== 'FULLY_RECEIVED').length;
    const pendingReceipts = pos.filter((po: any) => po.status === 'CONFIRMED' || po.status === 'PARTIALLY_RECEIVED').length;
    
    let totalPurchases = new Prisma.Decimal(0);
    let totalOutstanding = new Prisma.Decimal(0);

    for (const inv of invoices) {
      if (inv.status === 'POSTED') {
        totalPurchases = totalPurchases.plus(inv.grand_total);
        totalOutstanding = totalOutstanding.plus(inv.outstanding_amount);
      }
    }

    const recentPurchases = await this.prisma.purchaseOrder.findMany({
      where: { company_id: companyId },
      include: { party: true },
      orderBy: { document_date: 'desc' },
      take: 5,
    });

    return {
      openPOs,
      pendingReceipts,
      pendingInvoices: grns.filter((g: any) => g.status === 'POSTED').length, // simplified KPI
      totalPurchases: totalPurchases.toNumber(),
      totalOutstanding: totalOutstanding.toNumber(),
      recentPurchases,
    };
  }

  // ── Purchase Returns ───────────────────────────────────────────────────────

  async createPurchaseReturn(companyId: string, dto: any) {
    if (dto.branch_id) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branch_id } });
      if (!branch || branch.company_id !== companyId) throw new BadRequestException('Branch does not belong to the company');
    }

    return this.prisma.$transaction(async (tx) => {
      let invoice: any = null;
      if (dto.original_invoice_id) {
        invoice = await tx.purchaseInvoice.findUnique({
          where: { id: dto.original_invoice_id },
          include: { lines: true }
        });
        if (!invoice || invoice.company_id !== companyId) throw new BadRequestException('Invalid original invoice reference');
        if (invoice.branch_id !== dto.branch_id) throw new BadRequestException('Cannot return an invoice from a different branch');

        for (const line of dto.lines) {
          const invoiceLine = invoice.lines.find((l: any) => l.item_id === line.item_id && l.unit_id === line.unit_id);
          if (!invoiceLine) {
            throw new BadRequestException(`Item ${line.item_id} not found in the original invoice`);
          }

          const existingReturns = await tx.purchaseReturnLine.aggregate({
            where: {
              item_id: line.item_id,
              unit_id: line.unit_id,
              purchase_return: { original_invoice_id: dto.original_invoice_id, status: { not: 'CANCELLED' } }
            },
            _sum: { quantity: true }
          });

          const returnedQty = existingReturns._sum.quantity || new Prisma.Decimal(0);
          const returningQty = new Prisma.Decimal(line.quantity);
          const maxAllowed = new Prisma.Decimal(invoiceLine.quantity).sub(returnedQty);

          if (returningQty.gt(maxAllowed)) {
            throw new BadRequestException(`Cannot return more than purchased quantity. Max allowed for item ${line.item_id} is ${maxAllowed.toString()}`);
          }
        }
      }

      let taxableAmount = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);
      let grandTotal = new Prisma.Decimal(0);

      const lines = dto.lines.map((line: any) => {
        const lineQty = new Prisma.Decimal(line.quantity);
        let lineRate = new Prisma.Decimal(line.rate);
        let lineTax = new Prisma.Decimal(0);
        
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

      return tx.purchaseReturn.create({
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

  async getPurchaseReturns(companyId: string) {
    return this.prisma.purchaseReturn.findMany({
      where: { company_id: companyId },
      include: { party: true },
      orderBy: { document_date: 'desc' },
    });
  }

  async getPurchaseReturnById(id: string) {
    const ret = await this.prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        party: true,
        lines: { include: { item: true, unit: true } }
      }
    });
    if (!ret) throw new NotFoundException('Purchase Return not found');
    return ret;
  }

  async postPurchaseReturn(id: string, userId: string) {
    return this.postingService.postPurchaseReturn(id, userId);
  }

  async createReplacement(companyId: string, returnId: string, userId: string, dto: any) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseReturn = await tx.purchaseReturn.findUnique({
        where: { id: returnId },
        include: { lines: true }
      });
      if (!purchaseReturn || purchaseReturn.company_id !== companyId) throw new NotFoundException('Purchase Return not found');
      if (purchaseReturn.status !== 'POSTED') throw new BadRequestException('Can only replace a POSTED Purchase Return');

      const lines = [];
      for (const line of dto.lines) {
        const returnLine = purchaseReturn.lines.find((l: any) => l.item_id === line.item_id && l.unit_id === line.unit_id);
        if (!returnLine) throw new BadRequestException(`Item ${line.item_id} not found in the original return`);

        const lineQty = new Prisma.Decimal(line.quantity);

        const existingReplacements = await tx.purchaseInvoiceLine.aggregate({
          where: {
            item_id: line.item_id,
            unit_id: line.unit_id,
            purchase_invoice: { replaced_return_id: returnId, status: { not: 'CANCELLED' } }
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
          taxable_value: new Prisma.Decimal(0),
          tax_amount: new Prisma.Decimal(0),
          line_total: new Prisma.Decimal(0),
        });
      }

      return tx.purchaseInvoice.create({
        data: {
          company_id: companyId,
          branch_id: dto.branch_id,
          party_id: purchaseReturn.party_id,
          financial_year_id: dto.financial_year_id,
          document_number: dto.document_number,
          document_date: new Date(dto.document_date),
          status: 'DRAFT',
          replaced_return_id: purchaseReturn.id,
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
