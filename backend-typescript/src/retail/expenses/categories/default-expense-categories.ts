import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Rent', 'Electricity', 'Transport', 'Wages / Salary', 'Packaging',
  'Repairs & Maintenance', 'Shop Supplies', 'Internet / Mobile', 'Delivery / Freight', 'Other',
] as const;

/** Initialize only an empty shop, under the same lock used by manual creation. */
export async function initializeExpenseCategories(tx: Prisma.TransactionClient, organizationId: string, companyId: string, branchId: string) {
  const company = await tx.company.findFirst({ where: { id: companyId, organization_id: organizationId } });
  if (!company || !await tx.branch.findFirst({ where: { id: branchId, company_id: companyId } })) throw new BadRequestException('Select a valid shop and branch.');
  await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId}::uuid FOR UPDATE`;
  if (await tx.expenseCategory.count({ where: { company_id: companyId } })) return false;
  for (const [index, name] of DEFAULT_EXPENSE_CATEGORIES.entries()) {
    const ledger = await tx.ledgerAccount.create({ data: {
      company_id: companyId, branch_id: branchId, code: `EXP-DEFAULT-${index}-${randomUUID().slice(0, 8)}`,
      name: `${name} Expense`, account_type: 'EXPENSE', normal_balance: 'DEBIT', is_active: true,
    } });
    await tx.expenseCategory.create({ data: { organization_id: organizationId, company_id: companyId, name, ledger_id: ledger.id, is_active: true } });
  }
  return true;
}
