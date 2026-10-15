import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {businessDate} from '../../common/business-date';
import { PosService } from '../../pos/pos.service';
import { RetailBillDto, RetailAmountSaleDto } from '../dto/retail-bill.dto';
import { Prisma } from '@prisma/client';
import { readReturnHistory } from './return-history';
import { RetailService } from '../retail.service';
import { RETAIL_UNITS } from '../retail-units';
import { EntitlementService } from '../../common/entitlement.service';
class PreviewRollback extends Error { constructor(readonly quote: any) { super('Read-only bill preview'); } }

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posService: PosService,
    private readonly catalog: RetailService,
    private readonly entitlements: EntitlementService,
  ) {}


  private async mapLines(companyId: string, branchId: string, lines: any[]) {
    if (!Array.isArray(lines) || !lines.length) throw new BadRequestException('Select at least one item');
    if (lines.some(l => !l?.item_id || l.new_item)) throw new BadRequestException('Select a saved item for this operation');
    const godown = await this.prisma.godown.findFirst({ where: { branch_id: branchId, is_active: true, branch: { company_id: companyId } }, orderBy: [{created_at: 'asc'}, {id: 'asc'}] });
    if (!godown) throw new BadRequestException('No stock location found for this branch');
    const items = await this.prisma.item.findMany({ where: { company_id: companyId, id: { in: lines.map(l => l.item_id) } } });
    return lines.map(l => {
      const item = items.find(i => i.id === l.item_id);
      if (!item) throw new BadRequestException('Item not found');
      return { ...l, godown_id: godown.id, unit_id: l.unit_id || item.primary_unit_id, discount_amount: l.discount_amount || 0 };
    });
  }

  private async resolveCandidates(companyId:string,branchId:string,userId:string,dto:RetailBillDto,preview=false) {
    const result:any[]=[],resolved=new Map<string,{fingerprint:string;item:any}>();
    for(const line of dto.items){
      if(!!line.item_id===!!line.new_item)throw new BadRequestException('Each line needs one existing item or one new item candidate');
      if(!line.new_item){result.push(line);continue;}
      const candidate=line.new_item, preset=RETAIL_UNITS.find(u=>u.code===candidate.unit_code),mode=preset?.selling_mode||candidate.selling_mode;
      if(!['PIECE','WEIGHT','LENGTH'].includes(mode)||mode!==candidate.selling_mode)throw new BadRequestException('Choose a compatible selling unit');
      if(!candidate.name.trim()||mode==='PIECE'&&!Number.isInteger(line.quantity))throw new BadRequestException('Enter an item name and valid quantity');
      if(line.unit_id||line.variant_id||line.batch_id||line.serial_ids?.length||line.modifier_option_ids?.length||line.dimensions)throw new BadRequestException('New bill items cannot contain configured item options');
      const company=await this.prisma.company.findUniqueOrThrow({where:{id:companyId},select:{organization_id:true}});
      if(mode!=='PIECE'){
        const access=await this.entitlements.resolve(company.organization_id,this.prisma,companyId);
        if(!access.features.some(f=>f.code===mode&&f.enabled))throw new ForbiddenException('Your plan does not enable '+mode.toLowerCase()+' selling');
      }
      const fingerprint=JSON.stringify([candidate.name.trim(),candidate.unit_code,mode,line.rate]),previous=resolved.get(candidate.client_id);
      if(previous&&previous.fingerprint!==fingerprint)throw new BadRequestException('A draft item has conflicting details');
      let item=previous?.item;
      if(!item){
        const sku='QBI-'+candidate.client_id;
        const saved=await this.prisma.item.findFirst({where:{company_id:companyId,sku},include:{primary_unit:true}});
        if(saved){
          if(!preview||saved.name!==candidate.name.trim()||saved.primary_unit.code!==candidate.unit_code||Number(saved.default_sale_rate)!==line.rate||saved.has_variants||saved.track_batch||saved.track_serial||saved.is_bundle)throw new BadRequestException('This draft item was already saved. Search for it or retry the original bill.');
          item=saved; // A response-lost payment can quote again, then replay its original idempotent bill request.
        } else item=await this.catalog.createItem(companyId,userId,'',branchId,{name:candidate.name.trim(),sku,selling_price:line.rate,unit_code:candidate.unit_code,unit_name:candidate.unit_name,selling_mode:mode,inventory_tracking:false});
        resolved.set(candidate.client_id,{fingerprint,item});
      }
      const {new_item,...rest}=line;result.push({...rest,item_id:item.id,unit_id:item.primary_unit_id});
    }
    return result;
  }

  async createBill(companyId: string, branchId: string, userId: string, dto: RetailBillDto) {
    return this.prisma.runAtomic(async()=>{
    const items=await this.resolveCandidates(companyId,branchId,userId,dto);
    const lines = await this.mapLines(companyId, branchId, items);
    return this.posService.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: dto.date || businessDate(), party_id: dto.customer_id,
      due_date: dto.due_date, note: dto.note, sales_channel: dto.sales_channel, bill_discount:dto.bill_discount, lines,
      payments: dto.payment_splits.map(p => ({ amount: p.amount, payment_method: p.method as any })),
    });
    });
  }

  async quoteBill(companyId: string, branchId: string, dto: RetailBillDto, userId?: string) {
    if(dto.items.some(l=>l.new_item)){
      // Use canonical pricing, then roll back temporary catalog rows and audits.
      // No quote, typing, cancellation or abandoned payment can persist an item.
      try { await this.prisma.runAtomic(async()=>{
        const items=await this.resolveCandidates(companyId,branchId,userId!,dto,true);
        const lines=await this.mapLines(companyId,branchId,items);
        const quote=await this.posService.quoteSale(companyId,{branch_id:branchId,document_date:dto.date||businessDate(),party_id:dto.customer_id,bill_discount:dto.bill_discount,lines,payments:[]});
        throw new PreviewRollback({...quote,lines:quote.lines.map((l:any,index:number)=>({...l,draft_client_id:dto.items[index]?.new_item?.client_id}))});
      }); }catch(e){if(e instanceof PreviewRollback)return e.quote;throw e;}
    }
    if(dto.items.some(l=>!l.item_id))throw new BadRequestException('Select an item');
    const lines = await this.mapLines(companyId, branchId, dto.items);
    return this.posService.quoteSale(companyId, { branch_id: branchId, document_date: dto.date || new Date().toISOString(), party_id: dto.customer_id, bill_discount:dto.bill_discount, lines, payments: [] });
  }

  async createAmountSale(companyId: string, branchId: string, userId: string, dto: RetailAmountSaleDto) {
    if (dto.payment_method === 'UDHAR' && !dto.customer_id) throw new BadRequestException('Select a customer for Udhar');
    // A hidden service line lets amount-only sales use the canonical POS/accounting path.
    const item = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId}::uuid FOR UPDATE`;
      let service = await tx.item.findFirst({ where: { company_id: companyId, is_system: true, sku: 'RETAIL-QUICK-SALE' } });
      if (!service) {
        const unit = await tx.unit.findFirst({ where: { company_id: companyId } });
        if (!unit) throw new BadRequestException('No unit configured');
        service = await tx.item.create({ data: { company_id: companyId, sku: 'RETAIL-QUICK-SALE', name: 'Quick Sale',
          item_type: 'SERVICE', selling_mode: 'PIECE', primary_unit_id: unit.id, is_system: true, default_sale_rate: 1 } });
      }
      return service;
    });
    return this.createBill(companyId, branchId, userId, { items: [{ item_id: item.id, quantity: 1, rate: dto.amount }],
      customer_id: dto.customer_id, payment_splits: dto.payment_method === 'UDHAR' ? [] : [{ method: dto.payment_method, amount: dto.amount }],
      date: dto.date, due_date: dto.due_date, note: dto.note, sales_channel: dto.sales_channel || 'QUICK' });
  }

  async getBills(companyId: string, branchId: string, query: any) {
    const take = Math.min(200, Math.max(1, Number(query.limit) || 50));
    const skip = Math.max(0, Number(query.offset) || 0);
    const where: any = { company_id: companyId, branch_id: branchId, status: 'POSTED' };
    if (query.search) where.OR = [{ document_number: { contains: String(query.search), mode: 'insensitive' } }, { party: { name: { contains: String(query.search), mode: 'insensitive' } } }];
    if (query.from || query.to) {
      where.document_date = { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) };
      if ([where.document_date.gte, where.document_date.lte].filter(Boolean).some((d: Date) => !Number.isFinite(d.getTime()))) throw new BadRequestException('Invalid date filter');
    }
    
    const invoices = await this.prisma.salesInvoice.findMany({
      where,
      orderBy: [{ document_date: 'desc' }, { created_at: 'desc' }],
      take,
      skip,
      include: {
        party: true,
      }
    });

    const total = await this.prisma.salesInvoice.count({
      where,
    });

    return {
      data: invoices,
      total
    };
  }

  async getBillDetail(id: string, companyId: string) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id, company_id: companyId },
      include: {
        party: true,
        lines: {
          include: {
            entered_unit: { select: { code: true } },
            unit: { select: { code: true } },
            variant: { select: { sku: true, attributes: true } },
            serial_allocations: { select: { serial_id: true, returned_at: true, warranty_snapshot: true, serial: { select: { serial_number: true } } } },
            item: {
              select: { id: true, name: true, sku: true }
            }
          }
        }
      }
    });

    if (!invoice || invoice.company_id !== companyId) {
      throw new BadRequestException('Invoice not found');
    }

    const receipts = await this.prisma.voucher.findMany({ where: {
      company_id: companyId, source_document_type: 'POS_RECEIPT', source_document_id: invoice.id, status: 'POSTED',
    }, include: { lines: { include: { ledger_account: true } } } });
    const payments = receipts.flatMap(v => v.lines.filter(l => Number(l.debit) > 0).map(l => ({
      method: l.ledger_account.code === 'CASH_IN_HAND' ? 'Cash' : 'UPI / Bank', amount: Number(l.debit),
    })));
    const { rows: returnHistory, total: returnValue } = await readReturnHistory(this.prisma, companyId, { original_invoice_id: invoice.id, branch_id: invoice.branch_id });
    const returns = returnHistory.flatMap(r => r.lines);
    const detailLines = invoice.lines.map(line => {
      const dims: any = line.dimensions;
      const scale = Number(line.conversion_factor || 1) * (dims ? Number(dims.length || 1) * Number(dims.width || 1) * Number(dims.height || 1) : 1);
      const sold = Number(line.base_quantity || line.quantity) / scale;
      const restored = returns.filter(r => r.original_line_id === line.id || !r.original_line_id && r.item_id === line.item_id && r.variant_id === line.variant_id)
        .reduce((sum,r)=>sum+Number(r.base_quantity??r.quantity),0) / scale;
      return { ...line, sold_entered_quantity: sold, returned_quantity: restored, remaining_quantity: Math.max(0,sold-restored) };
    });
    const refunded = returnHistory.reduce((sum,r)=>sum.plus(r.cash_refunded),new Prisma.Decimal(0));
    const netTotal = Prisma.Decimal.max(0,invoice.grand_total.minus(returnValue));
    const netReceived = invoice.paid_amount.minus(refunded);
    return { ...invoice, sales_invoice_line: detailLines, payments: Array.isArray(invoice.payment_snapshot) && invoice.payment_snapshot.length ? invoice.payment_snapshot : payments,
      returns: returnHistory, return_status: !returnHistory.length ? 'NONE' : detailLines.every(l=>l.remaining_quantity<=0) ? 'FULL' : 'PARTIAL',
      settlement: { original_total:Number(invoice.grand_total), return_value:returnValue.toNumber(), net_total:netTotal.toNumber(),
        received_total:Number(invoice.paid_amount), cash_refunded:refunded.toNumber(), net_received:netReceived.toNumber(),
        due:Number(invoice.outstanding_amount), customer_credit:Prisma.Decimal.max(0,netReceived.minus(netTotal)).toNumber() },
    };
  }

  async holdBill(companyId: string, branchId: string, userId: string, items: any[], extra?: any) {
    if(items.some(l=>l.new_item||!l.item_id))throw new BadRequestException('Keep new items in the device draft until bill confirmation');
    const lines = await this.mapLines(companyId, branchId, items);
    if (extra?.customer_id && !await this.prisma.party.findFirst({ where: { id: extra.customer_id, company_id: companyId, party_type: 'CUSTOMER' } })) throw new BadRequestException('Customer not found');
    return this.posService.holdBill(companyId, userId, { branch_id: branchId, lines, ...extra });
  }

  async getHeldBills(companyId: string, branchId: string, userId: string) {
    return this.posService.getHeldBills(companyId, branchId, userId);
  }

  async resumeBill(id: string, companyId: string, userId: string) {
    return this.posService.resumeBill(id, companyId, userId);
  }

  async postReturn(companyId: string, branchId: string, userId: string, dto: any) {
    const original = await this.prisma.salesInvoice.findFirst({ where: { id: dto.original_invoice_id, company_id: companyId, branch_id: branchId } });
    if (!original) throw new BadRequestException('Original invoice not found');
    const lines = await this.mapLines(companyId, branchId, dto.lines);
    return this.posService.postPosReturn(companyId, userId, { branch_id: branchId, document_date: businessDate(),
      party_id: original.party_id, original_invoice_id: original.id, refund_method: dto.refund_method, lines });
  }
}
