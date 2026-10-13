import { Injectable } from '@nestjs/common';

@Injectable()
export class IntentResolverService {
  resolve(question: string): { intent: string; parameters?: any } | null {
    const q = question.toLowerCase();

    // Deterministic matching
    if (q.includes('open purchase') || q.includes('pending purchase') || q.includes('po open')) {
      return { intent: 'OPEN_PURCHASE_ORDERS' };
    }
    if (q.includes('pending receipt') || q.includes('waiting to receive')) {
      return { intent: 'PENDING_RECEIPTS' };
    }
    if (q.includes('owe supplier') || q.includes('supplier outstanding') || q.includes('payable')) {
      return { intent: 'SUPPLIER_OUTSTANDING' };
    }
    if (q.includes('purchase summary') || q.includes('total purchase')) {
      return { intent: 'PURCHASE_SUMMARY' };
    }
    if (q.includes('recent transaction') || q.includes('latest activity')) {
      return { intent: 'RECENT_TRANSACTIONS' };
    }

    // Fallbacks to unimplementable intents
    if (q.includes('sales today') || q.includes('today sales')) return { intent: 'SALES_TODAY' };
    if (q.includes('sale') && q.includes('period')) return { intent: 'SALES_PERIOD' };
    if (q.includes('customer owe') || q.includes('receivable')) return { intent: 'CUSTOMER_OUTSTANDING' };
    if (q.includes('low stock') || q.includes('stock alert')) return { intent: 'LOW_STOCK' };
    if (q.includes('cash balance') || q.includes('cash in hand')) return { intent: 'CASH_BALANCE' };
    if (q.includes('bank balance')) return { intent: 'BANK_BALANCE' };
    if (q.includes('top selling') || q.includes('best seller')) return { intent: 'TOP_SELLING_ITEMS' };

    // If completely unknown
    return null;
  }
}
