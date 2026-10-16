/**
 * EVOLIX Retail V1 — Retail State Store
 *
 * Holds the current cart and the confirmed server sale for the UI.
 * DO NOT implement ERP business logic (like stock posting,
 * ledger updates, or accounting entries) in this file.
 * The backend is the single source of truth.
 *
 * Uses Zustand for simple, performant UI state management.
 */
import { create } from 'zustand';
import { createUuid } from '../shared/browserCrypto';
import { useAuthStore } from '../shared/store/authStore';
import { clearWorkflowDraft,readWorkflowDraft,workflowScope,writeWorkflowDraft } from './experience/workflowDraft';

// ── Types ──────────────────────────────────────────────

export interface RetailItem {
  primary_unit_id?: string; tax_rate?: number; item_type?: string; selling_mode?: string;
  id: string;
  name: string;
  sku: string;
  selling_price: number;
  purchase_price: number;
  mrp?: number;
  inventory_tracking?: boolean;
  current_stock: number;
  unit: string;
  category?: string;
  barcode?: string;
  hsn?: string;
  gst_rate?: number;
  low_stock_threshold?: number;
  active: boolean;
}

export interface BillLineItem {
  new_item?: { client_id: string; name: string; unit_code: string; unit_name?: string; selling_mode: string };
  row_id?: string; unit_id?: string; dimensions?: {length:number; width?:number; height?:number}; serial_ids?: string[]; tax_rate?: number;
  item_id: string;
  variant_id?: string;
  batch_id?: string;
  modifier_option_ids?: string[];
  modifier_unit_delta?: number;
  name: string;
  rate: number;
  quantity: number;
  discount_amount: number;
  unit: string;
  total: number;
}

export interface Customer {
  id: string;
  name: string;
  mobile?: string;
  gstin?: string;
  address?: string;
  balance: number; // positive = they owe us
}

export interface PaymentSplit {
  method: 'CASH' | 'UPI' | 'BANK';
  amount: number;
}

export interface BillDetails {
  date: string;
  due_date: string;
  sales_channel: 'COUNTER' | 'PHONE' | 'WHATSAPP' | 'ONLINE' | 'OTHER';
  note: string;
}
const newBillDetails = (): BillDetails => ({ date: new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()), due_date: '', sales_channel: 'COUNTER', note: '' });

export interface CompletedSale {
  gst_workflow?: boolean;
  invoice_id: string;
  invoice_number: string;
  amount: number;
  payment_mode: string;
  customer_name: string;
  items_count: number;
  lines_count?: number;
  timestamp: Date;
}

export interface KhataTransaction {
  id: string;
  type: 'sale' | 'payment' | 'return';
  amount: number;
  date: string;
  description: string;
  running_balance: number;
}

// ── Bill Store ─────────────────────────────────────────

/** Display estimate only. The POS service validates and posts the authoritative total. */
export function estimateLine(line: BillLineItem) {
  const dimensions = line.dimensions;
  const measured = line.quantity * (dimensions ? dimensions.length * (dimensions.width || 1) * (dimensions.height || 1) : 1);
  return Math.round(Math.max(0, measured * (line.rate + (line.modifier_unit_delta || 0)) - line.discount_amount) * (1 + (line.tax_rate || 0) / 100) * 100) / 100;
}
/** One wire shape for drafts, tax previews and confirmed payment. Draft IDs never leave the client. */
export function billLinePayload(i: BillLineItem) {
  return {item_id:i.new_item?undefined:i.item_id,new_item:i.new_item,variant_id:i.variant_id,batch_id:i.batch_id,unit_id:i.unit_id,dimensions:i.dimensions,serial_ids:i.serial_ids,modifier_option_ids:i.modifier_option_ids,quantity:i.quantity,rate:i.rate,discount_amount:i.discount_amount};
}

interface BillState {
  draft_id:string;
  gstWorkflow: boolean;
  setGstWorkflow: (value:boolean) => void;
  savedSale: { invoice: any; mode: string } | null;
  setSavedSale: (sale: { invoice: any; mode: string } | null) => void;
  details: BillDetails;
  attachment: File | null;
  setDetails: (details: Partial<BillDetails>) => void;
  setAttachment: (attachment: File | null) => void;
  putLine: (line: BillLineItem) => void;
  items: BillLineItem[];
  customer: Customer | null;
  discount: number;
  addItem: (item: RetailItem, qty?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, qty: number) => void;
  updateDiscount: (itemId: string, discount: number) => void;
  setCustomer: (customer: Customer | null) => void;
  setBillDiscount: (discount: number) => void;
  getSubtotal: () => number;
  getTotal: () => number;
  getItemCount: () => number;
  clearBill: () => void;
}

export const useBillStore = create<BillState>((set, get) => ({
  draft_id:createUuid(),
  gstWorkflow: false,
  setGstWorkflow: (gstWorkflow) => set({gstWorkflow}),
  savedSale: null,
  setSavedSale: (savedSale) => set({ savedSale }),
  details: newBillDetails(),
  attachment: null,
  setDetails: (details) => set(state => ({ details: { ...state.details, ...details } })),
  setAttachment: (attachment) => set({ attachment }),
  putLine: (line) => set(state => ({ items: line.row_id && state.items.some(i => i.row_id === line.row_id)
    ? state.items.map(i => i.row_id === line.row_id ? { ...line, total: estimateLine(line) } : i)
    : [...state.items, { ...line, row_id: createUuid(), total: estimateLine(line) }] })),
  items: [],
  customer: null,
  discount: 0,

  addItem: (item, qty = 1) => {
    if (item.inventory_tracking !== false && item.current_stock <= 0 && item.item_type !== 'SERVICE' && item.selling_mode !== 'SERVICE') return;
    set((state) => {
      const existing = state.items.find((i) => i.item_id === item.id && !i.variant_id && !i.dimensions && !i.serial_ids?.length);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.row_id === existing.row_id
              ? { ...i, quantity: i.quantity + qty, total: estimateLine({ ...i, quantity: i.quantity + qty }) }
              : i
          ),
        };
      }
      const newItem: BillLineItem = {
        item_id: item.id,
        row_id: item.id,
        unit_id: item.primary_unit_id,
        tax_rate: item.tax_rate || 0,
        name: item.name,
        rate: item.selling_price,
        quantity: qty,
        discount_amount: 0,
        unit: item.unit || 'PCS',
        total: item.selling_price * qty * (1 + (item.tax_rate || 0) / 100),
      };
      return { items: [...state.items, newItem] };
    });
  },

  removeItem: (itemId) => {
    set((state) => ({ items: state.items.filter((i) => (i.row_id || i.item_id) !== itemId) }));
  },

  updateQuantity: (itemId, qty) => {
    if (qty <= 0) {
      get().removeItem(itemId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        (i.row_id || i.item_id) === itemId
          ? { ...i, quantity: qty, total: estimateLine({ ...i, quantity: qty }) }
          : i
      ),
    }));
  },

  updateDiscount: (itemId, discount) => {
    set((state) => ({
      items: state.items.map((i) =>
        (i.row_id || i.item_id) === itemId
          ? { ...i, discount_amount: discount, total: estimateLine({ ...i, discount_amount: discount }) }
          : i
      ),
    }));
  },

  setCustomer: (customer) => set({ customer }),

  setBillDiscount: (discount) => set({ discount }),

  getSubtotal: () => {
    return get().items.reduce((sum, i) => sum + i.quantity * i.rate, 0);
  },

  getTotal: () => {
    const subtotal = get().items.reduce((sum, i) => sum + i.total, 0);
    return Math.max(0, subtotal - get().discount);
  },

  getItemCount: () => {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },

  clearBill: () => set({ draft_id:createUuid(),items: [], customer: null, discount: 0, details: newBillDetails(), attachment: null, savedSale: null, gstWorkflow:false }),
}));

// ── Sale Completion Store ──────────────────────────────

interface SaleCompleteState {
  completedSale: CompletedSale | null;
  setCompletedSale: (sale: CompletedSale) => void;
  clearCompletedSale: () => void;
}

export const useSaleCompleteStore = create<SaleCompleteState>((set) => ({
  completedSale: null,
  setCompletedSale: (sale) => set({ completedSale: sale }),
  clearCompletedSale: () => set({ completedSale: null }),
}));

// Recover only the unfinished UI draft, scoped to this user/company/branch/year.
// Financial posting and retries still pass through the server's idempotency path.
type SavedDraft=Pick<BillState,'draft_id'|'items'|'customer'|'details'|'discount'|'gstWorkflow'>;
let draftScope='',hydratingDraft=false;
function syncBillDraft(){const scope=workflowScope();if(scope===draftScope)return;hydratingDraft=true;draftScope=scope;
 const saved=readWorkflowDraft<SavedDraft>('bill',scope);
 useBillStore.setState({draft_id:createUuid(),items:[],customer:null,details:newBillDetails(),discount:0,gstWorkflow:false,attachment:null,savedSale:null,...(saved&&Array.isArray(saved.items)&&saved.items.length<=200?saved:{})});
 useSaleCompleteStore.getState().clearCompletedSale();hydratingDraft=false;
}
useAuthStore.subscribe(syncBillDraft);
useBillStore.subscribe(state=>{if(hydratingDraft||!draftScope)return;if(state.savedSale||!state.items.length){clearWorkflowDraft('bill',draftScope);return;}writeWorkflowDraft('bill',{draft_id:state.draft_id,items:state.items,customer:state.customer,details:state.details,discount:state.discount,gstWorkflow:state.gstWorkflow},draftScope);});
syncBillDraft();
