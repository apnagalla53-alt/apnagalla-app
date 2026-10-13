import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PostingService } from '../../accounting/posting.service';
import { CreateExpenseDto } from './dto/expense.dto';
import { Prisma } from '@prisma/client';
import { page } from '../../common/pagination';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingService: PostingService,
  ) {}

  async create(
    organizationId: string,
    companyId: string,
    branchId: string,
    userId: string,
    financialYearId: string,
    dto: CreateExpenseDto
  ) {
    if (!financialYearId) {
      throw new BadRequestException('financialYearId is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const date = new Date(dto.date);
      const fy = await tx.financialYear.findFirst({ where: { id: financialYearId, company_id: companyId, is_closed: false,
        start_date: { lte: date }, end_date: { gte: new Date(date.toISOString().slice(0,10)) } } });
      if (!fy || !await tx.branch.findFirst({ where: { id: branchId, company_id: companyId } })) throw new BadRequestException('Select an open financial year covering this expense date and a valid branch');
      if (dto.attachment_id && !await tx.attachment.findFirst({ where: { id: dto.attachment_id, company_id: companyId } })) throw new BadRequestException('Attachment not found');
      // 1. Resolve Debit Ledger
      let debitLedgerId: string;
      if (dto.type === 'BUSINESS_EXPENSE') {
        const category = await tx.expenseCategory.findFirst({
          where: { id: dto.category_id, company_id: companyId }
        });
        if (!category) throw new BadRequestException('Invalid category');
        if (!category.ledger_id) {
          throw new BadRequestException(`Category ${category.name} is not mapped to an accounting ledger.`);
        }
        debitLedgerId = category.ledger_id;
      } else {
        // OWNER_WITHDRAWAL
        const drawingsLedger = await this.getOrCreateDrawingsLedger(tx, companyId, branchId);
        debitLedgerId = drawingsLedger.id;
      }

      // 2. Resolve Credit Ledger based on Payment Method
      const creditLedgerId = await this.getPaymentLedger(tx, companyId, branchId, dto.payment_method);

      // 3. Post Accounting Voucher
      const narration = dto.type === 'OWNER_WITHDRAWAL' 
        ? `Owner Withdrawal: ${dto.note || ''}` 
        : `Expense Paid: ${dto.note || ''}`;

      const voucherDto = {
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: financialYearId,
        voucher_type: 'PAYMENT',
        document_number: `EXP-${Date.now()}`,
        voucher_date: new Date(dto.date),
        narration: narration,
        posted_by: userId,
        payment_method: dto.payment_method,
        lines: [
          {
            ledger_account_id: debitLedgerId,
            debit: dto.amount,
            credit: 0,
            narration: dto.note || 'Expense'
          },
          {
            ledger_account_id: creditLedgerId,
            debit: 0,
            credit: dto.amount,
            narration: 'Payment'
          }
        ]
      };

      const voucher = await this.postingService.postVoucher(tx, voucherDto);

      // 4. Create Retail Expense Record
      const expense = await tx.expense.create({
        data: {
          organization_id: organizationId,
          company_id: companyId,
          branch_id: branchId,
          type: dto.type,
          category_id: dto.type === 'BUSINESS_EXPENSE' ? dto.category_id : null,
          amount: dto.amount,
          payment_method: dto.payment_method,
          date: new Date(dto.date),
          paid_to: dto.paid_to,
          bill_number: dto.bill_number,
          note: dto.note,
          status: 'POSTED',
          voucher_id: voucher.id,
          attachment_id: dto.attachment_id || null,
          created_by: userId,
        }
      });

      // Update voucher source document link
      await tx.voucher.update({
        where: { id: voucher.id },
        data: {
          source_document_type: 'RETAIL_EXPENSE',
          source_document_id: expense.id
        }
      });

      // Update Attachment record
      if (dto.attachment_id) {
        await tx.attachment.update({
          where: { id: dto.attachment_id },
          data: {
            entity_type: 'EXPENSE_BILL',
            entity_id: expense.id
          }
        });
      }

      return expense;
    });
  }

  async findAll(companyId: string, branchId: string, query: any) {
    const { type, limit = 50, offset = 0, startDate, endDate, category_id } = query;
    const whereClause: any = { company_id: companyId, branch_id: branchId };

    if (type) whereClause.type = type;
    if (category_id) whereClause.category_id = category_id;
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(startDate);
      if (endDate) whereClause.date.lte = new Date(endDate);
    }

    const expenses = await this.prisma.expense.findMany({
      where: whereClause,
      include: {
        category: { select: { name: true, icon: true } }
      },
      orderBy: { date: 'desc' },
      ...page({limit,offset})
    });

    const total = await this.prisma.expense.count({ where: whereClause });
    return { data: expenses, total };
  }

  async findOne(companyId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, company_id: companyId },
      include: { category: true }
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async getSummary(companyId: string, branchId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const expenses = await this.prisma.expense.findMany({
      where: {
        company_id: companyId,
        branch_id: branchId,
        type: 'BUSINESS_EXPENSE',
        status: 'POSTED',
        date: { gte: firstDayOfMonth }
      }
    });

    let todayTotal = new Prisma.Decimal(0);
    let monthTotal = new Prisma.Decimal(0);

    expenses.forEach(exp => {
      const amt = new Prisma.Decimal(exp.amount);
      monthTotal = monthTotal.plus(amt);
      if (exp.date >= today) {
        todayTotal = todayTotal.plus(amt);
      }
    });

    return {
      today_business_expenses: todayTotal.toNumber(),
      month_business_expenses: monthTotal.toNumber(),
    };
  }

  async cancel(companyId: string, userId: string, expenseId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, company_id: companyId }
    });

    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.status === 'CANCELLED') throw new BadRequestException('Expense already cancelled');

    await this.postingService.reverseVoucherWithIsolationChecks(companyId, expense.voucher_id!, userId, 'Cancelled Retail Expense');

    await this.prisma.expense.update({
      where: { id: expenseId },
      data: { status: 'CANCELLED' }
    });

    return { success: true };
  }

  async update(
    organizationId: string,
    companyId: string,
    branchId: string,
    userId: string,
    financialYearId: string,
    id: string,
    dto: CreateExpenseDto
  ) {
    if (!financialYearId) {
      throw new BadRequestException('financialYearId is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({
        where: { id, company_id: companyId }
      });
      if (!expense) throw new NotFoundException('Expense not found');
      if (expense.status === 'CANCELLED') throw new BadRequestException('Cannot edit cancelled expense');

      // Reverse old voucher
      await this.postingService.reverseVoucherWithIsolationChecks(companyId, expense.voucher_id!, userId, 'Reversed for Edit');

      // Resolve new Ledgers
      let debitLedgerId: string;
      if (dto.type === 'BUSINESS_EXPENSE') {
        const category = await tx.expenseCategory.findFirst({
          where: { id: dto.category_id, company_id: companyId }
        });
        if (!category) throw new BadRequestException('Invalid category');
        if (!category.ledger_id) {
          throw new BadRequestException(`Category ${category.name} is not mapped to an accounting ledger.`);
        }
        debitLedgerId = category.ledger_id;
      } else {
        const drawingsLedger = await this.getOrCreateDrawingsLedger(tx, companyId, branchId);
        debitLedgerId = drawingsLedger.id;
      }

      const creditLedgerId = await this.getPaymentLedger(tx, companyId, branchId, dto.payment_method);

      // Post new Voucher
      const narration = dto.type === 'OWNER_WITHDRAWAL' 
        ? `Owner Withdrawal (Edited): ${dto.note || ''}` 
        : `Expense Paid (Edited): ${dto.note || ''}`;

      const voucherDto = {
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: financialYearId,
        voucher_type: 'PAYMENT',
        document_number: `EXP-EDIT-${Date.now()}`,
        voucher_date: new Date(dto.date),
        narration: narration,
        posted_by: userId,
        lines: [
          {
            ledger_account_id: debitLedgerId,
            debit: dto.amount,
            credit: 0,
            narration: dto.note || 'Expense'
          },
          {
            ledger_account_id: creditLedgerId,
            debit: 0,
            credit: dto.amount,
            narration: 'Payment'
          }
        ]
      };

      const newVoucher = await this.postingService.postVoucher(tx, voucherDto);

      // Update Expense Record
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          type: dto.type,
          category_id: dto.type === 'BUSINESS_EXPENSE' ? dto.category_id : null,
          amount: dto.amount,
          payment_method: dto.payment_method,
          date: new Date(dto.date),
          paid_to: dto.paid_to,
          bill_number: dto.bill_number,
          note: dto.note,
          voucher_id: newVoucher.id,
          attachment_id: dto.attachment_id || null,
        }
      });

      // Update new voucher source document link
      await tx.voucher.update({
        where: { id: newVoucher.id },
        data: {
          source_document_type: 'RETAIL_EXPENSE',
          source_document_id: updatedExpense.id
        }
      });

      // Update Attachment record if new
      if (dto.attachment_id) {
        await tx.attachment.update({
          where: { id: dto.attachment_id },
          data: {
            entity_type: 'EXPENSE_BILL',
            entity_id: updatedExpense.id
          }
        });
      }

      return updatedExpense;
    });
  }

  // --- Helpers ---

  private async getPaymentLedger(tx: Prisma.TransactionClient, companyId: string, branchId: string, method: string): Promise<string> {
    const config = await tx.companyConfiguration.findFirst({ where: { company_id: companyId } });
    if (!config) throw new BadRequestException('Company configuration missing');

    if (method === 'CASH') {
      if (!config.default_cash_ledger_id) throw new BadRequestException('Cash ledger not configured');
      return config.default_cash_ledger_id;
    }

    if (method === 'UPI' || method === 'BANK' || method === 'CARD') {
      if (!config.default_bank_ledger_id) throw new BadRequestException('Bank ledger not configured for non-cash payment');
      return config.default_bank_ledger_id;
    }

    throw new BadRequestException('Unsupported payment method');
  }

  private async getOrCreateDrawingsLedger(tx: Prisma.TransactionClient, companyId: string, branchId: string) {
    const code = 'OWNER-DRAWINGS';
    let ledger = await tx.ledgerAccount.findFirst({
      where: { company_id: companyId, code }
    });

    if (!ledger) {
      ledger = await tx.ledgerAccount.create({
        data: {
          company_id: companyId,
          branch_id: branchId,
          code,
          name: 'Owner Drawings',
          account_type: 'EQUITY',
          normal_balance: 'DEBIT',
          is_active: true
        }
      });
    }
    return ledger;
  }
}
