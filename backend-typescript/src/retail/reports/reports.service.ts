import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReportFilterDto } from './dto/report-filter.dto';
import { Prisma } from '@prisma/client';
import {businessDate} from '../../common/business-date';
import { OperationalReportsService } from './operational-reports.service';
import { CounterService } from '../counter/counter.service';
import { readReturnHistory } from '../billing/return-history';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService,private readonly operational:OperationalReportsService,private readonly counter:CounterService) {}

  private buildDateFilter(filters: ReportFilterDto) {
    const where: any = {};
    if (filters.from || filters.to) {
      where.document_date = {};
      if (filters.from) where.document_date.gte = new Date(filters.from);
      if (filters.to) where.document_date.lte = new Date(/^\d{4}-\d{2}-\d{2}$/.test(filters.to) ? filters.to + 'T23:59:59.999Z' : filters.to);
    }
    return where;
  }
  
  private buildCreatedAtFilter(filters: ReportFilterDto) {
    const where: any = {};
    if (filters.from || filters.to) {
      where.created_at = {};
      if (filters.from) where.created_at.gte = new Date(filters.from);
      if (filters.to) {
          const toDate = new Date(filters.to);
          toDate.setHours(23, 59, 59, 999);
          where.created_at.lte = toDate;
      }
    }
    return where;
  }

  async getDashboard(companyId: string, filters: ReportFilterDto) {
    const startOfDay = new Date(businessDate()+'T00:00:00Z');
    const endOfDay = new Date(businessDate()+'T23:59:59.999Z');

    const fromDate = filters.from ? new Date(filters.from) : startOfDay;
    const toDate = filters.to ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(filters.to) ? filters.to + 'T23:59:59.999Z' : filters.to) : endOfDay;

    const branchFilter = filters.branch_id ? { branch_id: filters.branch_id } : {};

    // 1. Sales & Returns
    const salesInvoices = await this.prisma.salesInvoice.findMany({
      where: {
        company_id: companyId,
        ...branchFilter,
        document_date: { gte: fromDate, lte: toDate },
        status: 'POSTED',
      },
      select: { id:true, grand_total: true, outstanding_amount: true, payment_snapshot: true }
    });

    const salesReturns = await this.prisma.salesReturn.findMany({
       where: {
        company_id: companyId,
        ...branchFilter,
        document_date: { gte: fromDate, lte: toDate },
        status: 'POSTED',
      },
      select: { grand_total: true }
    });

    const canonical=await this.operational.sales(companyId,{...filters,from:fromDate.toISOString(),to:toDate.toISOString()});
    const grossSales = canonical.gross_sales;
    const returns = canonical.returns;
    const netSales = grossSales - returns;

    // 2. Breakdown Cash, UPI, Udhar
    // Need to get POS receipts created within this period for these sales.
    // Actually, cash/upi received today against today's bills vs Udhar.
    // For today's sales, Udhar = Net Sales - (Payments received for today's sales).
    // Or we can query the receipt vouchers.
    
    // Let's query Vouchers where source = 'POS_RECEIPT'
    const receipts = await this.prisma.voucher.findMany({
        where: {
            company_id: companyId,
            ...branchFilter,
            voucher_date: { gte: fromDate, lte: toDate },
            voucher_type: 'RECEIPT',
            status: 'POSTED'
        },
        include: {
            lines: {
                include: { ledger_account: true }
            }
        }
    });

    let cashReceived = 0;
    const invoiceUpi=new Map(salesInvoices.map(inv=>[inv.id,(Array.isArray(inv.payment_snapshot)?inv.payment_snapshot:[]).reduce<number>((s,p)=>s+((p as any).method==='UPI'?Number((p as any).amount):0),0)]));
    let upiReceived = [...invoiceUpi.values()].reduce((sum,amount)=>sum+amount,0);
    let otherReceived = 0;

    receipts.forEach(receipt => {
        let remainingUpi=receipt.source_document_type==='POS_RECEIPT'?invoiceUpi.get(receipt.source_document_id!)||0:0;
        // Find debit lines (money coming in)
        receipt.lines.forEach(line => {
            if (Number(line.debit) > 0) {
                // If it's cash account
                if (line.ledger_account.code === 'CASH_IN_HAND') {
                    cashReceived += Number(line.debit);
                } else if (line.ledger_account.code === 'DEFAULT_BANK') {
                    if(receipt.source_document_type==='POS_RECEIPT') {
                        const upiPart=Math.min(remainingUpi,Number(line.debit));remainingUpi-=upiPart;otherReceived+=Number(line.debit)-upiPart;
                    } else if(receipt.payment_method==='UPI') upiReceived += Number(line.debit);
                    else otherReceived += Number(line.debit);
                } else {
                    otherReceived += Number(line.debit);
                }
            }
        });
    });

    // 3. Customer Due & Supplier Due
    // Use the existing due reports: one party's credit cannot reduce another's due.
    const [customerReport, supplierReport] = await Promise.all([
      this.getCustomerDueReport(companyId, filters), this.getSupplierDueReport(companyId, filters),
    ]);
    const customerDue = customerReport.summary.total_due;
    const supplierDue = supplierReport.summary.total_due;

    // 4. Expenses (Business Expenses vs Owner Withdrawal)
    const expenses = await this.prisma.expense.findMany({
        where: {
            company_id: companyId,
            ...branchFilter,
            date: { gte: fromDate, lte: toDate },
            status: 'POSTED'
        }
    });

    let businessExpenses = 0;
    let ownerWithdrawal = 0;

    expenses.forEach(exp => {
        if (exp.type === 'BUSINESS_EXPENSE') {
            businessExpenses += Number(exp.amount);
        } else if (exp.type === 'OWNER_WITHDRAWAL') {
            ownerWithdrawal += Number(exp.amount);
        }
    });

    // Stock alerts share the canonical sellable-stock read model.
    const lowStockCount=(await this.operational.stock(companyId,{branch_id:filters.branch_id},0,0)).summary.low_stock_count;

    const needsPending = await this.prisma.needList.count({
      where: { company_id: companyId, status: 'NEED' }
    });

    // Udhar Sales for the period = Net Sales - total received today against today's sales.
    // For exact Udhar Sales of today, we need to look at the outstanding amount of today's invoices.
    // But since paid_amount is recorded on SalesInvoice:
    const udharSales = salesInvoices.reduce((sum, inv) => sum + Number(inv.outstanding_amount || 0), 0);

    return {
      upi_accounts: await this.counter.upiAccounts(companyId,filters.branch_id,fromDate.toISOString().slice(0,10),toDate.toISOString().slice(0,10)),
      ...await this.counter.saleKinds(companyId,filters.branch_id,filters.from?.slice(0,10)||'1970-01-01',filters.to?.slice(0,10)||'9999-12-30'),
      gross_sales: grossSales,
      returns: returns,
      net_sales: netSales,
      bills_count: salesInvoices.length,
      cash_received: cashReceived,
      upi_received: await this.counter.upiReceived(companyId,filters.branch_id,fromDate.toISOString().slice(0,10),toDate.toISOString().slice(0,10)),
      other_received: otherReceived,
      udhar_sales: udharSales,
      business_expenses: businessExpenses,
      owner_withdrawal: ownerWithdrawal,
      customer_due: customerDue,
      supplier_due: supplierDue,
      low_stock_count: lowStockCount,
      needs_pending: needsPending
    };
  }

  async getSalesReport(companyId: string, filters: ReportFilterDto) {
    const where = this.buildDateFilter(filters);
    const branchFilter = filters.branch_id ? { branch_id: filters.branch_id } : {};

    const salesInvoices = await this.prisma.salesInvoice.findMany({
      where: { company_id: companyId, ...branchFilter, ...where, status: 'POSTED',...(filters.customer_id?{party_id:filters.customer_id}:{}),...(filters.staff_id?{posted_by:filters.staff_id}:{}) },
      include: {
         party: { select: { name: true } }
      },
      orderBy: { document_date: 'desc' }
    });

    const salesReturns = await this.prisma.salesReturn.findMany({
       where: { company_id: companyId, ...branchFilter, ...where, status: 'POSTED' }
    });

    const canonical=await this.operational.sales(companyId,filters);
    const grossSales = canonical.gross_sales;
    const returns = canonical.returns;
    
    // Aggregate by payment type for period
    const receipts = await this.prisma.voucher.findMany({
        where: {
            company_id: companyId,
            ...branchFilter,
            voucher_date: where.document_date || {},
            voucher_type: 'RECEIPT',
            status: 'POSTED'
        },
        include: { lines: { include: { ledger_account: true } } }
    });

    let cash = 0; let upi = salesInvoices.reduce((sum,inv)=>sum+(Array.isArray(inv.payment_snapshot)?inv.payment_snapshot:[]).reduce<number>((s,p)=>s+((p as any).method==='UPI'?Number((p as any).amount):0),0),0); let udhar = 0;
    receipts.forEach(receipt => {
        receipt.lines.forEach(line => {
            if (Number(line.debit) > 0) {
                if (line.ledger_account.code === 'CASH_IN_HAND') cash += Number(line.debit);
                else if (line.ledger_account.code === 'DEFAULT_BANK'&&receipt.source_document_type!=='POS_RECEIPT'&&receipt.payment_method==='UPI') upi += Number(line.debit);
            }
        });
    });
    
    udhar = salesInvoices.reduce((sum, inv) => sum + Number(inv.outstanding_amount || 0), 0);

    return {
      summary: {
        upi_accounts: await this.counter.upiAccounts(companyId,filters.branch_id,filters.from?.slice(0,10)||'1970-01-01',filters.to?.slice(0,10)||'9999-12-30'),
        ...await this.counter.saleKinds(companyId,filters.branch_id,filters.from?.slice(0,10)||'1970-01-01',filters.to?.slice(0,10)||'9999-12-30'),
      gross_sales: grossSales,
        returns: returns,
        net_sales: grossSales - returns,
        bills_count: salesInvoices.length,
        cash_received: cash,
        upi_received: await this.counter.upiReceived(companyId,filters.branch_id,filters.from?.slice(0,10)||'1970-01-01',filters.to?.slice(0,10)||'9999-12-30'),
        udhar_sales: udhar
      },
      bills: salesInvoices.map(inv => ({
          id: inv.id,
          document_number: inv.document_number,
          document_date: inv.document_date,
          customer_name: inv.walkin_name || inv.party?.name || 'Walk-in',
          grand_total: Number(inv.grand_total),
          paid_amount: Number(inv.paid_amount),
          outstanding_amount: Number(inv.outstanding_amount)
      }))
    };
  }

  async getTopItemsReport(companyId: string, filters: ReportFilterDto) {
    const where = this.buildDateFilter(filters);
    const branchFilter = filters.branch_id ? { branch_id: filters.branch_id } : {};

    const salesGroups = await this.prisma.salesInvoiceLine.groupBy({
        by: ['item_id'],
        where: { ...(filters.item_id?{item_id:filters.item_id}:{}),sales_invoice: { company_id: companyId, ...branchFilter, ...where, status: 'POSTED' } },
        _sum: { quantity: true, line_total: true }
    });

    const returnGroups = await this.prisma.salesReturnLine.groupBy({
        by: ['item_id'],
        where: { ...(filters.item_id?{item_id:filters.item_id}:{}),sales_return: { company_id: companyId, ...branchFilter, ...where, status: 'POSTED' } },
        _sum: { quantity: true, line_total: true }
    });

    const itemStats: Record<string, { id: string, name: string, qty: number, value: number }> = {};
    const itemIds = new Set<string>();
    
    salesGroups.forEach(sg => {
        if (!itemStats[sg.item_id]) {
            itemStats[sg.item_id] = { id: sg.item_id, name: 'Unknown Item', qty: 0, value: 0 };
            itemIds.add(sg.item_id);
        }
        itemStats[sg.item_id].qty += Number(sg._sum.quantity || 0);
        itemStats[sg.item_id].value += Number(sg._sum.line_total || 0);
    });

    returnGroups.forEach(rg => {
        if (!itemStats[rg.item_id]) return; // Returning an item not sold in this period ignores it
        itemStats[rg.item_id].qty -= Number(rg._sum.quantity || 0);
        itemStats[rg.item_id].value -= Number(rg._sum.line_total || 0);
    });

    const itemsDb = await this.prisma.item.findMany({
        where: { id: { in: Array.from(itemIds) } },
        select: { id: true, name: true, sku: true }
    });

    itemsDb.forEach(dbItem => {
        if (itemStats[dbItem.id]) {
            itemStats[dbItem.id].name = dbItem.name;
        }
    });

    return Object.values(itemStats)
        .filter(stat => stat.qty > 0) // Hide items completely returned
        .sort((a, b) => b.value - a.value);
  }

  async getPurchaseReport(companyId: string, filters: ReportFilterDto) {
    const where = this.buildDateFilter(filters);
    const branchFilter = filters.branch_id ? { branch_id: filters.branch_id } : {};

    const purchases = await this.prisma.purchaseInvoice.findMany({
      where: { company_id: companyId, ...branchFilter, ...where, status: 'POSTED',...(filters.supplier_id?{party_id:filters.supplier_id}:{}) },
      include: { party: { select: { name: true } } }
    });

    const canonical=await this.operational.purchase(companyId,filters);
    const total = canonical.total_purchases;
    const paid = canonical.paid_amount;
    const due = canonical.outstanding_amount;

    return {
      summary: {
        total_purchases: total,
        paid_amount: paid,
        outstanding_amount: due,
        purchase_count: purchases.length
      },
      purchases: purchases.map(p => ({
          id: p.id,
          document_number: p.document_number,
          document_date: p.document_date,
          supplier_name: p.party.name,
          grand_total: Number(p.grand_total),
          paid_amount: Number(p.paid_amount),
          outstanding_amount: Number(p.outstanding_amount)
      }))
    };
  }

  async getExpenseReport(companyId: string, filters: ReportFilterDto) {
    const whereDate = filters.from || filters.to ? (() => {
        const d: any = {};
        if (filters.from) d.gte = new Date(filters.from);
        if (filters.to) d.lte = new Date(/^\d{4}-\d{2}-\d{2}$/.test(filters.to)?filters.to+'T23:59:59.999Z':filters.to);
        return { date: d };
    })() : {};

    const branchFilter = filters.branch_id ? { branch_id: filters.branch_id } : {};

    const expenses = await this.prisma.expense.findMany({
        where: { company_id: companyId, ...branchFilter, ...whereDate, status: 'POSTED',...(filters.category_id?{category_id:filters.category_id}:{}) },
        include: { category: { select: { name: true } } },
        orderBy: { date: 'desc' }
    });

    let businessTotal = 0;
    let ownerTotal = 0;
    const categoryBreakdown: Record<string, { category: string, amount: number }> = {};

    const list = expenses.map(exp => {
        const amt = Number(exp.amount);
        if (exp.type === 'BUSINESS_EXPENSE') {
            businessTotal += amt;
            const catName = exp.category?.name || 'Uncategorized';
            if (!categoryBreakdown[catName]) categoryBreakdown[catName] = { category: catName, amount: 0 };
            categoryBreakdown[catName].amount += amt;
        } else if (exp.type === 'OWNER_WITHDRAWAL') {
            ownerTotal += amt;
        }
        return {
            id: exp.id,
            date: exp.date,
            type: exp.type,
            category: exp.category?.name,
            amount: amt,
            paid_to: exp.paid_to,
            payment_method: exp.payment_method
        };
    });

    const canonical=await this.operational.expenses(companyId,filters);
    return {
        summary: {
            business_expenses: canonical.business_expenses,
            owner_withdrawal: canonical.owner_withdrawal
        },
        category_breakdown: Object.values(categoryBreakdown).sort((a,b) => b.amount - a.amount),
        expenses: list
    };
  }

  async getStockReport(companyId: string, filters: ReportFilterDto) {
    const result=await this.operational.stock(companyId,filters,0,10000);
    return {summary:result.summary,items:result.items.sort((a,b)=>a.quantity-b.quantity)};
  }
  async getCustomerDueReport(companyId: string, filters: ReportFilterDto) {
    const result=await this.operational.dues(companyId,'CUSTOMER',0,10000);
    return {summary:result.summary,customers:result.rows.sort((a,b)=>b.due-a.due)};
  }
  async getSupplierDueReport(companyId: string, filters: ReportFilterDto) {
    const result=await this.operational.dues(companyId,'SUPPLIER',0,10000);
    return {summary:result.summary,suppliers:result.rows.sort((a,b)=>b.due-a.due)};
  }

  async getReturnsReport(companyId: string, filters: ReportFilterDto) {
    const where = this.buildDateFilter(filters);
    const branchFilter = filters.branch_id ? { branch_id: filters.branch_id } : {};

    const { rows: returns, total } = await readReturnHistory(this.prisma, companyId, { ...branchFilter, ...where });

    // Posted return invoice value includes both cash refunds and Khata credits.
    // Sum the authoritative decimals from this exact row set, so a concurrent
    // return cannot make independently queried rows and totals disagree.

    return {
        summary: { total_returns: total.toNumber(), returns_count: returns.length },
        returns
    };
  }
}
