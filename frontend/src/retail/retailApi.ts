import { readReport } from './reports/reportReads';
/**
 * EVOLIX Retail V1 — API Abstraction Layer
 * 
 * This file serves as the bridge between the simple Retail UI
 * and the complex ERP backend. 
 * 
 * DO NOT calculate accounting or stock logic here. 
 * Pass actions to the backend which acts as the single source of truth.
 */
import api from '../shared/api';

// List and detail responses are returned directly by the Retail facade.
// Keep the existing UI envelope in this one adapter.
const envelope = async <T>(request: Promise<{ data: T }>) => {
  const response = await request;
  return { ...response, data: { data: response.data } };
};

// ── TYPES ─────────────────────────────────────────────────────────
export interface RetailItem {
  gst_rate?:number;
  has_unit_conversions?: boolean;
  image?: { id: string } | null;
  inventory_tracking?: boolean;
  primary_unit_id?: string;
  selling_mode?: string; item_type?: string; has_variants?: boolean; track_batch?: boolean; track_serial?: boolean;
  tax_rate?: number; mrp?: number; warranty_days?: number; is_bundle?: boolean; has_modifiers?: boolean;
  id: string;
  name: string;
  sku: string;
  selling_price: number;
  purchase_price: number;
  unit: string;
  current_stock: number;
  barcode?: string;
  low_stock_threshold?: number;
  active: boolean;
}

export interface RetailCustomer {
  code?: string; credit_allowed?: boolean;
  id: string;
  name: string;
  mobile?: string;
  outstanding_amount: number;
  active: boolean;
}

export interface RetailKhataTransaction {
  id: string;
  type: 'SALE' | 'PAYMENT' | 'PURCHASE';
  date: string;
  amount: number;
  balance_after: number;
  reference: string;
  reference_id?: string;
  invoice_id?: string;
  attachment?: { id: string } | null;
}

export interface RetailSupplier {
  code?: string; nickname?: string; credit_allowed?: boolean;
  id: string;
  name: string;
  mobile?: string;
  outstanding_amount: number;
  active: boolean;
}

export interface RetailPurchase {
  id: string;
  document_number: string;
  document_date: string;
  grand_total: number;
  outstanding_amount: number;
  party: { id: string; name: string };
  status: string;
  attachment?: { id: string } | null;
}

export interface RetailNeed {
  id: string;
  name: string;
  quantity: number;
  priority: string;
  status: string;
  customer?: { name: string };
  preferred_supplier?: { name: string };
  attachment?: { id: string } | null;
}

/**
 * ── BILLING / POS ───────────────────────────────────────────────
 */

export const posApi = {
  lookupBarcode: async (sku: string) => {
    // Maps to: GET /api/v1/erp/pos/barcode/:sku
    return api.get(`/erp/pos/barcode/${sku}`);
  },

  postSale: async (payload: {
    items: Array<{ item_id?: string; new_item?: import('./retailStore').BillLineItem['new_item']; variant_id?: string; batch_id?: string; unit_id?: string; dimensions?: any; serial_ids?: string[]; modifier_option_ids?: string[]; quantity: number; rate: number; discount_amount: number; gst_rate?:number }>;
    customer_id?: string;
    customer_name?:string;
    service_charge?:import('./retailStore').ServiceCharge;
    bill_discount_percent?:number;
    payment_splits: Array<{ method: string; amount: number; receiving_profile_id?:string; received_on_mobile?:string; receipt_confirmed?:boolean }>;
    total_amount: number;
    discount: number;
    bill_discount?: number;
    date?: string; due_date?: string; sales_channel?: string; note?: string;
    },idempotencyKey?:string) => {
      // Keep one identity for the whole bill, including a response-lost retry.
      return api.post('/retail/bills', payload,idempotencyKey?{headers:{'Idempotency-Key':idempotencyKey}}:undefined);
  },
  
  holdBill: async (_branchId: string, items: any[], extra?: {customer_id?:string; reference_name?:string; note?:string; bill_discount?:number}) => {
    // Maps to: POST /api/v1/retail/bills/hold
    return api.post('/retail/bills/hold', { ...extra, items: items.map(({ item_id, quantity, rate, discount_amount, unit_id, variant_id, batch_id, serial_ids, modifier_option_ids, dimensions }) => ({ item_id, quantity, rate, discount_amount, unit_id, variant_id, batch_id, serial_ids, modifier_option_ids, dimensions })) });
  },

  getHeldBills: async (_branchId: string) => {
    // Maps to: GET /api/v1/retail/bills/hold
    return envelope(api.get<any[]>('/retail/bills/hold'));
  },
  
  resumeBill: async (id: string) => {
    // Maps to: POST /api/v1/retail/bills/hold/:id/resume
    return api.post(`/retail/bills/hold/${id}/resume`);
  },

  getBills: async (params?: any) => {
    return api.get('/retail/bills', { params });
  },

  getBillDetail: async (id: string) => {
    return api.get(`/retail/bills/${id}`);
  },

  postReturn: async (payload: { original_invoice_id: string; lines: any[]; refund_method: string }) => {
    return api.post('/retail/bills/return', payload);
  }
};

/**
 * ── ITEMS & STOCK ───────────────────────────────────────────────
 * 
 * Note: While /inventory/stock exists, basic CRUD for Items
 * requires new backend endpoints (e.g. /api/v1/items).
 */

export const itemApi = {
  getStock: async () => {
    // Maps to: GET /api/v1/inventory/stock
    return api.get('/inventory/stock');
  },

  getItems: async (search?: string, offset=0, stock_status?:'all'|'low'|'out',includeInactive=false,item_type?:'SERVICE'|'PART') => {
    // Maps to: GET /api/v1/retail/items
    const params = {item_type,search,offset,limit:100,stock_status,...(includeInactive?{include_inactive:'true'}:{})};
    return envelope(api.get<RetailItem[]>('/retail/items', { params }));
  },

  createItem: async (payload: { name: string; selling_price: number; opening_stock?: number; [key: string]: any }) => {
    // Maps to: POST /api/v1/retail/items
    return envelope(api.post<RetailItem>('/retail/items', payload));
  }
};

/**
 * ── CUSTOMERS & KHATA ───────────────────────────────────────────
 * 
 * Note: Customer creation and simple payments require dedicated
 * Retail endpoints to hide complex ERP voucher/ledger logic.
 */

export const khataApi = {
  getOutstanding: async (partyId: string) => {
    // Maps to: GET /api/v1/accounting/parties/:id/outstanding
    return api.get(`/accounting/parties/${partyId}/outstanding`);
  },

  getCustomers: async (search?: string, offset=0) => {
    // Maps to: GET /api/v1/retail/customers
    const params = { search, offset, limit:100 };
    return envelope(api.get<RetailCustomer[]>('/retail/customers', { params }));
  },

  createCustomer: async (payload: { name: string; mobile?: string; [key: string]: unknown }) => {
    // Maps to: POST /api/v1/retail/customers
    return envelope(api.post<RetailCustomer>('/retail/customers', payload));
  },

  receivePayment: async (partyId: string, payload: { amount: number; payment_method: string; receiving_profile_id?:string; received_on_mobile?:string; receipt_confirmed?:boolean; note?: string; date?: string }) => {
    // Maps to: POST /api/v1/retail/customers/:id/payments
    return api.post(`/retail/customers/${partyId}/payments`, payload);
  },
  
  getTimeline: async (partyId: string) => {
    // Maps to: GET /api/v1/retail/customers/:id/khata
    const response = await api.get<{ customer: RetailCustomer; balance: number; transactions: RetailKhataTransaction[] }>(`/retail/customers/${partyId}/khata`);
    return { ...response, data: { data: { ...response.data, customer: { ...response.data.customer, outstanding_amount: response.data.balance } } } };
  }
};

/**
 * ── SUPPLIERS & KHATA (PHASE 2) ─────────────────────────────────
 */
export const supplierApi = {
  getSuppliers: async (search?: string, offset=0) => {
    const params = { search, offset, limit:100 };
    return envelope(api.get<RetailSupplier[]>('/retail/suppliers', { params }));
  },

  createSupplier: async (payload: { name: string; mobile?: string; [key: string]: unknown }) => {
    return envelope(api.post<RetailSupplier>('/retail/suppliers', payload));
  },

  paySupplier: async (partyId: string, payload: { amount: number; payment_method: string; receiving_profile_id?:string; received_on_mobile?:string; receipt_confirmed?:boolean; note?: string; date?: string }) => {
    return api.post(`/retail/suppliers/${partyId}/payments`, payload);
  },

  getTimeline: async (partyId: string) => {
    return envelope(api.get<{ supplier: RetailSupplier; balance: number; transactions: RetailKhataTransaction[] }>(`/retail/suppliers/${partyId}/khata`));
  }
};

/**
 * ── PURCHASES (PHASE 2) ─────────────────────────────────────────
 */
export const purchaseApi = {
  getPurchases: async (params?: {search?:string;offset?:number;limit?:number}) => {
    return envelope(api.get<RetailPurchase[]>('/retail/purchases',{params}));
  },

  createPurchase: async (payload: any) => {
    return envelope(api.post<RetailPurchase>('/retail/purchases', payload));
  }
};

/**
 * ── NEED LIST (PHASE 2) ─────────────────────────────────────────
 */
export const needListApi = {
  getNeeds: async () => {
    return envelope(api.get<RetailNeed[]>('/retail/needs'));
  },

  createNeed: async (payload: any) => {
    return envelope(api.post<RetailNeed>('/retail/needs', payload));
  },

  updateNeedStatus: async (id: string, status: string) => {
    return api.post(`/retail/needs/${id}/status`, { status });
  }
};

/**
 * ── DASHBOARD ───────────────────────────────────────────────────
 */

export const dashboardApi = {
  getDashboard: async () => {
    // Maps to: GET /api/v1/retail/home
    return api.get('/retail/home');
  }
};

/**
 * -- EXPENSES (PHASE 3) -------------------------------------------
 */
export const expenseApi = {
  getExpenses: async (params?: any) => {
    return api.get('/retail/expenses', { params });
  },

  getSummary: async () => {
    return api.get('/retail/expenses/summary');
  },

  createExpense: async (payload: any) => {
    return api.post('/retail/expenses', payload);
  },

  cancelExpense: async (id: string) => {
    return api.delete(`/retail/expenses/${id}`);
  },

  getCategories: async () => {
    return api.get('/retail/expense-categories');
  },

  createCategory: async (payload: { name: string; icon?: string }) => {
    return api.post('/retail/expense-categories', payload);
  }
};

/**
 * -- REPORTS (PHASE 5) -------------------------------------------
 */
export const reportsApi = {
  getDashboard: async (params?: any) => {
    return readReport('/retail/reports/dashboard', params);
  },
  getSales: async (params?: any) => {
    return readReport('/retail/reports/sales', params);
  },
  getTopItems: async (params?: any) => {
    return readReport('/retail/reports/sales/items', params);
  },
  getPurchases: async (params?: any) => {
    return readReport('/retail/reports/purchases', params);
  },
  getExpenses: async (params?: any) => {
    return readReport('/retail/reports/expenses', params);
  },
  getStock: async (params?: any) => {
    return readReport('/retail/reports/stock', params);
  },
  getCustomerDue: async (params?: any) => {
    return readReport('/retail/reports/customers/due', params);
  },
  getSupplierDue: async (params?: any) => {
    return readReport('/retail/reports/suppliers/due', params);
  },
  getReturns: async (params?: any) => {
    return readReport('/retail/reports/returns', params);
  }
};
