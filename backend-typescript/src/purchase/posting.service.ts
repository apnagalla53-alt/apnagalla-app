import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

import { PostingService as AccountingPostingService } from '../accounting/posting.service';
import { InventoryPostingService, PostMovementDto, MovementLine } from '../inventory/posting.service';
import { costLedger } from '../inventory/value-journal';
import { receiveSerials } from '../inventory/serial-tracking';

@Injectable()
export class PostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingPostingService: AccountingPostingService,
    private readonly inventoryPostingService: InventoryPostingService,
  ) {}

  // ── GRN POSTING & REVERSAL ────────────────────────────────────────────────

  async postGoodsReceipt(grnId: string, userId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Fetch GRN with lines
      await tx.$queryRaw`SELECT id FROM goods_receipts WHERE id = ${grnId}::uuid FOR UPDATE`;
      const grn = await tx.goodsReceipt.findUnique({
        where: { id: grnId },
        include: { lines: true },
      });

      if (!grn) throw new BadRequestException('GRN not found');
      if (grn.status === 'POSTED') throw new BadRequestException('GRN is already posted');
      if (grn.status === 'CANCELLED') throw new BadRequestException('Cannot post a cancelled GRN');
      if (grn.lines.length === 0) throw new BadRequestException('GRN must have at least one line');

      // Check PO if it exists
      let po = null;
      if (grn.purchase_order_id) {
        await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${grn.purchase_order_id}::uuid FOR UPDATE`;
        po = await tx.purchaseOrder.findUnique({
          where: { id: grn.purchase_order_id },
          include: { lines: true },
        });
        if (!po) throw new BadRequestException('Linked Purchase Order not found');
        if (po.status === 'CANCELLED' || po.status === 'CLOSED') {
          throw new BadRequestException(`Cannot receive against PO with status ${po.status}`);
        }
      }

      // 2. Process each line
      for (const line of grn.lines) {
        if (Number(line.received_quantity) <= 0) {
          throw new BadRequestException(`Invalid quantity on line ${line.id}. Must be > 0.`);
        }

        // Validate PO limits if linked
        if (line.purchase_order_line_id && po) {
          const poLine = po.lines.find((l: any) => l.id === line.purchase_order_line_id);
          if (!poLine) throw new BadRequestException('Linked PO Line not found');
          
          const newTotalReceived = Number(poLine.received_quantity) + Number(line.received_quantity);
          if (newTotalReceived > Number(poLine.ordered_quantity)) {
            throw new BadRequestException(`Over-receipt prevented. Cannot receive more than ordered for item ${line.item_id}`);
          }

          // Update PO Line
          await tx.purchaseOrderLine.update({
            where: { id: line.purchase_order_line_id },
            data: { received_quantity: { increment: line.received_quantity } },
          });
        }
      }

      const invLines: MovementLine[] = [];
      for (const l of grn.lines) {
        const item = await tx.item.findFirst({ where: { id: l.item_id, company_id: grn.company_id } });
        if (!item) throw new BadRequestException('Item not found');
        const serials = item.track_serial ? await receiveSerials(tx, { company_id: grn.company_id, item_id: item.id,
          godown_id: l.godown_id, variant_id: l.variant_id, batch_id: l.batch_id, quantity: Number(l.base_quantity || l.received_quantity),
          numbers: l.serial_ids, date: grn.document_date, document_id: grn.id }) : [];
        if (serials.length) await tx.goodsReceiptLine.update({ where: { id: l.id }, data: { serial_ids: serials.map(s => s.id) } });
        for (const serial of serials.length ? serials : [null]) invLines.push({
          item_id: l.item_id,
          godown_id: l.godown_id,
          quantity: serial ? 1 : l.base_quantity?.toString() || l.received_quantity.toString(),
          serial_id: serial?.id,
          unit_id: l.unit_id,
          variant_id: l.variant_id ?? null,
          batch_id: l.batch_id ?? null,
          source_line_id: serial?.id || l.id, cost_line_id:l.id, cost_rate:l.acquisition_cost_rate?.toString() ?? null
        });
      }

        await this.inventoryPostingService.postMovement(tx, {
          company_id: grn.company_id,
          branch_id: grn.branch_id,
          movement_type: 'PURCHASE_IN',
          business_date: grn.document_date,
          source_document_type: 'GOODS_RECEIPT',
          source_document_id: grn.id,
          lines: invLines,
        });

      // Accrue only verified receipt value; an unpriced GRN remains unknown.
      const receiptMovements=await tx.stockMovement.findMany({where:{company_id:grn.company_id,source_document_type:'GOODS_RECEIPT',source_document_id:grn.id}});
      const receiptValue=receiptMovements.reduce((sum,m)=>sum.plus(m.value_delta),new Prisma.Decimal(0));
      if(receiptValue.gt(0)){
        const receiptYear=await tx.financialYear.findFirst({where:{company_id:grn.company_id,is_closed:false,start_date:{lte:grn.document_date},end_date:{gte:grn.document_date}}});
        if(!receiptYear)throw new BadRequestException('An open financial year covering receipt date is required');
        const asset=await costLedger(tx,grn.company_id,'1200','Inventory Asset','ASSET');
        const clearing=await costLedger(tx,grn.company_id,'GRN_CLEARING','Goods received, invoice pending','LIABILITY');
        await this.accountingPostingService.postVoucher(tx,{company_id:grn.company_id,branch_id:grn.branch_id,financial_year_id:receiptYear.id,
          voucher_date:grn.document_date,voucher_type:'JOURNAL',document_number:'COST-'+grn.document_number,source_document_type:'GOODS_RECEIPT_COST',source_document_id:grn.id,posted_by:userId,
          lines:[{ledger_account_id:asset.id,debit:receiptValue,credit:0},{ledger_account_id:clearing.id,debit:0,credit:receiptValue}]});
      }
      // Recalculate PO Status
      if (po) {
        // re-fetch lines since we just updated them
        const updatedPoLines = await tx.purchaseOrderLine.findMany({ where: { purchase_order_id: po.id } });
        let fullyReceived = true;
        for (const poline of updatedPoLines) {
          if (Number(poline.received_quantity) < Number(poline.ordered_quantity)) {
            fullyReceived = false;
          }
        }
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: fullyReceived ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED' },
        });
      }

      await tx.auditLog.create({
        data: {
          company_id: grn.company_id,
          branch_id: grn.branch_id,
          user_id: userId,
          action: 'POSTED',
          source_document_type: 'GOODS_RECEIPT',
          source_document_id: grn.id,
          details: 'GRN posted',
        }
      });

      // 3. Mark GRN POSTED
      return tx.goodsReceipt.update({
        where: { id: grn.id },
        data: { status: 'POSTED', posted_at: new Date(), posted_by: userId },
      });
    });
  }

  async reverseGoodsReceipt(grnId: string, userId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM goods_receipts WHERE id = ${grnId}::uuid FOR UPDATE`;
      const grn = await tx.goodsReceipt.findUnique({
        where: { id: grnId },
        include: { lines: true },
      });

      if (!grn) throw new BadRequestException('GRN not found');
      if (grn.status !== 'POSTED') throw new BadRequestException('Only POSTED GRNs can be reversed');

      // Reverse lines
      for (const line of grn.lines) {
        // Reverse PO Line receiving
        if (line.purchase_order_line_id) {
          await tx.purchaseOrderLine.update({
            where: { id: line.purchase_order_line_id },
            data: { received_quantity: { decrement: line.received_quantity } },
          });
        }
      }

      // Reverse Inventory
      await this.inventoryPostingService.reverseMovement(
        tx,
        grn.company_id,
        'GOODS_RECEIPT',
        grn.id,
        'GOODS_RECEIPT_REVERSAL'
      );

      const costVoucher=await tx.voucher.findFirst({where:{company_id:grn.company_id,source_document_type:'GOODS_RECEIPT_COST',source_document_id:grn.id,status:'POSTED'}});
      if(costVoucher)await this.accountingPostingService.reverseVoucher(tx,costVoucher.id,userId,'Receipt reversed');
      // Recalculate PO Status
      if (grn.purchase_order_id) {
        const poLines = await tx.purchaseOrderLine.findMany({ where: { purchase_order_id: grn.purchase_order_id } });
        let totalReceived = 0;
        poLines.forEach((l: any) => totalReceived += Number(l.received_quantity));
        const status = totalReceived === 0 ? 'CONFIRMED' : 'PARTIALLY_RECEIVED';
        
        await tx.purchaseOrder.update({
          where: { id: grn.purchase_order_id },
          data: { status },
        });
      }

      await tx.auditLog.create({
        data: {
          company_id: grn.company_id,
          branch_id: grn.branch_id,
          user_id: userId,
          action: 'REVERSED',
          source_document_type: 'GOODS_RECEIPT',
          source_document_id: grn.id,
          details: 'GRN reversed',
        }
      });

      // Mark GRN CANCELLED
      return tx.goodsReceipt.update({
        where: { id: grn.id },
        data: { status: 'CANCELLED' }, // Reversal is represented by status CANCELLED but we keep the audit trail intact.
      });
    });
  }

  // ── INVOICE POSTING & REVERSAL ────────────────────────────────────────────

  async postPurchaseInvoice(invoiceId: string, userId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM purchase_invoices WHERE id = ${invoiceId}::uuid FOR UPDATE`;
      const invoice = await tx.purchaseInvoice.findUnique({
        where: { id: invoiceId },
        include: { lines: true },
      });

      if (!invoice) throw new BadRequestException('Invoice not found');
      if (invoice.status === 'POSTED') throw new BadRequestException('Invoice is already posted');
      if (invoice.status === 'CANCELLED') throw new BadRequestException('Cannot post cancelled invoice');

      // Validation
      if (Number(invoice.grand_total) < 0) throw new BadRequestException('Invoice total cannot be negative');

      // 1. Create Accounting Voucher via Centralized Accounting Core
      const getOrCreateLedger = async (code: string, name: string) => {
        let acc = await tx.ledgerAccount.findFirst({ where: { company_id: invoice.company_id, code } });
        if (!acc) acc = await tx.ledgerAccount.create({ data: { company_id: invoice.company_id, code, name, account_type: 'UNKNOWN', normal_balance: 'DEBIT' } });
        return acc;
      };

      const payableAccount = await tx.ledgerAccount.findFirst({where:{company_id:invoice.company_id,party_id:invoice.party_id}})||await getOrCreateLedger('2000', 'Accounts Payable');
      // Separate GRN accrual from operating purchases. Do not invent receipt costs from an invoice.
      const purchaseAccount = invoice.lines.some(l=>l.goods_receipt_line_id)
        ? await costLedger(tx,invoice.company_id,'GRN_CLEARING','Goods received, invoice pending','LIABILITY')
        : await getOrCreateLedger('5000','Purchases');
      const taxAccount = await getOrCreateLedger('2200', 'Input Tax');

      const lines = [];

      // Credit Accounts Payable
      lines.push({
        ledger_account_id: payableAccount.id,
        party_id: invoice.party_id,
        credit: Number(invoice.grand_total),
        debit: 0,
      });

      // Debit Purchases
      if (Number(invoice.taxable_amount) > 0) {
        let accrued = new Prisma.Decimal(invoice.taxable_amount);
        let variance = new Prisma.Decimal(0);
        if (invoice.lines.length && invoice.lines.every(l=>l.goods_receipt_line_id)) {
          const receipts = await tx.goodsReceiptLine.findMany({where:{id:{in:invoice.lines.map(l=>l.goods_receipt_line_id!)},goods_receipt:{company_id:invoice.company_id,status:'POSTED'}}});
          if (receipts.length !== new Set(invoice.lines.map(l=>l.goods_receipt_line_id)).size) throw new BadRequestException('Posted receipt not found in this business');
          // Settle priced receipt accrual at its immutable acquisition cost. Invoice differences are explicit expense/credit variances.
          if (receipts.every(r=>r.acquisition_cost_rate!=null)) {
            accrued=invoice.lines.reduce((sum,l)=>sum.plus(receipts.find(r=>r.id===l.goods_receipt_line_id)!.acquisition_cost_rate!.mul(l.base_quantity||l.quantity)),new Prisma.Decimal(0));
            variance=new Prisma.Decimal(invoice.taxable_amount).minus(accrued);
          }
        }
        lines.push({
          ledger_account_id: purchaseAccount.id,
          debit: accrued.toNumber(),
          credit: 0,
        });
        if (!variance.eq(0)) {
          const varianceLedger=await costLedger(tx,invoice.company_id,'PURCHASE_COST_VARIANCE','Purchase invoice price variance','EXPENSE');
          lines.push({ledger_account_id:varianceLedger.id,debit:variance.gt(0)?variance.toNumber():0,credit:variance.lt(0)?variance.abs().toNumber():0});
        }
      }

      // Debit Tax
      if (Number(invoice.tax_amount) > 0) {
        lines.push({
          ledger_account_id: taxAccount.id,
          debit: Number(invoice.tax_amount),
          credit: 0,
        });
      }

      await this.accountingPostingService.postVoucher(tx, {
        company_id: invoice.company_id,
        branch_id: invoice.branch_id,
        financial_year_id: invoice.financial_year_id,
        voucher_type: 'PURCHASE',
        document_number: `JV-${invoice.document_number}`,
        voucher_date: invoice.document_date,
        source_document_type: 'PURCHASE_INVOICE',
        source_document_id: invoice.id,
        narration: `Purchase Invoice ${invoice.document_number}`,
        posted_by: userId,
        lines,
      });

      await tx.auditLog.create({
        data: {
          company_id: invoice.company_id,
          branch_id: invoice.branch_id,
          user_id: userId,
          action: 'POSTED',
          source_document_type: 'PURCHASE_INVOICE',
          source_document_id: invoice.id,
          details: 'Purchase Invoice posted',
        }
      });

      // 3. Mark Invoice POSTED
      return tx.purchaseInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'POSTED',
          posted_at: new Date(),
          posted_by: userId,
          outstanding_amount: invoice.grand_total, // Initializing payable balance
        },
      });
    });
  }

  async reversePurchaseInvoice(invoiceId: string, userId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM purchase_invoices WHERE id = ${invoiceId}::uuid FOR UPDATE`;
      const invoice = await tx.purchaseInvoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) throw new BadRequestException('Invoice not found');
      if (invoice.status !== 'POSTED') throw new BadRequestException('Only POSTED invoices can be reversed');
      if (Number(invoice.paid_amount) > 0) throw new BadRequestException('Cannot reverse invoice with payments applied. Reverse payments first.');

      // Find the associated voucher
      const voucher = await tx.voucher.findFirst({
        where: { source_document_type: 'PURCHASE_INVOICE', source_document_id: invoice.id, status: 'POSTED' },
      });

      if (voucher) {
        await this.accountingPostingService.reverseVoucher(tx, voucher.id, userId, 'Invoice Cancelled');
      }

      await tx.auditLog.create({
        data: {
          company_id: invoice.company_id,
          branch_id: invoice.branch_id,
          user_id: userId,
          action: 'REVERSED',
          source_document_type: 'PURCHASE_INVOICE',
          source_document_id: invoice.id,
          details: 'Purchase Invoice reversed',
        }
      });

      // Mark Invoice CANCELLED
      return tx.purchaseInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'CANCELLED',
          outstanding_amount: 0,
        },
      });
    });
  }

  // ── PURCHASE RETURN POSTING & REVERSAL ────────────────────────────────────

  async postPurchaseReturn(returnId: string, userId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM purchase_returns WHERE id = ${returnId}::uuid FOR UPDATE`;
      const pReturn = await tx.purchaseReturn.findUnique({
        where: { id: returnId },
        include: { lines: true },
      });

      if (!pReturn) throw new BadRequestException('Purchase Return not found');
      if (pReturn.status === 'POSTED') throw new BadRequestException('Purchase Return is already posted');
      if (pReturn.status === 'CANCELLED') throw new BadRequestException('Cannot post cancelled purchase return');

      if (Number(pReturn.grand_total) < 0) throw new BadRequestException('Total cannot be negative');

      // 1. Post Inventory Movement (OUT)
      const original=pReturn.original_invoice_id?await tx.purchaseInvoice.findFirst({where:{id:pReturn.original_invoice_id,company_id:pReturn.company_id,status:'POSTED'},include:{lines:{include:{goods_receipt_line:true}}}}):null;
      if(pReturn.original_invoice_id&&!original)throw new BadRequestException('Original purchase not found in this business');
      const invLines: MovementLine[] = pReturn.lines.map((l: any) => {
        const matches=original?.lines.filter(o=>o.item_id===l.item_id&&(o.variant_id||null)===(l.variant_id||null))||[];
        if(matches.length>1)throw new BadRequestException('Return requires an unambiguous original purchase line');
        const origin=matches[0];
        return ({
        item_id: l.item_id,
        godown_id: l.godown_id,
        quantity: l.base_quantity||l.quantity,
        unit_id: l.base_quantity ? origin?.unit_id||l.unit_id : l.unit_id,
        variant_id:l.variant_id, batch_id:l.batch_id, cost_line_id:l.id,
        cost_origin_document_id:origin?.goods_receipt_line?.goods_receipt_id||original?.id,
        cost_origin_line_id:origin?.goods_receipt_line_id||origin?.id,
        source_line_id: l.id
      });});

      await this.inventoryPostingService.postMovement(tx, {
        company_id: pReturn.company_id,
        branch_id: pReturn.branch_id,
        movement_type: 'PURCHASE_RETURN_OUT',
        business_date: pReturn.document_date,
        source_document_type: 'PURCHASE_RETURN',
        source_document_id: pReturn.id,
        lines: invLines,
      });

      // 2. Accounting logic (Reverse of Purchase Invoice)
      const getOrCreateLedger = async (code: string, name: string) => {
        let acc = await tx.ledgerAccount.findFirst({ where: { company_id: pReturn.company_id, code } });
        if (!acc) acc = await tx.ledgerAccount.create({ data: { company_id: pReturn.company_id, code, name, account_type: 'UNKNOWN', normal_balance: 'DEBIT' } });
        return acc;
      };

      const payableAccount = await tx.ledgerAccount.findFirst({where:{company_id:pReturn.company_id,party_id:pReturn.party_id}})||await getOrCreateLedger('2000', 'Accounts Payable');
      const costMovements=await tx.stockMovement.findMany({where:{company_id:pReturn.company_id,source_document_id:pReturn.id,source_document_type:'PURCHASE_RETURN'}});
      const removedValue=costMovements.reduce((sum,m)=>sum.plus(m.value_delta.abs()),new Prisma.Decimal(0));
      const purchaseReturnAccount=await costLedger(tx,pReturn.company_id,'1200','Inventory Asset','ASSET');
      const varianceAccount=await costLedger(tx,pReturn.company_id,costMovements.every(m=>m.cost_status==='KNOWN')?'PURCHASE_COST_VARIANCE':'GRN_CLEARING','Purchase cost reconciliation','EXPENSE');
      const taxAccount = await getOrCreateLedger('2200', 'Input Tax');

      const lines = [];

      // Debit Accounts Payable
      lines.push({
        ledger_account_id: payableAccount.id,
        party_id: pReturn.party_id,
        debit: Number(pReturn.grand_total),
        credit: 0,
      });

      // Remove the original acquisition value, with an explicit reconciliation for supplier credit differences.
      if (removedValue.gt(0)) {
        lines.push({
          ledger_account_id: purchaseReturnAccount.id,
          credit: removedValue,
          debit: 0,
        });
      }

      const variance=new Prisma.Decimal(pReturn.grand_total).minus(pReturn.tax_amount).minus(removedValue);
      if(!variance.eq(0))lines.push({ledger_account_id:varianceAccount.id,debit:variance.lt(0)?variance.abs():0,credit:variance.gt(0)?variance:0});
      // Credit Tax
      if (Number(pReturn.tax_amount) > 0) {
        lines.push({
          ledger_account_id: taxAccount.id,
          credit: Number(pReturn.tax_amount),
          debit: 0,
        });
      }

      const returnVoucher=await this.accountingPostingService.postVoucher(tx, {
        company_id: pReturn.company_id,
        branch_id: pReturn.branch_id,
        financial_year_id: pReturn.financial_year_id,
        voucher_type: 'PURCHASE',
        document_number: `PRV-${pReturn.document_number}`,
        voucher_date: pReturn.document_date,
        source_document_type: 'PURCHASE_RETURN',
        source_document_id: pReturn.id,
        narration: `Purchase Return ${pReturn.document_number}`,
        posted_by: userId,
        lines,
      });

      if(pReturn.original_invoice_id){const partyLine=returnVoucher.lines.find(l=>l.party_id===pReturn.party_id);
        if(partyLine)await tx.billAllocation.create({data:{company_id:pReturn.company_id,party_id:pReturn.party_id,voucher_line_id:partyLine.id,
          reference_document_type:'PURCHASE_INVOICE',reference_document_id:pReturn.original_invoice_id,allocation_type:'AGAINST_REFERENCE',amount:pReturn.grand_total}});}

      // 3. Adjust supplier payable on original invoice if applicable
      if (pReturn.original_invoice_id) {
        await tx.purchaseInvoice.update({
          where: { id: pReturn.original_invoice_id },
          data: {
            outstanding_amount: { decrement: pReturn.grand_total }
          }
        });
      }

      await tx.auditLog.create({
        data: {
          company_id: pReturn.company_id,
          branch_id: pReturn.branch_id,
          user_id: userId,
          action: 'POSTED',
          source_document_type: 'PURCHASE_RETURN',
          source_document_id: pReturn.id,
          details: 'Purchase Return posted',
        }
      });

      return tx.purchaseReturn.update({
        where: { id: pReturn.id },
        data: {
          status: 'POSTED',
          posted_at: new Date(),
          posted_by: userId,
        },
      });
    });
  }

  async reversePurchaseReturn(returnId: string, userId: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM purchase_returns WHERE id = ${returnId}::uuid FOR UPDATE`;
      const pReturn = await tx.purchaseReturn.findUnique({
        where: { id: returnId },
      });

      if (!pReturn) throw new BadRequestException('Purchase Return not found');
      if (pReturn.status !== 'POSTED') throw new BadRequestException('Only POSTED returns can be reversed');

      // Reverse Inventory
      await this.inventoryPostingService.reverseMovement(
        tx,
        pReturn.company_id,
        'PURCHASE_RETURN',
        pReturn.id,
        'PURCHASE_RETURN_REVERSAL'
      );

      // Find the associated voucher
      const voucher = await tx.voucher.findFirst({
        where: { source_document_type: 'PURCHASE_RETURN', source_document_id: pReturn.id, status: 'POSTED' },
      });

      if (voucher) {
        const reversal = await this.accountingPostingService.reverseVoucher(tx, voucher.id, userId, 'Return Cancelled');
        if (pReturn.original_invoice_id) {
          const partyLine = await tx.voucherLine.findFirst({where:{voucher_id:reversal.id,party_id:pReturn.party_id}});
          if (partyLine) await tx.billAllocation.create({data:{company_id:pReturn.company_id,party_id:pReturn.party_id,
            voucher_line_id:partyLine.id,reference_document_type:'PURCHASE_INVOICE',reference_document_id:pReturn.original_invoice_id,
            allocation_type:'NEW_REFERENCE',amount:pReturn.grand_total}});
        }
      }

      // Re-adjust supplier payable on original invoice
      if (pReturn.original_invoice_id) {
        await tx.purchaseInvoice.update({
          where: { id: pReturn.original_invoice_id },
          data: {
            outstanding_amount: { increment: pReturn.grand_total }
          }
        });
      }

      await tx.auditLog.create({
        data: {
          company_id: pReturn.company_id,
          branch_id: pReturn.branch_id,
          user_id: userId,
          action: 'REVERSED',
          source_document_type: 'PURCHASE_RETURN',
          source_document_id: pReturn.id,
          details: 'Purchase Return reversed',
        }
      });

      return tx.purchaseReturn.update({
        where: { id: pReturn.id },
        data: {
          status: 'CANCELLED',
        },
      });
    });
  }
}
