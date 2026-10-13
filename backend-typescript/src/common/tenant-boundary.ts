import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const references: Record<string,string> = {
  item_id:'item', component_item_id:'item', bundle_item_id:'item', unit_id:'unit', entered_unit_id:'unit', from_unit_id:'unit', to_unit_id:'unit',
  tax_class_id:'taxClass', party_id:'party', customer_id:'party', supplier_id:'party', preferred_supplier_id:'party',
  branch_id:'branch', financial_year_id:'financialYear', godown_id:'godown', source_godown_id:'godown', destination_godown_id:'godown',
  variant_id:'itemVariant', batch_id:'itemBatch', serial_id:'itemSerial', attachment_id:'attachment', category_id:'expenseCategory',
  ledger_account_id:'ledgerAccount', ledger_id:'ledgerAccount', parent_id:'ledgerAccount', price_list_id:'priceList',
  original_invoice_id:'salesInvoice', original_line_id:'salesInvoiceLine', purchase_order_id:'purchaseOrder', goods_receipt_id:'goodsReceipt',
  purchase_order_line_id:'purchaseOrderLine', goods_receipt_line_id:'goodsReceiptLine', purchase_invoice_id:'purchaseInvoice',
  purchase_invoice_line_id:'purchaseInvoiceLine', sales_order_id:'salesOrder', sales_order_line_id:'salesOrderLine',
  delivery_challan_id:'deliveryChallan', delivery_challan_line_id:'deliveryChallanLine', original_sales_invoice_id:'salesInvoice',
};
const paths: Record<string,string> = {
  'purchase/orders':'purchaseOrder','purchase/receipts':'goodsReceipt','purchase/invoices':'purchaseInvoice','purchase/returns':'purchaseReturn',
  'sales/orders':'salesOrder','sales/quotations':'salesQuotation','sales/challans':'deliveryChallan','sales/invoices':'salesInvoice','sales/returns':'salesReturn',
  'retail/items':'item','retail/customers':'party','retail/suppliers':'party','retail/needs':'needList','retail/expenses':'expense',
  'retail/expenses/categories':'expenseCategory','retail/expense-categories':'expenseCategory','retail/bills':'salesInvoice','retail/bills/held':'posHeldBill',
  'inventory/adjustments':'stockAdjustment','inventory/transfers':'stockTransfer','inventory/opening-stock':'openingStock',
  'accounting/accounts':'ledgerAccount','accounting/ledger':'ledgerAccount','accounting/parties':'party','accounting/vouchers':'voucher',
  'banking/accounts':'bankAccount','banking/cheques':'cheque','pricing/price-lists':'priceList','pricing/promotions':'promotion',
  'attachments':'attachment','erp/pos/held-bills':'posHeldBill','erp/pos/shift/close':'posShift',
};
const parentScope: Record<string,any> = {
  itemVariant:{item:true}, salesInvoiceLine:{sales_invoice:true}, purchaseInvoiceLine:{purchase_invoice:true},
  purchaseOrderLine:{purchase_order:true}, goodsReceiptLine:{goods_receipt:true}, salesOrderLine:{sales_order:true},
  deliveryChallanLine:{delivery_challan:true}, godown:{branch:true},
};

/** Shared HTTP defense, in addition to engine-level checks: resolve every client reference inside the authorized company. */
export async function validateTenantBoundary(db: PrismaService, req: any, user: any) {
  const seen = new Set<string>();
  const check = async (model:string, id:unknown) => {
    if (id === undefined || id === null || id === '') return;
    if (typeof id !== 'string' || !uuid.test(id)) throw new BadRequestException('Invalid resource ID');
    if (seen.has(model+id)) return; seen.add(model+id);
    const parent = parentScope[model];
    const where: any = { id, ...(parent ? Object.fromEntries(Object.keys(parent).map(key => [key,{company_id:user.company_id}])) : {company_id:user.company_id}) };
    const delegate = (db as any)[model];
    if (!delegate || !await delegate.findFirst({where})) {
      if(['GET','HEAD','DELETE','PATCH'].includes(req.method))throw new NotFoundException('Resource not found');
      throw new BadRequestException('Resource not found');
    }
  };
  const path = (req.path||req.url||'').split('?')[0].replace(/^\/api\/v1\//,'').replace(/^\//,'').split('/');
  const administration = ['branches','godowns','companies','financial-years'].includes(path[0]) &&
    (['ADMIN','OWNER','TENANT_ADMIN'].includes(user.role) || user.permissions?.includes('identity.admin'));
  const paramId = path.find((p:string) => uuid.test(p));
  if (paramId) {
    const prefix = path.slice(0,path.indexOf(paramId)).join('/');
    if (prefix === 'erp/pos/held-bills' && req.method === 'GET') await check('branch',paramId);
    else if (paths[prefix]) await check(paths[prefix],paramId);
    else if (prefix === 'erp/pos/shift/current' || prefix === 'erp/pos/held-bills') await check('branch',paramId);
  }
  const walk = async (input:any, depth=0) => {
    if (!input || typeof input !== 'object') return;
    if (depth > 12) throw new BadRequestException('Request nesting is too deep');
    if (Array.isArray(input)) { for (const value of input) await walk(value,depth+1); return; }
    for (const [key,value] of Object.entries(input)) {
      if (['connect','connectOrCreate','disconnect','upsert','deleteMany','updateMany','set','create','update','delete'].includes(key)) throw new BadRequestException('Nested database operations are not accepted');
      if (key === 'company_id' && value !== user.company_id || key === 'organization_id' && value !== user.organization_id)
        throw new ForbiddenException('Resource is outside this shop');
      if (key === 'branch_id' && user.branch_id && value && value !== user.branch_id && !administration) throw new ForbiddenException('Resource is outside this store');
      if (references[key]) await check(references[key],value);
      if (key === 'serial_ids' && Array.isArray(value)) for (const id of value) await check('itemSerial',id);
      if (!['custom_attributes','dimensions','attributes','modifiers'].includes(key)) await walk(value,depth+1);
    }
  };
  await walk(req.body); await walk(req.query);
}
