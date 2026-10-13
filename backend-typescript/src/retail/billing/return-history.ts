import { Prisma } from '@prisma/client';

/** Posted returns and actual refund vouchers; never infer money paid out from invoice value. */
export async function readReturnHistory(db: Pick<Prisma.TransactionClient, 'salesReturn' | 'voucher'>, companyId: string, where: Prisma.SalesReturnWhereInput) {
  const returns = await db.salesReturn.findMany({
    where: { ...where, company_id: companyId, status: 'POSTED' },
    include: { party: { select: { name: true } }, lines: { include: {
      item: { select: { name: true } }, unit: { select: { code: true } },
      entered_unit: { select: { code: true } }, batch: { select: { batch_number: true } },
    } } }, orderBy: [{ document_date: 'desc' }, { id: 'desc' }],
  });
  const refunds = returns.length ? await db.voucher.findMany({
    where: { company_id: companyId, status: 'POSTED', source_document_type: 'POS_REFUND', source_document_id: { in: returns.map(r => r.id) } },
    include: { lines: { include: { ledger_account: { select: { code: true } } } } },
    orderBy: [{ voucher_date: 'asc' }, { id: 'asc' }],
  }) : [];
  const rows = returns.map(r => {
    const paid = refunds.filter(v => v.source_document_id === r.id).map(v => ({
      id: v.id, document_number: v.document_number, date: v.voucher_date, method: 'CASH',
      amount: v.lines.filter(l => l.ledger_account.code === 'CASH_IN_HAND').reduce((sum, l) => sum.plus(l.credit).minus(l.debit), new Prisma.Decimal(0)).toNumber(),
    }));
    const cash = paid.reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0));
    return {
      id: r.id, original_invoice_id: r.original_invoice_id, document_number: r.document_number,
      document_date: r.document_date, customer_name: r.party.name, grand_total: Number(r.grand_total),
      refund_method: cash.gt(0) ? 'CASH' : 'KHATA', cash_refunded: cash.toNumber(),
      credit_adjusted: Prisma.Decimal.max(0, r.grand_total.minus(cash)).toNumber(), refunds: paid,
      lines: r.lines.map(l => ({ id: l.id, original_line_id: l.original_line_id, item_id: l.item_id,
        variant_id: l.variant_id, item_name: l.item.name, quantity: Number(l.entered_quantity ?? l.quantity),
        base_quantity: Number(l.base_quantity ?? l.quantity), unit: l.entered_unit?.code || l.unit.code,
        line_total: Number(l.line_total), batch_number: l.batch?.batch_number || null,
      })),
    };
  });
  return { rows, total: returns.reduce((sum,r)=>sum.plus(r.grand_total),new Prisma.Decimal(0)) };
}
