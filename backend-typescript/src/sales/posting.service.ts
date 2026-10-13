import { snapshotDocumentCosts } from '../inventory/cost-snapshots';
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { InventoryPostingService } from '../inventory/posting.service';
import { PostingService as AccountingPostingService } from '../accounting/posting.service';
import { Prisma } from '@prisma/client';
import { costLedger } from '../inventory/value-journal';

@Injectable()
export class SalesPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryPostingService,
    private readonly accounting: AccountingPostingService,
  ) {}

  // --- Delivery Challan ---

  async postDeliveryChallan(companyId: string, challanId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM delivery_challans WHERE id = ${challanId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
      const challan = await tx.deliveryChallan.findUnique({
        where: { id: challanId },
        include: { lines: true }
      });

      if (!challan) throw new BadRequestException('Delivery Challan not found');
      if (challan.company_id !== companyId) throw new ForbiddenException('Isolation violation');
      if (challan.status === 'DISPATCHED') throw new BadRequestException('Challan is already posted');
      if (challan.status === 'CANCELLED') throw new BadRequestException('Cannot post cancelled challan');

      // Over-delivery check
      for (const line of challan.lines) {
        if (line.sales_order_line_id) {
          const dispatched = await tx.deliveryChallanLine.aggregate({
            where: {
              sales_order_line_id: line.sales_order_line_id,
              delivery_challan: { status: 'DISPATCHED' }
            },
            _sum: { dispatched_quantity: true }
          });
          const orderLine = await tx.salesOrderLine.findUnique({ where: { id: line.sales_order_line_id } });
          if (orderLine) {
            const alreadyDispatched = dispatched._sum.dispatched_quantity || new Prisma.Decimal(0);
            const total = new Prisma.Decimal(alreadyDispatched).add(new Prisma.Decimal(line.dispatched_quantity));
            if (total.gt(new Prisma.Decimal(orderLine.ordered_quantity))) {
              throw new BadRequestException('Cannot exceed ordered quantity');
            }
            
            // Update line delivered quantity
            await tx.salesOrderLine.update({
              where: { id: line.sales_order_line_id },
              data: { delivered_quantity: total }
            });
          }
        }
      }


      // Post Inventory (SALES_OUT)
      await this.inventory.postMovement(tx, {
        company_id: challan.company_id,
        branch_id: challan.branch_id,
        movement_type: 'SALES_OUT',
        business_date: challan.document_date,
        source_document_type: 'DELIVERY_CHALLAN',
        source_document_id: challan.id,
        lines: challan.lines.map(l => ({
          item_id: l.item_id,
          godown_id: l.godown_id,
          quantity: new Prisma.Decimal(l.dispatched_quantity).add(new Prisma.Decimal(l.free_quantity || 0)).toString(),
          unit_id: l.unit_id,
          source_line_id: l.id,
          cost_rate: 0
        }))
      });

      const valueMovements=await tx.stockMovement.findMany({where:{company_id:companyId,source_document_type:'DELIVERY_CHALLAN',source_document_id:challan.id}});
      const dispatchValue=valueMovements.reduce((s,m)=>s.plus(m.value_delta.abs()),new Prisma.Decimal(0));
      if(dispatchValue.gt(0)){
        const year=await tx.financialYear.findFirst({where:{company_id:companyId,is_closed:false,start_date:{lte:challan.document_date},end_date:{gte:challan.document_date}}});
        if(!year)throw new BadRequestException('Open financial year is required for dispatch');
        const asset=await costLedger(tx,companyId,'1200','Inventory Asset','ASSET'),deferred=await costLedger(tx,companyId,'UNBILLED_COGS','Dispatched inventory awaiting invoice','ASSET');
        await this.accounting.postVoucher(tx,{company_id:companyId,branch_id:challan.branch_id,financial_year_id:year.id,voucher_type:'JOURNAL',document_number:'COST-'+challan.document_number,
          voucher_date:challan.document_date,source_document_type:'DELIVERY_CHALLAN_COST',source_document_id:challan.id,posted_by:userId,
          lines:[{ledger_account_id:asset.id,debit:0,credit:dispatchValue},{ledger_account_id:deferred.id,debit:dispatchValue,credit:0}]});
      }
      const postedChallan = await tx.deliveryChallan.update({
        where: { id: challan.id },
        data: {
          status: 'DISPATCHED',
          posted_at: new Date(),
          posted_by: userId
        },
        include: { lines: true }
      });

      if (challan.sales_order_id) {
        // Check if all lines are fully delivered
        const orderLines = await tx.salesOrderLine.findMany({ where: { sales_order_id: challan.sales_order_id } });
        let allFullyDelivered = true;
        for (const ol of orderLines) {
          if (new Prisma.Decimal(ol.delivered_quantity).lt(new Prisma.Decimal(ol.ordered_quantity))) {
            allFullyDelivered = false;
            break;
          }
        }
        await tx.salesOrder.update({
          where: { id: challan.sales_order_id },
          data: { status: allFullyDelivered ? 'FULLY_DELIVERED' : 'PARTIALLY_DELIVERED' }
        });
      }

      await tx.auditLog.create({
        data: {
          company_id: challan.company_id,
          branch_id: challan.branch_id,
          user_id: userId,
          action: 'DELIVERY_CHALLAN_POSTED',
          source_document_type: 'DELIVERY_CHALLAN',
          source_document_id: challan.id,
        }
      });

      return postedChallan;
    });
  }

  // --- Sales Invoice ---

  async postSalesInvoice(companyId: string, invoiceId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id = ${invoiceId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
      const invoice = await tx.salesInvoice.findUnique({
        where: { id: invoiceId },
        include: { lines: true }
      });

      if (!invoice) throw new BadRequestException('Invoice not found');
      if (invoice.company_id !== companyId) throw new ForbiddenException('Cannot access invoice from another company');
      if (invoice.status === 'POSTED') throw new BadRequestException('Invoice is already posted');
      if (invoice.status === 'CANCELLED') throw new BadRequestException('Cannot post cancelled invoice');

      // Post Inventory ONLY for lines not linked to a Challan
      const retailLines = invoice.lines.filter(l => !l.delivery_challan_line_id);
      if (retailLines.length > 0) {
        await this.inventory.postMovement(tx, {
          company_id: invoice.company_id,
          branch_id: invoice.branch_id,
          movement_type: 'SALES_OUT',
          business_date: invoice.document_date,
          source_document_type: 'SALES_INVOICE',
          source_document_id: invoice.id,
          lines: retailLines.map(l => ({
            item_id: l.item_id,
            godown_id: l.godown_id,
            quantity: (l.base_quantity||l.quantity).toString(),
            unit_id: l.unit_id, variant_id:l.variant_id,batch_id:l.batch_id,
            source_line_id: l.id,
            cost_rate: 0
          }))
        });
      }

      await snapshotDocumentCosts(tx, this.accounting, invoice, 'SALE', userId);
      // 3. Post Accounting
      const partyAccount = await tx.ledgerAccount.findFirst({
        where: { party_id: invoice.party_id, company_id: invoice.company_id }
      });
      if (!partyAccount) throw new BadRequestException(`Accounting integration failed: Customer does not have a linked LedgerAccount`);

      let salesAccount = await tx.ledgerAccount.findFirst({
        where: { code: 'SALES_REVENUE', company_id: invoice.company_id }
      });
      if (!salesAccount) {
        salesAccount = await tx.ledgerAccount.create({
          data: {
            company_id: invoice.company_id,
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

      const totalDebit = new Prisma.Decimal(invoice.grand_total);
      const lines: any[] = [];
      
      // Debit Customer (Receivable)
      lines.push({
        ledger_account_id: partyAccount.id,
        party_id: invoice.party_id,
        debit: totalDebit.toString(),
        credit: 0
      });
      
      // Credit Sales
      lines.push({
        ledger_account_id: salesAccount.id,
        debit: 0,
        credit: invoice.taxable_amount.toString()
      });

      // Credit Tax
      if (Number(invoice.tax_amount) > 0) {
        let taxAccount = await tx.ledgerAccount.findFirst({
          where: { code: 'OUTPUT_GST', company_id: invoice.company_id }
        });
        if (!taxAccount) {
          taxAccount = await tx.ledgerAccount.create({
            data: {
              company_id: invoice.company_id,
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
        lines.push({
          ledger_account_id: taxAccount.id,
          debit: 0,
          credit: invoice.tax_amount.toString()
        });
      }

      const voucher = await this.accounting.postVoucher(tx, {
        company_id: invoice.company_id,
        branch_id: invoice.branch_id,
        financial_year_id: invoice.financial_year_id,
        voucher_type: 'SALES',
        document_number: invoice.document_number,
        voucher_date: invoice.document_date,
        source_document_type: 'SALES_INVOICE',
        source_document_id: invoice.id,
        narration: `Sales Invoice ${invoice.document_number}`,
        posted_by: userId,
        lines
      });

      const postedInvoice = await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'POSTED',
          posted_at: new Date(),
          posted_by: userId
        },
        include: { lines: true }
      });

      const customerVoucherLine = voucher.lines.find(l => l.ledger_account_id === partyAccount.id);
      if (customerVoucherLine) {
        await tx.billAllocation.create({
          data: {
            company_id: invoice.company_id,
            party_id: invoice.party_id,
            voucher_line_id: customerVoucherLine.id,
            reference_document_type: 'SALES_INVOICE',
            reference_document_id: invoice.id,
            allocation_type: 'NEW_REFERENCE',
            amount: invoice.grand_total,
            due_date: invoice.due_date
          }
        });
      }

      await tx.auditLog.create({
        data: {
          company_id: invoice.company_id,
          branch_id: invoice.branch_id,
          user_id: userId,
          action: 'SALES_INVOICE_POSTED',
          source_document_type: 'SALES_INVOICE',
          source_document_id: invoice.id,
          affected_voucher_id: voucher.id,
        }
      });

      return postedInvoice;
    });
  }

  // --- Sales Return ---

  async postSalesReturn(companyId: string, returnId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM sales_returns WHERE id = ${returnId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
      const sr = await tx.salesReturn.findUnique({
        where: { id: returnId },
        include: { lines: true }
      });

      if (!sr) throw new BadRequestException('Sales Return not found');
      if (sr.company_id !== companyId) throw new ForbiddenException('Isolation violation');
      if (sr.status === 'POSTED') throw new BadRequestException('Already posted');
      if (sr.status === 'CANCELLED') throw new BadRequestException('Cannot post cancelled');

      // Post Inventory (SALES_RETURN_IN)
      await this.inventory.postMovement(tx, {
        company_id: sr.company_id,
        branch_id: sr.branch_id,
        movement_type: 'SALES_RETURN_IN',
        business_date: sr.document_date,
        source_document_type: 'SALES_RETURN',
        source_document_id: sr.id,
        lines: sr.lines.map(l => ({
          item_id: l.item_id,
          godown_id: l.godown_id,
          quantity: (l.base_quantity||l.quantity).toString(),
          unit_id: l.unit_id, variant_id:l.variant_id,batch_id:l.batch_id,
          source_line_id: l.id, cost_line_id:l.id,
          cost_origin_document_id:sr.original_invoice_id||undefined,
          cost_origin_line_id:l.original_line_id||undefined,
          cost_rate: null
        }))
      });

      await snapshotDocumentCosts(tx,this.accounting,sr,'RETURN',userId);
      // Post Accounting (Reverse of Invoice)
      const partyAccount = await tx.ledgerAccount.findFirst({
        where: { party_id: sr.party_id, company_id: sr.company_id }
      });
      if (!partyAccount) throw new BadRequestException('Customer has no ledger account');

      let salesAccount = await tx.ledgerAccount.findFirst({
        where: { code: 'SALES_REVENUE', company_id: sr.company_id }
      });
      if (!salesAccount) throw new BadRequestException('Sales Revenue account missing');

      const lines: any[] = [];
      
      // Credit Customer (Reduce Receivable)
      lines.push({
        ledger_account_id: partyAccount.id,
        party_id: sr.party_id,
        debit: 0,
        credit: sr.grand_total.toString()
      });
      
      // Debit Sales
      lines.push({
        ledger_account_id: salesAccount.id,
        debit: sr.taxable_amount.toString(),
        credit: 0
      });

      if (Number(sr.tax_amount) > 0) {
        let taxAccount = await tx.ledgerAccount.findFirst({
          where: { code: 'OUTPUT_GST', company_id: sr.company_id }
        });
        if (!taxAccount) throw new BadRequestException('Output GST account missing');
        
        lines.push({
          ledger_account_id: taxAccount.id,
          debit: sr.tax_amount.toString(),
          credit: 0
        });
      }

      const voucher = await this.accounting.postVoucher(tx, {
        company_id: sr.company_id,
        branch_id: sr.branch_id,
        financial_year_id: sr.financial_year_id,
        voucher_type: 'SALES_RETURN',
        document_number: sr.document_number,
        voucher_date: sr.document_date,
        source_document_type: 'SALES_RETURN',
        source_document_id: sr.id,
        narration: `Sales Return ${sr.document_number}`,
        posted_by: userId,
        lines
      });

      const postedSr = await tx.salesReturn.update({
        where: { id: sr.id },
        data: {
          status: 'POSTED',
          posted_at: new Date(),
          posted_by: userId
        },
        include: { lines: true }
      });

      const customerVoucherLine = voucher.lines.find(l => l.ledger_account_id === partyAccount.id);
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

      await tx.auditLog.create({
        data: {
          company_id: sr.company_id,
          branch_id: sr.branch_id,
          user_id: userId,
          action: 'SALES_RETURN_POSTED',
          source_document_type: 'SALES_RETURN',
          source_document_id: sr.id,
          affected_voucher_id: voucher.id,
        }
      });

      return postedSr;
    });
  }

  // --- Invoice Reversal ---

  async reverseSalesInvoice(companyId: string, invoiceId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id = ${invoiceId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
      const invoice = await tx.salesInvoice.findUnique({
        where: { id: invoiceId },
        include: { lines: true }
      });

      if (!invoice) throw new BadRequestException('Invoice not found');
      if (invoice.company_id !== companyId) throw new ForbiddenException('Isolation violation');
      if (invoice.status !== 'POSTED') throw new BadRequestException('Only posted invoices can be reversed');

      // 1. Reverse Inventory (if there was any direct stock movement for this invoice)
      const retailLines = invoice.lines.filter(l => !l.delivery_challan_line_id);
      if (retailLines.length > 0) {
        await this.inventory.reverseMovement(
          tx,
          invoice.company_id,
          'SALES_INVOICE',
          invoice.id,
          'SALES_INVOICE_REVERSAL'
        );
      }

      const costVoucher=await tx.voucher.findFirst({where:{company_id:invoice.company_id,source_document_type:'INVENTORY_COST_SALES_INVOICE',source_document_id:invoice.id,status:'POSTED'}});
      if(costVoucher)await this.accounting.reverseVoucher(tx,costVoucher.id,userId,'Invoice cost reversal');
      // 2. Reverse Accounting
      const voucher = await tx.voucher.findFirst({
        where: { source_document_id: invoice.id, voucher_type: 'SALES' }
      });
      let reversedVoucherWithLines;
      if (voucher) {
        const rv = await this.accounting.reverseVoucher(tx, voucher.id, userId, 'Sales Invoice Reversal');
        reversedVoucherWithLines = await tx.voucher.findUnique({
          where: { id: rv.id },
          include: { lines: true }
        });
      }

      // 3. Reverse Bill Allocation
      const partyAccount = await tx.ledgerAccount.findFirst({
        where: { party_id: invoice.party_id, company_id: invoice.company_id }
      });
      if (partyAccount && reversedVoucherWithLines) {
        const customerReversalLine = reversedVoucherWithLines.lines.find(l => l.ledger_account_id === partyAccount.id);
        if (customerReversalLine) {
           await tx.billAllocation.create({
             data: {
               company_id: invoice.company_id,
               party_id: invoice.party_id,
               voucher_line_id: customerReversalLine.id,
               reference_document_type: 'SALES_INVOICE',
               reference_document_id: invoice.id,
               allocation_type: 'AGAINST_REFERENCE',
               amount: invoice.grand_total,

               due_date: invoice.due_date
             }
           });
        }
      }

      // 4. Update Invoice Status
      const reversedInvoice = await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'REVERSED'
        },
        include: { lines: true }
      });

      await tx.auditLog.create({
        data: {
          company_id: invoice.company_id,
          branch_id: invoice.branch_id,
          user_id: userId,
          action: 'SALES_INVOICE_REVERSED',
          source_document_type: 'SALES_INVOICE',
          source_document_id: invoice.id,
          affected_voucher_id: reversedVoucherWithLines?.id,
        }
      });

      return reversedInvoice;
    });
  }
}
