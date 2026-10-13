import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/** Read-only summaries from posted records. The hosted ERP database is authoritative. */
@Injectable()
export class OwnerDashboardService {
  constructor(private readonly db: PrismaService) {}

  async getOwnerDashboardSummary(companyId: string, day: Date) {
    const company = await this.db.company.findUnique({ where: { id: companyId }, select: { id: true, timezone: true } });
    if (!company) throw new NotFoundException('Business not found');
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: company.timezone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(day);
    // Document dates are SQL DATE values. Compare the selected business date rather than server UTC.
    const documentDay = new Date(date + 'T00:00:00Z');
    const [sales, receipts, activeUsers] = await Promise.all([
      this.db.salesInvoice.aggregate({ where: { company_id: companyId, document_date: documentDay, status: 'POSTED' }, _sum: { grand_total: true } }),
      this.db.voucherLine.aggregate({ where: { voucher: { company_id: companyId, voucher_type: 'RECEIPT', status: 'POSTED', voucher_date: documentDay } }, _sum: { debit: true } }),
      this.db.user.count({ where: { is_active: true, roles: { some: { company_id: companyId } } } }),
    ]);
    return { date, total_sales: Number(sales._sum.grand_total || 0), total_receipts: Number(receipts._sum.debit || 0), active_users: activeUsers };
  }

  getExternalSyncStatus() {
    return { status: 'NOT_CONFIGURED', provider: null, message: 'EVOLIX already stores posted records in its authoritative hosted database. A separate external replication provider is not configured.' };
  }
}
