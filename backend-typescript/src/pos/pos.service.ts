import { paymentRecipient } from '../retail/counter/upi-profiles';
import { snapshotDocumentCosts } from '../inventory/cost-snapshots';
import { allocateBillDiscount } from './bill-discount';
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreatePosSaleDto } from './dto/create-pos-sale.dto';
import { CreatePosReturnDto } from './dto/create-pos-return.dto';
import { OpenShiftDto, CloseShiftDto } from './dto/shift.dto';
import { HoldBillDto } from './dto/hold-bill.dto';
import { InventoryPostingService } from '../inventory/posting.service';
import { PostingService as AccountingPostingService } from '../accounting/posting.service';
import { PricingEngineService } from '../pricing/pricing-engine.service';
import { BatchExpiryService } from '../inventory/batch-expiry.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ItemCompositionService } from '../item-composition/item-composition.service';
import { nextShopBillNumber } from './bill-number';

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryPostingService,
    private readonly accounting: AccountingPostingService,
    private readonly pricingEngine: PricingEngineService,
    private readonly batchExpiry: BatchExpiryService,
    private readonly composition: ItemCompositionService,
  ) {}

  async lookupItemByBarcode(companyId: string, sku: string) {
    const code = (sku || '').trim();
    if (!code) throw new BadRequestException('Barcode or SKU cannot be empty');

    // 1. Check canonical ItemBarcode table first
    const barcodeRecord = await this.prisma.itemBarcode.findFirst({
      where: { company_id: companyId, barcode: code, is_active: true },
      include: {
        item: {
          include: { primary_unit: true, tax_class: true }
        }
      }
    });

    if (barcodeRecord && barcodeRecord.item) {
      if (!barcodeRecord.item.is_active) {
        throw new BadRequestException('Item not found or inactive');
      }
      return barcodeRecord.item;
    }

    // 2. Fallback to Item.sku for backward compatibility
    const item = await this.prisma.item.findFirst({
      where: { company_id: companyId, sku: code, is_active: true },
      include: { primary_unit: true, tax_class: true }
    });
    if (!item) throw new BadRequestException('Item not found or inactive');
    return item;
  }

  async postPosSale(companyId: string, userId: string, dto: CreatePosSaleDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validation & Setup
      const branch = await tx.branch.findUnique({ where: { id: dto.branch_id } });
      if (!branch || branch.company_id !== companyId) {
        throw new BadRequestException('Branch not found or belongs to another company');
      }

      let partyId = dto.party_id;

      // Handle walk-in customer if party_id is not provided
      if (!partyId) {
        await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId}::uuid FOR UPDATE`;
        let walkInParty = await tx.party.findFirst({
          where: { company_id: companyId, is_walkin: true }
        });
        if (!walkInParty) {
          walkInParty = await tx.party.create({
            data: {
              company_id: companyId,
              code: 'WALKIN',
              party_type: 'CUSTOMER',
              name: 'Walk-in Customer',
              is_walkin: true,
              is_active: true
            }
          });
        }
        partyId = walkInParty.id;
      } else {
        const party = await tx.party.findUnique({ where: { id: partyId } });
        if (!party || party.company_id !== companyId) {
          throw new BadRequestException('Party not found or belongs to another company');
        }
      }

      await tx.$queryRaw`SELECT id FROM parties WHERE id = ${partyId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
      const saleParty = await tx.party.findFirst({ where: { id: partyId, company_id: companyId, is_active: true } });
      if (!saleParty || saleParty.is_blocked) throw new BadRequestException('Customer is inactive or blocked');
      if (!dto.lines.length) throw new BadRequestException('Add at least one bill line');
      for (const p of dto.payments) if (!Number.isFinite(Number(p.amount)) || p.amount < 0 || !['CASH','UPI','CARD','BANK'].includes(p.payment_method)) throw new BadRequestException('Invalid payment');

      // Configuration fallback for ledgers (optional but recommended for POS)
      const config = await tx.companyConfiguration.findUnique({ where: { company_id: companyId } });
      const defaultCashLedgerId = config?.default_cash_ledger_id;
      const defaultBankLedgerId = config?.default_bank_ledger_id;

      // Financial HTTP writes use the shared persisted idempotency interceptor.
      
      let taxableAmount = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);
      let discountAmount = new Prisma.Decimal(0);
      let grandTotal = new Prisma.Decimal(0);

      const invoiceLinesData = [];
      const inventoryLines = [];
      const linePricingResults: any[] = [];
      await this.composition.lockSaleItems(tx, companyId, dto.lines);

      for (const line of [...dto.lines].sort((a,b)=>a.item_id.localeCompare(b.item_id))) {
        const costStart = inventoryLines.length;
        await tx.$queryRaw`SELECT id FROM items WHERE id = ${line.item_id}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
        const item = await tx.item.findUnique({ where: { id: line.item_id }, include: { tax_class: true } });
        if (!item || item.company_id !== companyId) throw new BadRequestException(`Item ${line.item_id} invalid`);
        if (!item.is_active || line.quantity <= 0 || !Number.isFinite(line.quantity) || line.rate < 0 || (line.discount_amount || 0) < 0) throw new BadRequestException('Invalid bill line');

        const godown = await tx.godown.findUnique({ where: { id: line.godown_id } });
        if (!godown || godown.branch_id !== dto.branch_id) throw new BadRequestException(`Godown ${line.godown_id} invalid`);
        const lineQty = this.saleQuantity(item.selling_mode, line.quantity, line.dimensions);
        const pricingRes = await this.pricingEngine.calculateLinePricing(
          companyId,
          partyId,
          {
            itemId: line.item_id,
            variantId: line.variant_id,
            batchId: line.batch_id,
            quantity: lineQty,
            unitId: line.unit_id,
            overrideRate: line.rate !== undefined && Number(line.rate) > 0 ? line.rate : undefined,
            overrideDiscountAmount: line.discount_amount !== undefined && Number(line.discount_amount) > 0 ? line.discount_amount : undefined,
          },
          { branchId: dto.branch_id, documentDate: dto.document_date, isPos: true },
          tx,
        );

        const modifierSnapshot = await this.composition.modifierPricing(tx, companyId, item.id, line.modifier_option_ids, lineQty, pricingRes);
        if (item.tax_class && item.tax_class.company_id !== companyId) throw new BadRequestException('Invalid tax class');
        if (pricingRes.taxableValue.lt(0)) throw new BadRequestException('Discount exceeds the line value');
        const lineTax = pricingRes.taxableValue.mul(item.tax_class?.tax_rate || 0).div(100).toDecimalPlaces(2);
        const lineTotal = pricingRes.taxableValue.add(lineTax);

        taxableAmount = taxableAmount.add(pricingRes.taxableValue);
        taxAmount = taxAmount.add(lineTax);
        discountAmount = discountAmount.add(pricingRes.discountAmount);
        grandTotal = grandTotal.add(lineTotal);

        linePricingResults.push(pricingRes);

        let conversionFactor = new Prisma.Decimal(1);
        if (line.unit_id !== item.primary_unit_id) {
          const conversion = await tx.itemUnitConversion.findFirst({
            where: {
              item_id: line.item_id,
              from_unit_id: line.unit_id,
              to_unit_id: item.primary_unit_id
            }
          });
          if (!conversion) throw new BadRequestException('Unit conversion is not configured');
          conversionFactor = new Prisma.Decimal(conversion.conversion_factor);
        }
        const baseQty = lineQty.mul(conversionFactor);

        const lineId = randomUUID();
        const selectedSerials = line.serial_ids || [];
        let warrantySnapshot: any = undefined;
        if (item.track_serial) {
          const required = baseQty.plus(pricingRes.freeQuantity.mul(conversionFactor));
          if (!required.isInteger() || selectedSerials.length !== required.toNumber() || new Set(selectedSerials).size !== selectedSerials.length)
            throw new BadRequestException('Select exactly one distinct serial per base unit sold');
          const serials = await tx.itemSerial.findMany({ where: { id: { in: selectedSerials }, company_id: companyId, item_id: item.id,
            godown_id: line.godown_id, variant_id: line.variant_id || null, status: 'AVAILABLE' } });
          if (serials.length !== selectedSerials.length) throw new BadRequestException('Selected serial is unavailable or belongs to another item, variant or location');
          const start = new Date(dto.document_date).toISOString().slice(0,10);
          const days = item.warranty_days || 0;
          const end = new Date(new Date(start).getTime() + days * 86400000).toISOString().slice(0,10);
          warrantySnapshot = { days, start, end, customer_id: partyId, serials: serials.map(s => ({ id: s.id, number: s.serial_number })) };
        } else if (selectedSerials.length) throw new BadRequestException('Serial tracking is disabled for this item');

        let batchAllocations: { id?: string, batchId: string, quantity: Prisma.Decimal }[] = [];
        const totalQtyForInventory = lineQty.add(pricingRes.freeQuantity);
        const bundle = item.is_bundle ? await this.composition.prepareBundle(tx, companyId, item.id, line.godown_id, totalQtyForInventory.mul(conversionFactor), dto.document_date) : undefined;

        if (item.item_type !== 'SERVICE' && item.track_batch) {
          if (item.track_serial) {
            // Allocate the batches actually attached to the selected serials.
            // Independent FEFO allocation can otherwise record a different lot.
            const serials=await tx.itemSerial.findMany({where:{id:{in:selectedSerials},company_id:companyId}});
            const groups=new Map<string,number>();
            for(const serial of serials) {
              if(!serial.batch_id || (line.batch_id && line.batch_id!==serial.batch_id)) throw new BadRequestException('Selected serial does not belong to the selected batch');
              groups.set(serial.batch_id,(groups.get(serial.batch_id)||0)+1);
            }
            for(const [batchId,quantity] of [...groups].sort()) batchAllocations.push(...await this.batchExpiry.resolveBatchesForSale(companyId,{
              itemId:item.id,variantId:line.variant_id??null,godownId:line.godown_id,quantityBase:new Prisma.Decimal(quantity),
              transactionDate:new Date(dto.document_date),manualBatchId:batchId
            },tx));
          } else {
           batchAllocations = await this.batchExpiry.resolveBatchesForSale(companyId, {
             itemId: item.id,
             variantId: line.variant_id ?? null,
             godownId: line.godown_id,
             quantityBase: totalQtyForInventory.mul(conversionFactor),
             transactionDate: new Date(dto.document_date),
             manualBatchId: line.batch_id
          }, tx);
          }
           batchAllocations = batchAllocations.map(a => ({ ...a, id: randomUUID() }));
        }

        invoiceLinesData.push({
          id: lineId,
          inventory_tracked: item.item_type !== 'SERVICE' && item.inventory_tracking !== false,
          item_id: line.item_id,
          godown_id: line.godown_id,
          unit_id: item.primary_unit_id, // Store normalized to primary
          entered_unit_id: line.unit_id,
          entered_quantity: lineQty,
          conversion_factor: conversionFactor,
          base_quantity: baseQty,
          variant_id: line.variant_id ?? null,
          serial_ids: selectedSerials.length ? selectedSerials : undefined,
          warranty_snapshot: warrantySnapshot,
          bundle_snapshot: bundle?.snapshot,
          modifier_snapshot: modifierSnapshot,
          batch_id: batchAllocations.length === 1 ? batchAllocations[0].batchId : (line.batch_id ?? null),
          quantity: baseQty, // Normalized quantity
          free_quantity: pricingRes.freeQuantity,
          dimensions: line.dimensions ? line.dimensions : undefined,
          rate: pricingRes.resolvedRate,
          discount_amount: pricingRes.discountAmount,
          taxable_value: pricingRes.taxableValue,
          tax_amount: lineTax,
          line_total: lineTotal,
          tax_snapshot_json: item.tax_class ? JSON.stringify({ id: item.tax_class.id, rate: item.tax_class.tax_rate.toNumber(), hsn: item.tax_class.hsn_code }) : null,
          pricing_trace_json: JSON.stringify(pricingRes.pricingTrace),
          batch_allocations: batchAllocations.length > 0 ? {
            create: batchAllocations.map(a => ({
              id: a.id,
              batch_id: a.batchId,
              quantity: a.quantity
            }))
          } : undefined
        });

        // Add paid + free quantity for inventory deduction
        if (bundle) inventoryLines.push(...bundle.inventoryLines);
        else if (item.item_type !== 'SERVICE' && item.inventory_tracking !== false) {
          if (item.track_serial) {
            for (const serialId of selectedSerials) {
              const serial = await tx.itemSerial.findUnique({ where: { id: serialId } });
              inventoryLines.push({ item_id: item.id, godown_id: line.godown_id, unit_id: item.primary_unit_id,
                variant_id: line.variant_id || null, batch_id: serial!.batch_id, serial_id: serialId, quantity: '1', source_line_id: serialId, cost_rate: 0 });
            }
          } else if (batchAllocations.length > 0) {
             for (const alloc of batchAllocations) {
               inventoryLines.push({
                 item_id: line.item_id,
                 godown_id: line.godown_id,
                 quantity: alloc.quantity.toString(), // Base quantity
                 unit_id: item.primary_unit_id, // Base unit
                 variant_id: line.variant_id ?? null,
                 batch_id: alloc.batchId,
                 source_line_id: alloc.id!,
                 cost_rate: 0
               });
             }
          } else {
             inventoryLines.push({
               item_id: line.item_id,
               godown_id: line.godown_id,
               quantity: totalQtyForInventory.toString(),
               unit_id: line.unit_id,
               variant_id: line.variant_id ?? null,
               batch_id: line.batch_id ?? null,
               source_line_id: lineId,
               cost_rate: 0
             });
          }
        }

        for (const movement of inventoryLines.slice(costStart)) movement.cost_line_id = lineId;
        if (pricingRes.promotionalLines) {
          for (const pline of pricingRes.promotionalLines) {
            const pLineId = randomUUID();
            invoiceLinesData.push({
              id: pLineId,
              item_id: pline.itemId,
              godown_id: line.godown_id, // Alternate item pulled from same godown by default
              unit_id: pline.unitId || line.unit_id,
              quantity: pline.originalQuantity,
              free_quantity: pline.freeQuantity,
              rate: pline.resolvedRate,
              discount_amount: pline.discountAmount,
              taxable_value: pline.taxableValue,
              tax_amount: new Prisma.Decimal(0),
              line_total: pline.lineTotal,
              pricing_trace_json: JSON.stringify(pline.pricingTrace),
            });
            linePricingResults.push(pline as any);

            // Free items must be deducted from inventory
            const promotionalItem = await tx.item.findUnique({ where: { id: pline.itemId } });
            if (promotionalItem?.inventory_tracking === false) throw new BadRequestException('Add price-only promotional items as explicit bill lines');
            if (promotionalItem?.is_bundle || promotionalItem?.track_serial || promotionalItem?.has_variants) throw new BadRequestException('Add tracked or bundle promotional items as an explicit bill line');
            if (promotionalItem && promotionalItem.item_type !== 'SERVICE') {
              let promoFactor = new Prisma.Decimal(1);
              if (pline.unitId !== promotionalItem.primary_unit_id) {
                const cv = await tx.itemUnitConversion.findFirst({ where: { item_id: pline.itemId, from_unit_id: pline.unitId, to_unit_id: promotionalItem.primary_unit_id }});
                if (cv) promoFactor = new Prisma.Decimal(cv.conversion_factor);
              }
              const promoBaseQty = pline.freeQuantity.mul(promoFactor);

              let pBatchAllocations: { batchId: string, quantity: Prisma.Decimal }[] = [];
              if (promotionalItem.track_batch) {
                 pBatchAllocations = await this.batchExpiry.resolveBatchesForSale(companyId, {
                   itemId: pline.itemId,
                   godownId: line.godown_id,
                   quantityBase: promoBaseQty,
                   transactionDate: new Date(dto.document_date)
                 }, tx);
                 // We don't link these allocations back to the main invoice line structure easily unless we push them to invoiceLinesData
                 // Oh wait, promotional line IS an invoice line!
                 // I should update the invoiceLinesData entry for the promotional line above.
              }
              // Add randomUUID for each allocation to avoid unique constraint violations
              const pBatchAllocationsWithIds = pBatchAllocations.map(a => ({ ...a, id: randomUUID() }));

              // We need to mutate the last pushed invoice line for the promotional line
              const pLineEntry = invoiceLinesData[invoiceLinesData.length - 1];
              if (pBatchAllocationsWithIds.length > 0) {
                 pLineEntry.batch_id = pBatchAllocationsWithIds.length === 1 ? pBatchAllocationsWithIds[0].batchId : null;
                 pLineEntry.batch_allocations = {
                   create: pBatchAllocationsWithIds.map(a => ({ id: a.id, batch_id: a.batchId, quantity: a.quantity }))
                 };
                 for (const alloc of pBatchAllocationsWithIds) {
                   inventoryLines.push({
                     item_id: pline.itemId,
                     godown_id: line.godown_id,
                     quantity: alloc.quantity.toString(),
                     unit_id: promotionalItem.primary_unit_id,
                     source_line_id: alloc.id,
                     cost_line_id: pLineId,
                     batch_id: alloc.batchId,
                     cost_rate: 0
                   });
                 }
              } else {
                 inventoryLines.push({
                   item_id: pline.itemId,
                   godown_id: line.godown_id,
                   quantity: pline.freeQuantity.toString(),
                   unit_id: pline.unitId || line.unit_id,
                   source_line_id: pLineId,
                   cost_line_id: pLineId,
                   cost_rate: 0
                 });
              }
            }
          }
        }
      }

        // Attribute serial, FEFO, promotional and bundle component movements to immutable sale lines.
      if(dto.bill_discount){
        const allocated=allocateBillDiscount(invoiceLinesData,dto.bill_discount);
        invoiceLinesData.forEach((l,index)=>{const trace=linePricingResults[index].pricingTrace;
          linePricingResults[index].pricingTrace={...trace,discountAmount:l.discount_amount.toString(),finalLineAmount:l.taxable_value.toString(),billDiscountAllocation:allocated[index].toString()};
          l.pricing_trace_json=JSON.stringify(linePricingResults[index].pricingTrace);});
        taxableAmount=invoiceLinesData.reduce((s,l)=>s.plus(l.taxable_value),new Prisma.Decimal(0));
        taxAmount=invoiceLinesData.reduce((s,l)=>s.plus(l.tax_amount),new Prisma.Decimal(0));
        discountAmount=invoiceLinesData.reduce((s,l)=>s.plus(l.discount_amount),new Prisma.Decimal(0));grandTotal=taxableAmount.plus(taxAmount);
      }
      // Money Rounding Policy: Grand total is rounded to 2 decimal places.
      const rawGrandTotal = grandTotal;
      grandTotal = grandTotal.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const roundingDifference = grandTotal.sub(rawGrandTotal);

      // Check payment matches
      const paymentTotal = dto.payments.reduce((acc, p) => acc.add(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0));
      if (paymentTotal.gt(grandTotal)) {
        throw new BadRequestException(`Payment total (${paymentTotal.toString()}) exceeds invoice total (${grandTotal.toString()}).`);
      }
      const outstanding = grandTotal.minus(paymentTotal);
      if (outstanding.gt(0)) {
        if (!dto.party_id || saleParty.is_walkin || saleParty.party_type !== 'CUSTOMER' || !saleParty.credit_allowed) throw new BadRequestException('Select a customer with credit enabled for Udhar');
        const allocations = await tx.billAllocation.findMany({ where: { company_id: companyId, party_id: saleParty.id } });
        const balance = allocations.reduce((sum, a) => a.allocation_type === 'NEW_REFERENCE' ? sum.plus(a.amount) : sum.minus(a.amount), new Prisma.Decimal(0));
        if (saleParty.credit_limit && balance.plus(outstanding).gt(saleParty.credit_limit)) throw new BadRequestException('Customer credit limit exceeded');
      }
      const date = new Date(dto.document_date);
      const fy = await tx.financialYear.findFirst({ where: { company_id: companyId, is_closed: false, start_date: { lte: date }, end_date: { gte: new Date(date.toISOString().slice(0,10)) } } });
      if (!fy) throw new BadRequestException('No open financial year covers the bill date');
      const due = dto.due_date ? new Date(dto.due_date) : new Date(date.getTime() + (saleParty.credit_days || 0) * 86400000);
      if (due < new Date(date.toISOString().slice(0,10))) throw new BadRequestException('Due date must be on or after the bill date');

      // 2. Create POS SalesInvoice
      const docDate = new Date(dto.document_date);
      const invoicePayload = {
        data: {
          company_id: companyId,
          branch_id: dto.branch_id,
          financial_year_id: fy.id,
          party_id: partyId,
          document_number: await nextShopBillNumber(tx,companyId),
          document_date: docDate,
          status: 'POSTED',
          is_pos: true,
          walkin_name: dto.walkin_name,
          walkin_phone: dto.walkin_phone,
          taxable_amount: taxableAmount,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          grand_total: grandTotal,
          paid_amount: paymentTotal,
          outstanding_amount: outstanding,
          due_date: due,
          notes: dto.note,
          sales_channel: dto.sales_channel || 'COUNTER',
          payment_snapshot: dto.payments.filter(p => p.amount > 0).map(p => ({ method: p.payment_method, amount: p.amount, ...paymentRecipient(config?.payment_configuration,p) })),
          posted_at: new Date(),
          posted_by: userId,
          lines: {
            create: invoiceLinesData
          }
        },
        include: { lines: true }
      };
      const invoice: any = await tx.salesInvoice.create(invoicePayload as any);

      // Record immutable pricing traces
      await tx.pricingTrace.createMany({
        data: invoiceLinesData.map((il: any, idx: number) => {
          const t = linePricingResults[idx].pricingTrace;
          return {
            company_id: companyId,
            document_type: 'POS_SALE',
            document_id: invoice.id,
            line_id: il.id,
            item_id: t.itemId,
            party_id: t.partyId ?? null,
            pricing_engine_version: t.pricingEngineVersion,
            base_price: new Prisma.Decimal(t.basePrice),
            resolved_rate: new Prisma.Decimal(t.resolvedRate),
            price_list_id: t.priceListId ?? null,
            price_list_item_id: t.priceListItemId ?? null,
            customer_rate_id: t.customerRateId ?? null,
            quantity_slab_id: t.quantitySlabId ?? null,
            promotion_id: t.promotionId ?? null,
            original_quantity: new Prisma.Decimal(t.originalQuantity),
            charged_quantity: new Prisma.Decimal(t.chargedQuantity),
            free_quantity: new Prisma.Decimal(t.freeQuantity),
            discount_amount: new Prisma.Decimal(t.discountAmount),
            discount_percent: new Prisma.Decimal(t.discountPercent),
            final_unit_price: new Prisma.Decimal(t.finalUnitPrice),
            final_line_amount: new Prisma.Decimal(t.finalLineAmount),
            precedence_reason: t.precedenceReason,
            trace_details_json: JSON.stringify(t),
          };
        }),
      });

      // 3. Post Inventory
      if (inventoryLines.length > 0) {
        await this.inventory.postMovement(tx, {
          company_id: invoice.company_id,
          branch_id: invoice.branch_id,
          movement_type: 'SALES_OUT',
          business_date: invoice.document_date,
          source_document_type: 'SALES_INVOICE',
          source_document_id: invoice.id,
          lines: inventoryLines
        });
      }

      await snapshotDocumentCosts(tx, this.accounting, invoice, 'SALE', userId);

      // 4. Post Accounting for Sale
      for (const line of invoice.lines) {
        if (!Array.isArray(line.serial_ids)) continue;
        const snapshot: any = line.warranty_snapshot;
        for (const serialId of line.serial_ids as string[]) {
          await tx.itemSerial.update({ where: { id: serialId }, data: { sold_to_id: partyId, sales_invoice_id: invoice.id,
            warranty_start: new Date(snapshot.start), warranty_end: new Date(snapshot.end) } });
          await tx.serialAllocation.create({ data: { company_id: companyId, serial_id: serialId, source_document_type: 'SALES_INVOICE',
            source_document_id: invoice.id, source_line_id: line.id, warranty_snapshot: snapshot } });
        }
      }
      let partyAccount: any;
      if (partyId) {
        partyAccount = await tx.ledgerAccount.findFirst({
          where: { party_id: partyId, company_id: companyId }
        });
      } else {
        partyAccount = await tx.ledgerAccount.findFirst({
          where: { code: 'CASH', company_id: companyId }
        });
      }
      if (!partyAccount) {
        // If it was dynamically created walk-in or missing, create one
        partyAccount = await tx.ledgerAccount.create({
          data: {
            company_id: companyId,
            branch_id: invoice.branch_id,
            party_id: partyId,
            code: `WALKIN_AR_${Date.now()}`,
            name: 'Walk-in Customer AR',
            account_type: 'ASSET',
            normal_balance: 'DEBIT',
            is_active: true
          }
        });
      }

      let salesAccount = await tx.ledgerAccount.findFirst({
        where: { code: 'SALES_REVENUE', company_id: companyId }
      });
      if (!salesAccount) {
        salesAccount = await tx.ledgerAccount.create({
          data: {
            company_id: companyId,
            branch_id: invoice.branch_id,
            code: 'SALES_REVENUE',
            name: 'Sales Revenue',
            account_type: 'REVENUE',
            normal_balance: 'CREDIT',
            is_system: true,
            is_active: true
          }
        });
      }

      const salesVoucherLines = [];
      salesVoucherLines.push({
        ledger_account_id: partyAccount.id,
        party_id: partyId,
        debit: grandTotal.toNumber(),
        credit: 0
      });
      salesVoucherLines.push({
        ledger_account_id: salesAccount.id,
        debit: 0,
        credit: taxableAmount.toNumber()
      });
      
      if (!roundingDifference.isZero()) {
        let roundOffAccount = await tx.ledgerAccount.findFirst({ where: { code: 'ROUND_OFF', company_id: companyId } });
        if (!roundOffAccount) {
          roundOffAccount = await tx.ledgerAccount.create({
            data: { company_id: companyId, branch_id: invoice.branch_id, code: 'ROUND_OFF', name: 'Rounding Off', account_type: 'EXPENSE', normal_balance: 'DEBIT', is_system: true, is_active: true }
          });
        }
        if (roundingDifference.gt(0)) {
           salesVoucherLines.push({ ledger_account_id: roundOffAccount.id, debit: 0, credit: roundingDifference.abs().toNumber() }); // wait, if grandTotal > raw, we increased AR (Debit). So we must Credit Round Off.
        } else {
           salesVoucherLines.push({ ledger_account_id: roundOffAccount.id, debit: roundingDifference.abs().toNumber(), credit: 0 }); // if grandTotal < raw, we decreased AR. So we Debit Round Off.
        }
      }

      if (Number(invoice.tax_amount) > 0) {
        let taxAccount = await tx.ledgerAccount.findFirst({
          where: { code: 'OUTPUT_GST', company_id: companyId }
        });
        if (!taxAccount) {
          taxAccount = await tx.ledgerAccount.create({
            data: {
              company_id: companyId,
              branch_id: invoice.branch_id,
              code: 'OUTPUT_GST',
              name: 'Output GST',
              account_type: 'LIABILITY',
              normal_balance: 'CREDIT',
              is_system: true,
              is_active: true
            }
          });
        }
        salesVoucherLines.push({
          ledger_account_id: taxAccount.id,
          debit: 0,
          credit: Number(invoice.tax_amount)
        });
      }

      const salesVoucher = await this.accounting.postVoucher(tx, {
        company_id: invoice.company_id,
        branch_id: invoice.branch_id,
        financial_year_id: invoice.financial_year_id,
        voucher_type: 'SALES',
        document_number: invoice.document_number,
        voucher_date: invoice.document_date,
        source_document_type: 'SALES_INVOICE',
        source_document_id: invoice.id,
        narration: `POS Sale ${invoice.document_number}`,
        posted_by: userId,
        lines: salesVoucherLines
      });

      const customerSalesVoucherLine = salesVoucher.lines.find(l => l.ledger_account_id === partyAccount.id);
      
      let billAllocation;
      if (customerSalesVoucherLine) {
        billAllocation = await tx.billAllocation.create({
          data: {
            company_id: invoice.company_id,
            party_id: invoice.party_id,
            voucher_line_id: customerSalesVoucherLine.id,
            reference_document_type: 'SALES_INVOICE',
            reference_document_id: invoice.id,
            allocation_type: 'NEW_REFERENCE',
            amount: invoice.grand_total,
            due_date: invoice.due_date
          }
        });
      }

      // 5. Post Payments (Receipt Voucher)
      const receiptVoucherLines = [];
      for (const payment of dto.payments) {
        let paymentLedgerId;
        if (payment.payment_method === 'CASH') {
          if (defaultCashLedgerId) {
            paymentLedgerId = defaultCashLedgerId;
          } else {
            let cashAcc = await tx.ledgerAccount.findFirst({ where: { code: 'CASH_IN_HAND', company_id: companyId } });
            if (!cashAcc) cashAcc = await tx.ledgerAccount.create({ data: { company_id: companyId, branch_id: invoice.branch_id, code: 'CASH_IN_HAND', name: 'Cash in Hand', account_type: 'ASSET', normal_balance: 'DEBIT', is_system: true, is_active: true } });
            paymentLedgerId = cashAcc.id;
          }
        } else if (['BANK','UPI','CARD'].includes(payment.payment_method)) {
          if (defaultBankLedgerId) {
            paymentLedgerId = defaultBankLedgerId;
          } else {
            let bankAcc = await tx.ledgerAccount.findFirst({ where: { code: 'DEFAULT_BANK', company_id: companyId } });
            if (!bankAcc) bankAcc = await tx.ledgerAccount.create({ data: { company_id: companyId, branch_id: invoice.branch_id, code: 'DEFAULT_BANK', name: 'Default Bank', account_type: 'ASSET', normal_balance: 'DEBIT', is_system: true, is_active: true } });
            paymentLedgerId = bankAcc.id;
          }
        }

        if (!paymentLedgerId) throw new BadRequestException('Payment ledger not configured');

        receiptVoucherLines.push({
          ledger_account_id: paymentLedgerId,
          debit: Number(payment.amount),
          credit: 0
        });
      }

      if (paymentTotal.gt(0)) {
        receiptVoucherLines.push({
          ledger_account_id: partyAccount.id,
          party_id: partyId,
          debit: 0,
          credit: paymentTotal.toNumber()
        });

        const receiptVoucher = await this.accounting.postVoucher(tx, {
          company_id: invoice.company_id,
          branch_id: invoice.branch_id,
          financial_year_id: invoice.financial_year_id,
          voucher_type: 'RECEIPT',
          document_number: `RCPT-${randomUUID()}`,
          voucher_date: invoice.document_date,
          source_document_type: 'POS_RECEIPT',
          source_document_id: invoice.id,
          narration: `POS Payment for ${invoice.document_number}`,
          posted_by: userId,
          payment_method: dto.payments.length === 1 ? dto.payments[0].payment_method : 'SPLIT',
          lines: receiptVoucherLines
        });

        const customerReceiptVoucherLine = receiptVoucher.lines.find(l => l.ledger_account_id === partyAccount.id);

        // Allocate the receipt against the sales invoice
        if (customerReceiptVoucherLine) {
          await tx.billAllocation.create({
            data: {
              company_id: invoice.company_id,
              party_id: invoice.party_id,
              voucher_line_id: customerReceiptVoucherLine.id,
              reference_document_type: 'SALES_INVOICE',
              reference_document_id: invoice.id,
              allocation_type: 'AGAINST_REFERENCE',
              amount: paymentTotal,
              due_date: invoice.document_date
            }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          company_id: invoice.company_id,
          branch_id: invoice.branch_id,
          user_id: userId,
          action: 'POS_SALE_POSTED',
          source_document_type: 'SALES_INVOICE',
          source_document_id: invoice.id,
          affected_voucher_id: salesVoucher.id,
        }
      });

      return invoice;
    });
  }

  async quoteSale(companyId: string, dto: CreatePosSaleDto) {
    return this.prisma.$transaction(async tx => {
      if (!await tx.branch.findFirst({ where: { id: dto.branch_id, company_id: companyId } })) throw new BadRequestException('Branch not found');
      if (dto.party_id && !await tx.party.findFirst({ where: { id: dto.party_id, company_id: companyId } })) throw new BadRequestException('Customer not found');
      let total = new Prisma.Decimal(0);
      const lines = [];
      for (const line of dto.lines) {
        const item = await tx.item.findFirst({ where: { id: line.item_id, company_id: companyId, is_active: true }, include: { tax_class: true } });
        if (!item || !Number.isFinite(line.quantity) || line.quantity <= 0) throw new BadRequestException('Invalid item or quantity');
        const qty = this.saleQuantity(item.selling_mode, line.quantity, line.dimensions);
        const price = await this.pricingEngine.calculateLinePricing(companyId, dto.party_id, {
          itemId: item.id, variantId: line.variant_id, batchId: line.batch_id, unitId: line.unit_id, quantity: qty,
          overrideRate: Number(line.rate) > 0 ? line.rate : undefined, overrideDiscountAmount: Number(line.discount_amount) > 0 ? line.discount_amount : undefined,
        }, { branchId: dto.branch_id, documentDate: dto.document_date, isPos: true }, tx);
        await this.composition.modifierPricing(tx, companyId, item.id, line.modifier_option_ids, qty, price);
        if (item.is_bundle) {
          if (!await tx.godown.findFirst({ where: { id: line.godown_id, branch_id: dto.branch_id } })) throw new BadRequestException('Stock location not found');
          let factor = new Prisma.Decimal(1);
          if (line.unit_id !== item.primary_unit_id) {
            const conversion = await tx.itemUnitConversion.findFirst({ where: { item_id: item.id, from_unit_id: line.unit_id, to_unit_id: item.primary_unit_id } });
            if (!conversion) throw new BadRequestException('Unit conversion is not configured');
            factor = new Prisma.Decimal(conversion.conversion_factor);
          }
          await this.composition.prepareBundle(tx, companyId, item.id, line.godown_id, qty.plus(price.freeQuantity).mul(factor), dto.document_date);
        }
        if (price.taxableValue.lt(0)) throw new BadRequestException('Discount exceeds the line value');
        const tax = price.taxableValue.mul(item.tax_class?.tax_rate || 0).div(100).toDecimalPlaces(2);
        const value = price.taxableValue.plus(tax);
        lines.push({ item_id: item.id, taxable_value: price.taxableValue.toNumber(), tax_amount: tax.toNumber(), line_total: value.toNumber(), free_quantity: price.freeQuantity.toNumber() });
        total = total.plus(value);
      }
      if(dto.bill_discount){allocateBillDiscount(lines,dto.bill_discount);total=lines.reduce((s,l)=>s.plus(l.line_total),new Prisma.Decimal(0));}
      return { grand_total: total.toDecimalPlaces(2).toNumber(), lines };
    });
  }

  private saleQuantity(mode: string, quantity: number, dimensions?: any) {
    let result = new Prisma.Decimal(quantity);
    if (['AREA','VOLUME'].includes(mode) && dimensions) {
      const length = new Prisma.Decimal(dimensions.length || 0), width = new Prisma.Decimal(dimensions.width || 0);
      const height = new Prisma.Decimal(mode === 'VOLUME' ? dimensions.height || 0 : 1);
      if (length.lte(0) || width.lte(0) || height.lte(0)) throw new BadRequestException('Dimensions must be positive');
      result = result.mul(length).mul(width).mul(height);
    }
    return result;
  }

  async getCurrentShift(companyId: string, branchId: string, userId: string) {
    return this.prisma.posShift.findFirst({
      where: { company_id: companyId, branch_id: branchId, user_id: userId, status: 'OPEN' }
    });
  }

  async openShift(companyId: string, userId: string, dto: OpenShiftDto) {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
    if (!await tx.branch.findFirst({ where: { id: dto.branch_id, company_id: companyId } })) throw new BadRequestException('Branch not found');
    if (await tx.posShift.findFirst({where:{company_id:companyId,branch_id:dto.branch_id,user_id:userId,status:'OPEN'}})) throw new BadRequestException('A shift is already open for this user in this branch');
    return tx.posShift.create({
      data: {
        company_id: companyId,
        branch_id: dto.branch_id,
        user_id: userId,
        status: 'OPEN',
        opening_balance: dto.opening_balance || 0,
        notes: dto.notes
      }
    });
    });
  }

  async closeShift(shiftId: string, companyId: string, userId: string, dto: CloseShiftDto) {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM pos_shifts WHERE id=${shiftId}::uuid AND company_id=${companyId}::uuid FOR UPDATE`;
    const shift = await tx.posShift.findUnique({ where: { id: shiftId } });
    if (!shift || shift.company_id !== companyId || shift.user_id !== userId) {
      throw new ForbiddenException('Shift not found or unauthorized');
    }
    if (shift.status === 'CLOSED') {
      throw new BadRequestException('Shift is already closed');
    }

    const closedAt = new Date();
    const config = await tx.companyConfiguration.findUnique({where:{company_id:companyId}});
    // A shift reconciles the branch counter, including cash receipts, payments,
    // expenses and refunds posted during its interval. UPI/Bank never add cash.
    const movement = await tx.voucherLine.aggregate({where:{voucher:{company_id:companyId,branch_id:shift.branch_id,status:'POSTED',posted_at:{gte:shift.opened_at,lte:closedAt}},ledger_account:{company_id:companyId,OR:[{code:{in:['CASH','CASH_IN_HAND']}},...(config?.default_cash_ledger_id?[{id:config.default_cash_ledger_id}]:[])]}},_sum:{debit:true,credit:true}});
    const expected_balance = new Prisma.Decimal(shift.opening_balance).plus(movement._sum.debit||0).minus(movement._sum.credit||0);
    const closing_balance = dto.closing_balance ?? expected_balance;
    const variance = new Prisma.Decimal(closing_balance).sub(expected_balance);

    return tx.posShift.update({
      where: { id: shiftId },
      data: {
        status: 'CLOSED',
        closed_at: closedAt,
        closing_balance,
        expected_balance,
        variance,
        notes: dto.notes
      }
    });
    });
  }

  async getHeldBills(companyId: string, branchId: string, userId: string) {
    return this.prisma.posHeldBill.findMany({
      where: { company_id: companyId, branch_id: branchId, user_id: userId },
      include: { lines: true },
      orderBy: { created_at: 'desc' }
    });
  }

  async holdBill(companyId: string, userId: string, dto: HoldBillDto) {
    let grandTotal = new Prisma.Decimal(0);
    const lines = dto.lines.map(l => {
      const lineTotal = new Prisma.Decimal(l.quantity).mul(l.rate).sub(l.discount_amount || 0);
      grandTotal = grandTotal.add(lineTotal);
      return {
        item_id: l.item_id,
        godown_id: l.godown_id,
        unit_id: l.unit_id,
        quantity: l.quantity,
        rate: l.rate,
        discount_amount: l.discount_amount || 0,
        variant_id: l.variant_id, batch_id: l.batch_id, serial_ids: l.serial_ids, dimensions: l.dimensions,
        modifiers: l.modifier_option_ids ? { option_ids: l.modifier_option_ids } : undefined
      };
    });

    return this.prisma.posHeldBill.create({
      data: {
        company_id: companyId,
        branch_id: dto.branch_id,
        user_id: userId,
        reference_name: dto.reference_name,
        bill_discount: dto.bill_discount || 0,
        customer_id: dto.customer_id,
        notes: dto.notes,
        grand_total: grandTotal,
        lines: {
          create: lines
        }
      },
      include: { lines: true }
    });
  }

  async resumeBill(heldBillId: string, companyId: string, userId: string) {
    const bill = await this.prisma.posHeldBill.findUnique({ where: { id: heldBillId }, include: { lines: true } });
    if (!bill || bill.company_id !== companyId || bill.user_id !== userId) {
      throw new ForbiddenException('Held bill not found or unauthorized');
    }

    await this.prisma.posHeldBill.delete({ where: { id: heldBillId } });
    return bill;
  }

  async postPosReturn(companyId: string, userId: string, dto: CreatePosReturnDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Setup & validation
      const docDate = new Date(dto.document_date);
      let taxableAmount = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);
      let grandTotal = new Prisma.Decimal(0);
      const returnLinesData = [];
      const inventoryLines = [];


      if (!dto.lines.length) throw new BadRequestException('Select items to return');
      if (!await tx.branch.findFirst({ where: { id: dto.branch_id, company_id: companyId } })) throw new BadRequestException('Branch not found');
      let original: any = null;
      if (dto.original_invoice_id) {
        await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id = ${dto.original_invoice_id}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
        original = await tx.salesInvoice.findFirst({ where: { id: dto.original_invoice_id, company_id: companyId, branch_id: dto.branch_id, status: 'POSTED' } });
        if (!original) throw new BadRequestException('Original invoice not found');
        if (dto.party_id && dto.party_id !== original.party_id) throw new BadRequestException('Customer must match the original invoice');
      }
      const requested = new Map<string, Prisma.Decimal>();
      for (const input of dto.lines) {
        const costStart = inventoryLines.length;
        if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new BadRequestException('Return quantity must be positive');
        const item = await tx.item.findFirst({ where: { id: input.item_id, company_id: companyId } });
        if (!item) throw new BadRequestException('Item not found');
        if (!await tx.godown.findFirst({ where: { id: input.godown_id, branch_id: dto.branch_id } })) throw new BadRequestException('Stock location not found');
        let source: any = null;
        if (original) {
          const candidates = await tx.salesInvoiceLine.findMany({ where: { sales_invoice_id: original.id, item_id: input.item_id,
            ...(input.original_line_id ? { id: input.original_line_id } : {}),
            ...(!input.original_line_id && input.variant_id ? { variant_id: input.variant_id } : {}) }, include: { batch_allocations: { orderBy: { created_at: 'desc' } } } });
          if (candidates.length !== 1) throw new BadRequestException('Select an exact original invoice line');
          source = candidates[0];
        }
        const unitId = source?.entered_unit_id || input.unit_id;
        let factor = source?.conversion_factor ? new Prisma.Decimal(source.conversion_factor) : new Prisma.Decimal(1);
        if (!source && unitId !== item.primary_unit_id) {
          const conversion = await tx.itemUnitConversion.findFirst({ where: { item_id: item.id, from_unit_id: unitId, to_unit_id: item.primary_unit_id } });
          if (!conversion) throw new BadRequestException('Unit conversion not found');
          factor = new Prisma.Decimal(conversion.conversion_factor);
        }
        const dimensions: any = source?.dimensions || input.dimensions;
        let measured = new Prisma.Decimal(input.quantity);
        if (dimensions) measured = measured.mul(dimensions.length || 1).mul(dimensions.width || 1).mul(dimensions.height || 1);
        const baseQty = measured.mul(factor);
        let previous: any[] = [];
        if (source) {
          previous = await tx.salesReturnLine.findMany({ where: { sales_return: { company_id: companyId, original_invoice_id: original.id, status: 'POSTED' },
            OR: [{ original_line_id: source.id }, { original_line_id: null, item_id: source.item_id, variant_id: source.variant_id }] }, include: { batch_allocations: true } });
          const already = previous.reduce((sum, l) => sum.plus(l.base_quantity || l.quantity), new Prisma.Decimal(0));
          const inRequest = requested.get(source.id) || new Prisma.Decimal(0);
          if (requested.has(source.id)) throw new BadRequestException('Combine duplicate return lines');
          if (already.plus(inRequest).plus(baseQty).gt(source.base_quantity || source.quantity)) throw new BadRequestException('Return exceeds the quantity sold');
          requested.set(source.id, inRequest.plus(baseQty));
        }
        const ratio = source ? baseQty.div(source.base_quantity || source.quantity) : null;
        const completes=source&&previous.reduce((sum,l)=>sum.plus(l.base_quantity||l.quantity),new Prisma.Decimal(0)).plus(baseQty).eq(source.base_quantity||source.quantity);
        const returnedValue=(field:string)=>previous.reduce((sum,l)=>sum.plus(l[field]),new Prisma.Decimal(0));
        const taxableValue = source ? completes?new Prisma.Decimal(source.taxable_value).minus(returnedValue('taxable_value')):new Prisma.Decimal(source.taxable_value).mul(ratio!).toDecimalPlaces(2) : measured.mul(input.rate).minus(input.discount_amount || 0);
        const lineTax = source ? completes?new Prisma.Decimal(source.tax_amount).minus(returnedValue('tax_amount')):new Prisma.Decimal(source.tax_amount).mul(ratio!).toDecimalPlaces(2) : new Prisma.Decimal(0);
        if (taxableValue.lt(0)) throw new BadRequestException('Invalid return value');
        const lineTotal = taxableValue.plus(lineTax);
        taxableAmount = taxableAmount.plus(taxableValue); taxAmount = taxAmount.plus(lineTax); grandTotal = grandTotal.plus(lineTotal);
        const lineId = randomUUID();
        const returnedBatches: { id: string; batchId: string; quantity: Prisma.Decimal }[] = [];
        if (source?.batch_allocations?.length) {
          let left = baseQty;
          for (const a of source.batch_allocations) {
            const returned = previous.flatMap(l => l.batch_allocations).filter(b => b.batch_id === a.batch_id).reduce((sum, b) => sum.plus(b.quantity), new Prisma.Decimal(0));
            const available = new Prisma.Decimal(a.quantity).minus(returned);
            const qty = Prisma.Decimal.min(left, available);
            if (qty.gt(0)) { returnedBatches.push({ id: randomUUID(), batchId: a.batch_id, quantity: qty }); left = left.minus(qty); }
          }
          if (left.gt(0)) throw new BadRequestException('Original batch allocation is insufficient');
        } else if (source?.batch_id || input.batch_id) returnedBatches.push({ id: randomUUID(), batchId: source?.batch_id || input.batch_id!, quantity: baseQty });
        const variant = source ? source.variant_id : input.variant_id;
        const serialIds = input.serial_ids || [];
        if (item.track_serial) {
          if (!source || !baseQty.isInteger() || serialIds.length !== baseQty.toNumber() || new Set(serialIds).size !== serialIds.length)
            throw new BadRequestException('Select exactly the original serials being returned');
          const allocations = await tx.serialAllocation.findMany({ where: { company_id: companyId, source_line_id: source.id,
            source_document_id: original.id, serial_id: { in: serialIds }, returned_at: null }, include: { serial: true } });
          if (allocations.length !== serialIds.length || allocations.some(a => a.serial.status !== 'SOLD' || a.serial.sales_invoice_id !== original.id))
            throw new BadRequestException('Serial was not sold on this line or has already been returned');
          if (returnedBatches.length) {
            returnedBatches.splice(0);
            for (const a of allocations) {
              if (!a.serial.batch_id) continue;
              const group = returnedBatches.find(b => b.batchId === a.serial.batch_id);
              if (group) group.quantity = group.quantity.plus(1);
              else returnedBatches.push({ id: randomUUID(), batchId: a.serial.batch_id, quantity: new Prisma.Decimal(1) });
            }
          }
        } else if (serialIds.length) throw new BadRequestException('Serial tracking is disabled');
        returnLinesData.push({ id: lineId, cost_status:source?.cost_status||null, original_line_id: source?.id, item_id: item.id, godown_id: source?.godown_id || input.godown_id,
          serial_ids: serialIds.length ? serialIds : undefined,
          unit_id: item.primary_unit_id, entered_unit_id: unitId, entered_quantity: input.quantity, conversion_factor: factor,
          base_quantity: baseQty, quantity: baseQty, variant_id: variant || null, batch_id: returnedBatches.length === 1 ? returnedBatches[0].batchId : null,
          dimensions: dimensions || undefined, rate: source?.rate || input.rate, taxable_value: taxableValue, tax_amount: lineTax, line_total: lineTotal,
          batch_allocations: returnedBatches.length ? { create: returnedBatches.map(a => ({ id: a.id, batch_id: a.batchId, quantity: a.quantity })) } : undefined });
        if (source?.bundle_snapshot) inventoryLines.push(...await this.composition.returnBundle(tx, companyId, source, ratio!));
        else if (item.is_bundle) throw new BadRequestException('Return a bundle using its original invoice and inventory snapshot');
        else if (item.item_type !== 'SERVICE' && (source ? source.inventory_tracked : item.inventory_tracking !== false)) {
          if (item.track_serial) {
            for (const serialId of serialIds) {
              const serial = await tx.itemSerial.findUnique({ where: { id: serialId } });
              inventoryLines.push({ item_id: item.id, godown_id: source.godown_id, unit_id: item.primary_unit_id,
                variant_id: variant || null, batch_id: serial!.batch_id, serial_id: serialId, quantity: '1', source_line_id: serialId, cost_rate: 0 });
            }
          } else {
            const allocations = returnedBatches.length ? returnedBatches : [{ id: lineId, batchId: null, quantity: baseQty }];
            for (const a of allocations) inventoryLines.push({ item_id: item.id, godown_id: source?.godown_id || input.godown_id, unit_id: item.primary_unit_id,
              variant_id: variant || null, batch_id: a.batchId, quantity: a.quantity.toString(), source_line_id: a.id, cost_rate: 0 });
          }
        }
        for (const movement of inventoryLines.slice(costStart)) {
          movement.cost_line_id = lineId;
          movement.cost_origin_document_id = original?.id;
          movement.cost_origin_line_id = source?.id;
        }
      }
      const fy = await tx.financialYear.findFirst({ where: { company_id: companyId, is_closed: false, start_date: { lte: docDate }, end_date: { gte: new Date(docDate.toISOString().slice(0,10)) } } });
      if (!fy) throw new BadRequestException('No open financial year covers the return date');
      let partyId = original?.party_id || dto.party_id;
      if (!partyId) partyId = (await tx.party.findFirst({ where: { company_id: companyId, is_walkin: true } }))?.id;
      if (!partyId || !await tx.party.findFirst({ where: { id: partyId, company_id: companyId } })) throw new BadRequestException('Customer not found');

      // 2. Create Sales Return
      const sr = await tx.salesReturn.create({
        data: {
          company_id: companyId,
          branch_id: dto.branch_id,
          financial_year_id: fy.id,
          party_id: partyId,
          original_invoice_id: dto.original_invoice_id,
          document_number: `POS-RET-${randomUUID()}`,
          document_date: docDate,
          status: 'POSTED',
          taxable_amount: taxableAmount,
          tax_amount: taxAmount,
          grand_total: grandTotal,
          posted_at: new Date(),
          posted_by: userId,
          lines: { create: returnLinesData }
        },
        include: { lines: true }
      });

      // 3. Post Inventory Return
      if (inventoryLines.length > 0) {
        await this.inventory.postMovement(tx, {
          company_id: sr.company_id,
          branch_id: sr.branch_id,
          movement_type: 'SALES_RETURN_IN',
          business_date: sr.document_date,
          source_document_type: 'SALES_RETURN',
          source_document_id: sr.id,
          lines: inventoryLines
        });
      }

      await snapshotDocumentCosts(tx, this.accounting, sr, 'RETURN', userId);

      // 4. Accounting Reversal (CR Party, DR Sales Returns, DR Tax)
      for (const line of sr.lines) {
        if (!Array.isArray(line.serial_ids)) continue;
        await tx.serialAllocation.updateMany({ where: { company_id: companyId, source_line_id: line.original_line_id!,
          serial_id: { in: line.serial_ids as string[] }, returned_at: null }, data: { returned_at: new Date(), return_document_id: sr.id } });
        await tx.itemSerial.updateMany({ where: { company_id: companyId, id: { in: line.serial_ids as string[] } },
          data: { sold_to_id: null, sales_invoice_id: null, warranty_start: null, warranty_end: null } });
      }
      let partyAccount = null;
      if (partyId) {
        partyAccount = await tx.ledgerAccount.findFirst({ where: { party_id: partyId, company_id: companyId } });
      } else {
        partyAccount = await tx.ledgerAccount.findFirst({ where: { code: 'CASH', company_id: companyId } });
      }

      let salesAccount = await tx.ledgerAccount.findFirst({ where: { code: 'SALES_REVENUE', company_id: companyId } });

      if (!partyAccount || !salesAccount) throw new BadRequestException('Ledger accounts missing');

      const voucherLines = [];
      voucherLines.push({ ledger_account_id: partyAccount.id, party_id: partyId, debit: 0, credit: grandTotal.toNumber() });
      voucherLines.push({ ledger_account_id: salesAccount.id, debit: taxableAmount.toNumber(), credit: 0 });

      if (Number(sr.tax_amount) > 0) {
        const taxAccount = await tx.ledgerAccount.findFirst({ where: { code: 'OUTPUT_GST', company_id: companyId } });
        if (taxAccount) {
          voucherLines.push({ ledger_account_id: taxAccount.id, debit: Number(sr.tax_amount), credit: 0 });
        }
      }

      const returnVoucher = await this.accounting.postVoucher(tx, {
        company_id: sr.company_id,
        branch_id: sr.branch_id,
        financial_year_id: sr.financial_year_id,
        voucher_type: 'SALES_RETURN',
        document_number: sr.document_number,
        voucher_date: sr.document_date,
        source_document_type: 'SALES_RETURN',
        source_document_id: sr.id,
        narration: `POS Sales Return ${sr.document_number}`,
        posted_by: userId,
        lines: voucherLines
      });

      // 5. Bill Allocation
      const customerVoucherLine = returnVoucher.lines.find(l => l.ledger_account_id === partyAccount.id);
      if (customerVoucherLine) {
        await tx.billAllocation.create({
          data: {
            company_id: sr.company_id,
            party_id: sr.party_id,
            voucher_line_id: customerVoucherLine.id,
            reference_document_type: sr.original_invoice_id ? 'SALES_INVOICE' : 'SALES_RETURN',
            reference_document_id: sr.original_invoice_id || sr.id,
            allocation_type: sr.original_invoice_id ? 'AGAINST_REFERENCE' : 'NEW_REFERENCE',
            amount: sr.grand_total,
            due_date: sr.document_date
          }
        });
      }


      if (dto.refund_method === 'CASH') {
        if (!original) throw new BadRequestException('Cash refund requires an original invoice');
        const priorRefunds = await tx.voucher.findMany({ where: { company_id: companyId, source_document_type: 'POS_REFUND',
          source_document_id: { in: (await tx.salesReturn.findMany({ where: { company_id: companyId, original_invoice_id: original.id } })).map(r => r.id) }, status: 'POSTED' },
          include: { lines: true } });
        const refunded = priorRefunds.flatMap(v => v.lines).filter(l => l.party_id === partyId).reduce((sum, l) => sum.plus(l.debit), new Prisma.Decimal(0));
        if (grandTotal.gt(new Prisma.Decimal(original.paid_amount).minus(refunded))) throw new BadRequestException('Cash refund exceeds the money received for the original bill; use Khata adjustment');
        const cash = await tx.ledgerAccount.findFirst({ where: { company_id: companyId, code: 'CASH_IN_HAND' } });
        if (!cash) throw new BadRequestException('Cash account not configured');
        const refund = await this.accounting.postVoucher(tx, { company_id: companyId, branch_id: dto.branch_id, financial_year_id: fy.id,
          voucher_type: 'PAYMENT', document_number: 'REFUND-' + randomUUID(), voucher_date: docDate, source_document_type: 'POS_REFUND',
          source_document_id: sr.id, posted_by: userId, payment_method: 'CASH', narration: 'Refund for ' + original.document_number,
          lines: [{ ledger_account_id: partyAccount.id, party_id: partyId, debit: grandTotal, credit: 0 }, { ledger_account_id: cash.id, debit: 0, credit: grandTotal }] });
        await tx.billAllocation.create({ data: { company_id: companyId, party_id: partyId,
          voucher_line_id: refund.lines.find(l => l.party_id === partyId)!.id, reference_document_type: 'SALES_INVOICE', reference_document_id: original.id,
          allocation_type: 'NEW_REFERENCE', amount: grandTotal } });
      }
      if (original) {
        const allocations = await tx.billAllocation.findMany({ where: { company_id: companyId, party_id: partyId, reference_document_id: original.id } });
        const balance = allocations.reduce((sum, a) => a.allocation_type === 'NEW_REFERENCE' ? sum.plus(a.amount) : sum.minus(a.amount), new Prisma.Decimal(0));
        await tx.salesInvoice.update({ where: { id: original.id }, data: { outstanding_amount: Prisma.Decimal.max(0, balance) } });
      }

      await tx.auditLog.create({
        data: {
          company_id: sr.company_id,
          branch_id: sr.branch_id,
          user_id: userId,
          action: 'POS_RETURN_POSTED',
          source_document_type: 'SALES_RETURN',
          source_document_id: sr.id,
          affected_voucher_id: returnVoucher.id,
        }
      });

      return sr;
    });
  }
}
