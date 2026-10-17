import { paymentRecipient } from './counter/upi-profiles';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRetailItemDto, UpdateRetailItemDto } from './dto/retail-item.dto';
import { CreateRetailCustomerDto, ReceivePaymentDto } from './dto/retail-customer.dto';
import { CreateRetailSupplierDto, PaySupplierDto } from './dto/retail-supplier.dto';
import { CreateRetailPurchaseDto } from './dto/retail-purchase.dto';
import { CreateNeedListDto, UpdateNeedStatusDto } from './dto/retail-need.dto';
import { AccountingService } from '../accounting/accounting.service';
import { PostingService as AccountingPostingService } from '../accounting/posting.service';
import { OpeningStockService } from '../inventory/opening-stock.service';
import { InventoryPostingService } from '../inventory/posting.service';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { PurchaseService } from '../purchase/purchase.service';
import { page } from '../common/pagination';
import { BASE_UNIT_USAGE, RETAIL_UNITS } from './retail-units';

@Injectable()
export class RetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
    private readonly accountingPostingService: AccountingPostingService,
    private readonly openingStockService: OpeningStockService,
    private readonly inventoryPostingService: InventoryPostingService,
    private readonly purchaseService: PurchaseService,
  ) {}

  // ── ITEMS ──────────────────────────────────────────────────────────

  async getItems(companyId: string, search?: string, query:any={}) {
    const where: any = { company_id: companyId, is_system: false, ...(query.include_inactive==='true'?{}:{is_active:true}) };
    const paging = page(query);
    const stockStatus = query.stock_status;
    if (stockStatus && !['all', 'low', 'out'].includes(stockStatus)) throw new BadRequestException('Unknown stock status');

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcodes: { some: { company_id:companyId, is_active: true, barcode: { contains: search, mode: 'insensitive' } } } },
          { variants: { some: { is_active: true, OR: [{ sku: { contains: search, mode: 'insensitive' } }, { barcode: { contains: search, mode: 'insensitive' } }] } } },
      ];
    }

    // Filter the authoritative projection before pagination; zero-stock items may
    // have no projection row at all. Parameters remain bound by Prisma.
    if (stockStatus === 'low' || stockStatus === 'out') {
      const pattern = '%' + (search || '').replace(/[\\%_]/g, '\\$&') + '%';
      const condition = stockStatus === 'out' ? Prisma.sql`COALESCE(s.quantity, 0) <= 0` : Prisma.sql`COALESCE(s.quantity, 0) <= i.low_stock_threshold`;
      const ids = await this.prisma.$queryRaw<{id:string}[]>(Prisma.sql`
        SELECT i.id FROM items i
        LEFT JOIN (SELECT item_id, SUM(quantity) AS quantity FROM stock_balance_projection
          WHERE company_id = ${companyId}::uuid GROUP BY item_id) s ON s.item_id = i.id
        WHERE i.company_id = ${companyId}::uuid AND i.is_system = false
          AND (${query.include_inactive==='true'} OR i.is_active = true)
          AND i.inventory_tracking = true AND i.item_type <> 'SERVICE' AND i.is_bundle = false
          AND ${condition}
          AND (${!search} OR i.name ILIKE ${pattern} OR i.sku ILIKE ${pattern}
            OR EXISTS (SELECT 1 FROM item_barcodes b WHERE b.item_id=i.id AND b.company_id=${companyId}::uuid AND b.is_active=true AND b.barcode ILIKE ${pattern})
            OR EXISTS (SELECT 1 FROM item_variants v WHERE v.item_id=i.id AND v.is_active=true AND (v.sku ILIKE ${pattern} OR v.barcode ILIKE ${pattern})))
        ORDER BY i.name ASC, i.id ASC LIMIT ${paging.take} OFFSET ${paging.skip}`);
      where.id = { in: ids.map(i=>i.id) };
    }

    const items = await this.prisma.item.findMany({
      where,
      ...(stockStatus === 'low' || stockStatus === 'out' ? {} : paging),
      orderBy: [{name:'asc'},{id:'asc'}],
      include: {
        primary_unit: true,
        tax_class: true,
        barcodes: { where: { is_primary: true, is_active: true } },
        _count: { select: { modifier_groups: true, unit_conversions: true } },
        stock_balance_projection: {
          where: { company_id: companyId }
        }
      }
    });

    const photos = await this.itemPhotos(companyId, items.map(item => item.id));
    return items.map(item => ({ ...this.itemSummary(item), image: photos.get(item.id) || null }));
  }

  private async itemPhotos(companyId: string, itemIds: string[]) {
    if (!itemIds.length) return new Map<string, { id: string }>();
    const photos = await this.prisma.attachment.findMany({
      where: { company_id: companyId, entity_type: 'ITEM', category: 'ITEM_IMAGE', entity_id: { in: itemIds } },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      distinct: ['entity_id'],
      select: { id: true, entity_id: true },
    });
    return new Map(photos.map(photo => [photo.entity_id, { id: photo.id }]));
  }

  async getItemCategories(companyId:string,search?:string,query:any={}) {
    const {take,skip}=page(query);
    const rows=await this.prisma.item.groupBy({by:['category'],where:{company_id:companyId,is_system:false,
      category:{not:null,...(search?{contains:search,mode:'insensitive' as const}:{})}},orderBy:{category:'asc'},take,skip});
    return rows.map(r=>r.category).filter(Boolean);
  }

  private itemSummary(item: any) {
      const stock = item.stock_balance_projection.reduce((sum: number, b: any) => sum + Number(b.quantity), 0);
      return {
        id: item.id,
        name: item.name,
        sku: item.sku,
        barcode: item.barcodes[0]?.barcode,
        selling_price: item.default_sale_rate ? Number(item.default_sale_rate) : 0,
        purchase_price: item.purchase_rate ? Number(item.purchase_rate) : 0,
        unit: item.primary_unit.code,
        current_stock: stock,
        active: item.is_active,
        selling_mode: item.selling_mode,
        has_variants: item.has_variants,
        track_batch: item.track_batch,
        track_serial: item.track_serial,
        is_bundle: item.is_bundle,
        has_modifiers: item._count.modifier_groups > 0,
        has_unit_conversions: item._count.unit_conversions > 0,
        warranty_days: item.warranty_days,
        item_type: item.item_type, inventory_tracking: item.inventory_tracking,
        primary_unit_id: item.primary_unit_id,
        tax_rate: Number(item.tax_class?.tax_rate || 0),
        mrp: Number(item.mrp),
        category: item.category,
        hsn_sac: item.hsn_sac,
        low_stock_threshold: Number(item.low_stock_threshold),
        custom_attributes: item.custom_attributes,
        compatibility_tags: item.compatibility_tags,
      };
  }

  async getItemUnits(companyId:string,itemId:string){
    const item=await this.prisma.item.findFirst({where:{id:itemId,company_id:companyId,is_system:false},select:{primary_unit_id:true,primary_unit:true,unit_conversions:{include:{from_unit:true}}}});
    if(!item)throw new NotFoundException('Item not found');return {...item, primary_unit:this.namedUnit(item.primary_unit), unit_conversions:item.unit_conversions.map(conversion=>({...conversion,from_unit:this.namedUnit(conversion.from_unit)}))};
  }
  private namedUnit<T extends {code: string; name: string}>(unit: T): T {
    const preset = RETAIL_UNITS.find(preset => preset.code === unit.code.toUpperCase());
    return { ...unit, name: unit.name === unit.code && preset ? preset.name : unit.name };
  }
  async getUnits(companyId: string) {
    const existing = await this.prisma.unit.findMany({ where: { company_id: companyId }, orderBy: { name: 'asc' }, take: 500 });
    const presets = RETAIL_UNITS.map(preset => {const found=existing.find(unit => unit.code.toUpperCase() === preset.code);return { ...preset, ...(found ? this.namedUnit(found) : {}) };});
    return [...presets, ...existing.filter(unit => !RETAIL_UNITS.some(preset => preset.code === unit.code.toUpperCase()))];
  }
  async getItemOptions(companyId: string, branchId: string, itemId: string) {
    const item = await this.prisma.item.findFirst({ where: { id: itemId, company_id: companyId, is_system: false },
      include: { _count: { select: BASE_UNIT_USAGE }, primary_unit: true, tax_class: true, barcodes:{where:{is_active:true,is_primary:true}}, variants: { where: { is_active: true } }, modifier_groups: { include: { options: true } },
        bundle_components: { include: { component_item: { select: { name: true } } } },
        unit_conversions: { include: { from_unit: true } }, batches: { where: { company_id: companyId } },
        serials: { where: { company_id: companyId, godown_id: { in: (await this.prisma.godown.findMany({ where: { branch_id: branchId, branch: { company_id: companyId } }, select: { id: true } })).map(g => g.id) } } },
        stock_balance_projection: { where: { company_id: companyId, branch_id: branchId } } } });
    if (!item) throw new NotFoundException('Item not found');
    const photos = await this.itemPhotos(companyId, [itemId]);
    return { ...item, image: photos.get(itemId) || null, primary_unit: this.namedUnit(item.primary_unit), unit_conversions:item.unit_conversions.map(conversion=>({...conversion,from_unit:this.namedUnit(conversion.from_unit)})), base_unit_editable: Object.values(item._count).every(count => count === 0), tax_rate: Number(item.tax_class?.tax_rate || 0) };
  }

  async lookupWarranty(companyId: string, search: string) {
    if (!search?.trim()) return [];
    return this.prisma.itemSerial.findMany({ where: { company_id: companyId, OR: [
      { serial_number: { contains: search.trim(), mode: 'insensitive' } },
      { sold_to: { name: { contains: search.trim(), mode: 'insensitive' } } },
      { sales_invoice: { document_number: { contains: search.trim(), mode: 'insensitive' } } },
    ] }, take: 50, include: { item: { select: { name: true } }, allocations: { where: { company_id: companyId },
      include: { sales_invoice_line: { include: { sales_invoice: { select: { id: true, document_number: true, document_date: true,
        party: { select: { id: true, name: true, phone: true } } } } } } } } } });
  }


  private async itemReferences(tx: Prisma.TransactionClient, companyId: string, dto: Partial<CreateRetailItemDto>) {
    if (dto.unit_id && !await tx.unit.findFirst({ where: { id: dto.unit_id, company_id: companyId } })) throw new BadRequestException('Unit not found');
    if (dto.tax_class_id && !await tx.taxClass.findFirst({ where: { id: dto.tax_class_id, company_id: companyId } })) throw new BadRequestException('Tax class not found');
    if (dto.preferred_supplier_id && !await tx.party.findFirst({ where: { id: dto.preferred_supplier_id, company_id: companyId, party_type: 'SUPPLIER' } })) throw new BadRequestException('Supplier not found');
  }

  private async resolveUnit(tx: Prisma.TransactionClient, companyId: string, dto: Partial<CreateRetailItemDto>) {
    if (dto.unit_id) return tx.unit.findFirstOrThrow({ where: { id: dto.unit_id, company_id: companyId } });
    const code = (dto.unit_code || 'PCS').trim().toUpperCase();
    if (!code || code.length > 20) throw new BadRequestException('Use a unit code of 1–20 characters');
    const existing = await tx.unit.findFirst({ where: { company_id: companyId, code: { equals: code, mode: 'insensitive' } } });
    if (existing) return existing;
    const preset = RETAIL_UNITS.find(unit => unit.code === code);
    return tx.unit.create({ data: { company_id: companyId, code, name: dto.unit_name?.trim() || preset?.name || code,
      decimal_places: preset?.decimal_places || 0 } });
  }

  private validateUnitMode(code: string, mode: string) {
    const preset = RETAIL_UNITS.find(unit => unit.code === code.toUpperCase());
    if (preset && ['WEIGHT', 'LENGTH', 'AREA', 'VOLUME'].includes(mode) && preset.selling_mode !== mode) {
      throw new BadRequestException(`Choose a ${mode.toLowerCase()} unit for this selling mode; ${preset.name} is not compatible`);
    }
  }

  async createItem(companyId: string, userId: string, financialYearId: string, branchId: string, dto: CreateRetailItemDto,
    suppliedTx?: Prisma.TransactionClient, openingDate?: Date) {
    const create = async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId}::uuid FOR UPDATE`;
      await this.itemReferences(tx, companyId, dto);
      const sku = dto.sku?.trim() || 'ITM-' + uuidv4().slice(0, 12);
      if (!dto.name.trim()) throw new BadRequestException('Item name is required');
      if (await tx.item.findFirst({ where: { company_id: companyId, sku: { equals: sku, mode: 'insensitive' } } }) || await tx.itemVariant.findFirst({where:{item:{company_id:companyId},sku:{equals:sku,mode:'insensitive'}}})) throw new BadRequestException('SKU already exists in this business');
      const unit = await this.resolveUnit(tx, companyId, dto);
      let taxId = dto.tax_class_id;
      if (dto.gst_rate !== undefined) {
        const hsn = dto.hsn_sac || '';
        let tax = await tx.taxClass.findFirst({ where: { company_id: companyId, tax_rate: dto.gst_rate, hsn_code: hsn } });
        if (!tax) tax = await tx.taxClass.create({ data: { company_id: companyId, name: 'GST ' + dto.gst_rate + '%', hsn_code: hsn,
          tax_rate: dto.gst_rate, cgst_rate: dto.gst_rate / 2, sgst_rate: dto.gst_rate / 2, igst_rate: dto.gst_rate } });
        taxId = tax.id;
      }
      const service = dto.selling_mode === 'SERVICE';
      this.validateUnitMode(unit.code, dto.selling_mode || 'PIECE');
      if (dto.inventory_tracking === false && (dto.opening_stock || dto.has_variants || dto.track_batch || dto.track_serial || dto.is_bundle || service)) throw new BadRequestException('Price-only items cannot have opening stock, services or advanced tracking');
      if ((dto.opening_stock || 0) > 0 && (service || dto.track_batch || dto.track_serial || dto.has_variants || dto.is_bundle)) throw new BadRequestException('Receive tracked stock through Buy Stock with its variant, batch or serial details');
      const item = await tx.item.create({ data: { company_id: companyId, sku, name: dto.name.trim(), primary_unit_id: unit.id,
        inventory_tracking: dto.inventory_tracking ?? true, item_type: service ? 'SERVICE' : dto.is_bundle ? 'BUNDLE' : 'STOCK_ITEM', selling_mode: service ? 'PIECE' : dto.selling_mode || 'PIECE',
        default_sale_rate: dto.selling_price, purchase_rate: dto.purchase_price || 0, mrp: dto.mrp || 0,
        tax_class_id: taxId, category: dto.category, hsn_sac: dto.hsn_sac, low_stock_threshold: dto.low_stock_threshold || 0,
        preferred_supplier_id: dto.preferred_supplier_id, has_variants: dto.has_variants || false, track_batch: dto.track_batch || false,
        track_serial: dto.track_serial || false, is_bundle: dto.is_bundle || false, warranty_days: dto.warranty_days,
        compatibility_tags: dto.compatibility_tags, custom_attributes: dto.custom_attributes } });
      if (dto.barcode) {
        if (await tx.itemBarcode.findFirst({ where: { company_id: companyId, barcode: dto.barcode } })) throw new BadRequestException('Barcode already exists');
        await tx.itemBarcode.create({ data: { company_id: companyId, item_id: item.id, barcode: dto.barcode, is_primary: true } });
      }
      if ((dto.opening_stock || 0) > 0) {
        const date = openingDate || new Date();
        const fy = await tx.financialYear.findFirst({ where: { id: financialYearId, company_id: companyId, is_closed: false, start_date: { lte: date }, end_date: { gte: new Date(date.toISOString().slice(0,10)) } } });
        const godown = await tx.godown.findFirst({ where: { branch_id: branchId, is_active: true, branch: { company_id: companyId } }, orderBy: [{created_at: 'asc'}, {id: 'asc'}] });
        if (!fy || !godown) throw new BadRequestException('Opening stock needs an open current financial year and stock location');
        await this.openingStockService.postOpeningStock({ company_id: companyId, branch_id: branchId, financial_year_id: fy.id,
          document_number: 'OS-RETAIL-' + uuidv4(), document_date: date, narration: 'Retail opening stock',
          lines: [{ item_id: item.id, godown_id: godown.id, unit_id: unit.id, quantity: dto.opening_stock!, cost_rate: dto.skip_opening_cost ? null : dto.opening_cost ?? dto.purchase_price ?? null }] }, userId, tx);
      }
      await tx.auditLog.create({data:{company_id:companyId,branch_id:branchId,user_id:userId,action:'RETAIL_ITEM_CREATED',source_document_type:'Item',source_document_id:item.id}});
      return item.id;
    };
    const itemId = suppliedTx ? await create(suppliedTx) : await this.prisma.$transaction(create, { timeout: 15000 });
    return this.itemSummary(await (suppliedTx || this.prisma).item.findFirstOrThrow({where:{id:itemId,company_id:companyId},include:{primary_unit:true,tax_class:true,barcodes:{where:{is_primary:true,is_active:true}},_count:{select:{modifier_groups:true,unit_conversions:true}},stock_balance_projection:{where:{company_id:companyId}}}}));
  }

  async updateItem(companyId: string, itemId: string, dto: Partial<UpdateRetailItemDto>, userId?:string) {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM items WHERE id = ${itemId}::uuid AND company_id = ${companyId}::uuid FOR UPDATE`;
      const item = await tx.item.findFirst({ where: { id: itemId, company_id: companyId, is_system: false }, include: { _count: { select: BASE_UNIT_USAGE } } });
      if (!item) throw new NotFoundException('Item not found');
      for(const [key,value] of Object.entries(dto))if(value===null&&!['category','hsn_sac','preferred_supplier_id','tax_class_id'].includes(key))throw new BadRequestException(key+' cannot be null');
      if(dto.name!==undefined){if(!dto.name.trim())throw new BadRequestException('Item name is required');dto={...dto,name:dto.name.trim()};}
      if(dto.active===false&&await tx.itemBundleComponent.count({where:{component_item_id:itemId,bundle_item:{company_id:companyId,is_active:true}}}))throw new BadRequestException('This item is used by an active bundle. Update or remove that bundle first.');
      await this.itemReferences(tx, companyId, dto);
      if(dto.sku!==undefined){
        const sku=dto.sku.trim();
        if(!sku)throw new BadRequestException('SKU cannot be empty');
        if(await tx.item.findFirst({where:{company_id:companyId,id:{not:itemId},sku:{equals:sku,mode:'insensitive'}}}) || await tx.itemVariant.findFirst({where:{item:{company_id:companyId},sku:{equals:sku,mode:'insensitive'}}}))throw new BadRequestException('SKU already exists in this business');
        dto={...dto,sku};
      }
      if (dto.inventory_tracking !== undefined && dto.inventory_tracking !== item.inventory_tracking) throw new BadRequestException('Receive an actual purchase to start counting stock; tracking cannot be switched off');
      if (dto.opening_stock !== undefined) throw new BadRequestException('Use Buy Stock or a stock adjustment to change inventory');
      if(item.inventory_tracking===false&&(dto.has_variants||dto.track_batch||dto.track_serial||dto.is_bundle||dto.selling_mode==='SERVICE'))throw new BadRequestException('Receive real stock before enabling advanced tracking');
      if (dto.unit_code !== undefined) dto = { ...dto, unit_id: (await this.resolveUnit(tx, companyId, dto)).id };
      if ((dto.unit_id !== undefined && dto.unit_id !== item.primary_unit_id || dto.selling_mode !== undefined && dto.selling_mode !== item.selling_mode)
        && Object.values(item._count).some(count => count > 0)) throw new BadRequestException('This item already has saved documents or unit configuration. Keep its base unit and selling mode; add a pack conversion or a new item instead.');
      if (dto.unit_id !== undefined || dto.selling_mode !== undefined) {
        const selectedUnit = await tx.unit.findFirstOrThrow({ where: { id: dto.unit_id || item.primary_unit_id, company_id: companyId } });
        this.validateUnitMode(selectedUnit.code, dto.selling_mode || item.selling_mode);
      }
      const stockFields = ['unit_id','selling_mode','has_variants','track_batch','track_serial','is_bundle'];
      if (stockFields.some(key=>(dto as any)[key]!==undefined && (dto as any)[key] !== (item as any)[key==='unit_id'?'primary_unit_id':key])
        && await tx.stockMovement.count({ where: { company_id: companyId, item_id: item.id } })) throw new BadRequestException('Stock structure cannot change after inventory history exists');
      const data: any = {};
      if(dto.gst_rate!==undefined){
        const hsn=dto.hsn_sac??item.hsn_sac??'';
        let tax=await tx.taxClass.findFirst({where:{company_id:companyId,tax_rate:dto.gst_rate,hsn_code:hsn}});
        if(!tax)tax=await tx.taxClass.create({data:{company_id:companyId,name:'GST '+dto.gst_rate+'%',hsn_code:hsn,tax_rate:dto.gst_rate,cgst_rate:dto.gst_rate/2,sgst_rate:dto.gst_rate/2,igst_rate:dto.gst_rate}});
        data.tax_class_id=tax.id;
      }
      if(dto.barcode!==undefined){
        const barcode=dto.barcode.trim();
        const existing=barcode?await tx.itemBarcode.findFirst({where:{company_id:companyId,barcode}}):null;
        if(existing&&existing.item_id!==itemId||barcode&&await tx.itemVariant.findFirst({where:{item:{company_id:companyId},barcode}}))throw new BadRequestException('Barcode already exists');
        await tx.itemBarcode.updateMany({where:{company_id:companyId,item_id:itemId,is_primary:true},data:{is_active:false,is_primary:false}});
        if(barcode){if(existing)await tx.itemBarcode.update({where:{id:existing.id},data:{is_active:true,is_primary:true}});else await tx.itemBarcode.create({data:{company_id:companyId,item_id:itemId,barcode,is_primary:true}});}
      }
      const fields: Record<string,string> = { name:'name', sku:'sku', selling_price:'default_sale_rate', purchase_price:'purchase_rate', mrp:'mrp',
        category:'category',hsn_sac:'hsn_sac',low_stock_threshold:'low_stock_threshold',preferred_supplier_id:'preferred_supplier_id',unit_id:'primary_unit_id',
        tax_class_id:'tax_class_id',selling_mode:'selling_mode',has_variants:'has_variants',track_batch:'track_batch',track_serial:'track_serial',
        is_bundle:'is_bundle',warranty_days:'warranty_days',compatibility_tags:'compatibility_tags',custom_attributes:'custom_attributes',active:'is_active' };
      for (const [source,target] of Object.entries(fields)) if ((dto as any)[source] !== undefined) data[target]=(dto as any)[source];
      if (data.selling_mode === 'SERVICE') { data.item_type='SERVICE';data.selling_mode='PIECE'; }
      if (dto.is_bundle) data.item_type='BUNDLE';
      const updated=await tx.item.update({ where: { id: item.id }, data });
      if(userId)await tx.auditLog.create({data:{company_id:companyId,user_id:userId,action:dto.active===false?'RETAIL_ITEM_REMOVED':dto.active===true?'RETAIL_ITEM_RESTORED':'RETAIL_ITEM_UPDATED',details:JSON.stringify({item_id:itemId,fields:Object.keys(dto)})}});
      return updated;
    });
  }

  private async getParties(companyId: string, type: 'CUSTOMER' | 'SUPPLIER', search?: string,query:any={}) {
    const parties = await this.prisma.party.findMany({ where: { company_id: companyId, party_type: type, ...(type==='CUSTOMER'?{is_walkin:false}:{}), ...(search ? {
      OR: ['name', 'code', 'phone', 'nickname'].map(field => ({ [field]: { contains: search, mode: 'insensitive' } })),
    } : {}) }, orderBy: [{ name: 'asc' },{id:'asc'}],...page(query) });
    const allocations = await this.prisma.billAllocation.groupBy({ by: ['party_id', 'allocation_type'],
      where: { company_id: companyId, party_id: { in: parties.map(p => p.id) } }, _sum: { amount: true } });
    return parties.map(p => ({ ...p, mobile: p.phone, active: p.is_active, outstanding_amount: allocations.filter(a => a.party_id === p.id)
      .reduce((sum, a) => sum + Number(a._sum.amount || 0) * (a.allocation_type === 'NEW_REFERENCE' ? 1 : -1), 0) }));
  }

  getCustomers(companyId: string, search?: string,query:any={}) { return this.getParties(companyId, 'CUSTOMER', search,query); }
  getSuppliers(companyId: string, search?: string,query:any={}) { return this.getParties(companyId, 'SUPPLIER', search,query); }

  async updateParty(companyId:string,id:string,type:'CUSTOMER'|'SUPPLIER',dto:any,userId:string){
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM companies WHERE id=${companyId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM parties WHERE id=${id}::uuid AND company_id=${companyId}::uuid FOR UPDATE`;
      const party=await tx.party.findFirst({where:{id,company_id:companyId,party_type:type}});
      if(!party)throw new NotFoundException('Account not found');
      if(dto.opening_balance!==undefined)throw new BadRequestException('Opening dues cannot be edited. Record a payment or an audited adjustment.');
      for(const key of ['name','code','active','credit_allowed','credit_days','supplier_category','visit_cycle'])if(dto[key]===null)throw new BadRequestException(key+' cannot be null');
      if(dto.name!==undefined&&!dto.name.trim())throw new BadRequestException('Name is required');
      if(dto.code!==undefined&&(!dto.code.trim()||await tx.party.findFirst({where:{company_id:companyId,id:{not:id},code:dto.code.trim()}})))throw new BadRequestException('Party code is empty or already used');
      if(dto.price_list_id&& !await tx.priceList.findFirst({where:{id:dto.price_list_id,company_id:companyId}}))throw new BadRequestException('Price list not found');
      if(dto.active===false){
        const allocations=await tx.billAllocation.groupBy({by:['allocation_type'],where:{company_id:companyId,party_id:id},_sum:{amount:true}});
        const due=allocations.reduce((sum,row)=>sum.plus(new Prisma.Decimal(row._sum.amount||0).mul(row.allocation_type==='NEW_REFERENCE'?1:-1)),new Prisma.Decimal(0));
        if(!due.isZero())throw new BadRequestException('Settle this account balance before removing it. Its history will be kept.');
      }
      const data:any={};
      for(const key of ['name','code','email','gstin','pan','address','state','credit_allowed','credit_days','credit_limit','price_list_id',...(type==='SUPPLIER'?['nickname','supplier_category','max_credit_bills','visit_cycle']:[])])if(dto[key]!==undefined)data[key]=typeof dto[key]==='string'?dto[key].trim():dto[key];
      if(dto.mobile!==undefined)data.phone=dto.mobile==null?null:dto.mobile.trim();
      if(dto.active!==undefined)data.is_active=dto.active;
      if(type==='SUPPLIER'&&dto.visit_date!==undefined)data.visit_date=dto.visit_date?new Date(dto.visit_date):null;
      const updated=await tx.party.update({where:{id},data});
      if(data.name)await tx.ledgerAccount.updateMany({where:{company_id:companyId,party_id:id},data:{name:data.name}});
      await tx.auditLog.create({data:{company_id:companyId,user_id:userId,action:'RETAIL_'+type+(dto.active===false?'_REMOVED':dto.active===true?'_RESTORED':'_UPDATED'),details:JSON.stringify({party_id:id,fields:Object.keys(dto)})}});
      return {...updated,mobile:updated.phone,active:updated.is_active};
    });
  }

  private async createParty(companyId: string, type: 'CUSTOMER' | 'SUPPLIER', dto: CreateRetailCustomerDto & Partial<CreateRetailSupplierDto>,
    context?: { branchId: string; financialYearId: string; userId: string; openingDate?: Date }, suppliedTx?: Prisma.TransactionClient) {
    if (!dto.name.trim()) throw new BadRequestException('Name is required');
    const create = async (tx: Prisma.TransactionClient) => {
      // Serialize code checks and parent creation across concurrent requests.
      await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId}::uuid FOR UPDATE`;
      const code = dto.code?.trim() || (type === 'CUSTOMER' ? 'RC-' : 'RS-') + uuidv4().slice(0, 12);
      if (await tx.party.findFirst({ where: { company_id: companyId, code } })) throw new BadRequestException('This party code already exists');
      if (dto.price_list_id && !await tx.priceList.findFirst({ where: { id: dto.price_list_id, company_id: companyId } })) throw new BadRequestException('Price list not found');
      const party = await tx.party.create({ data: { company_id: companyId, party_type: type, code, name: dto.name.trim(),
        phone: dto.mobile || null, email: dto.email || null, gstin: dto.gstin || null, pan: dto.pan || null, address: dto.address,
        state: dto.state, credit_allowed: dto.credit_allowed ?? true, credit_days: dto.credit_days ?? 0, credit_limit: dto.credit_limit,
        price_list_id: dto.price_list_id, nickname: dto.nickname, supplier_category: dto.supplier_category || 'REGULAR',
        max_credit_bills: dto.max_credit_bills, visit_date: type === 'SUPPLIER' && dto.visit_date ? new Date(dto.visit_date) : null, visit_cycle: type === 'SUPPLIER' ? dto.visit_cycle || 'NONE' : 'NONE' } });
      const groupName = type === 'CUSTOMER' ? 'Sundry Debtors' : 'Sundry Creditors';
      const accountType = type === 'CUSTOMER' ? 'ASSET' : 'LIABILITY';
      let group = await tx.ledgerAccount.findFirst({ where: { company_id: companyId, name: groupName } });
      if (!group) group = await tx.ledgerAccount.create({ data: { company_id: companyId, name: groupName, account_type: accountType, code: type === 'CUSTOMER' ? 'SD' : 'SC' } });
      const ledger = await tx.ledgerAccount.create({ data: { company_id: companyId, parent_id: group.id, name: party.name, account_type: accountType, code, party_id: party.id } });
      if ((dto.opening_balance || 0) > 0) {
        if (!context) throw new BadRequestException('Opening balance requires branch and financial year context');
        const date = context.openingDate || new Date();
        const fy = await tx.financialYear.findFirst({ where: { id: context.financialYearId, company_id: companyId, is_closed: false,
          start_date: { lte: date }, end_date: { gte: new Date(date.toISOString().slice(0, 10)) } } });
        if (!fy) throw new BadRequestException('Opening balance requires an open current financial year');
        let equity = await tx.ledgerAccount.findFirst({ where: { company_id: companyId, code: 'OPENING_EQUITY' } });
        if (!equity) equity = await tx.ledgerAccount.create({ data: { company_id: companyId, name: 'Opening Balance Equity', account_type: 'EQUITY', code: 'OPENING_EQUITY' } });
        const voucher = await this.accountingPostingService.postVoucher(tx, { company_id: companyId, branch_id: context.branchId,
          financial_year_id: fy.id, voucher_type: 'JOURNAL', voucher_date: date, document_number: 'OPEN-' + uuidv4(),
          posted_by: context.userId, narration: type === 'CUSTOMER' ? 'Customer opening receivable' : 'Supplier opening payable', lines: [
            { ledger_account_id: ledger.id, party_id: party.id, debit: type === 'CUSTOMER' ? dto.opening_balance! : 0, credit: type === 'SUPPLIER' ? dto.opening_balance! : 0 },
            { ledger_account_id: equity.id, debit: type === 'SUPPLIER' ? dto.opening_balance! : 0, credit: type === 'CUSTOMER' ? dto.opening_balance! : 0 },
          ] });
        await tx.billAllocation.create({ data: { company_id: companyId, party_id: party.id, voucher_line_id: voucher.lines.find(l => l.party_id === party.id)!.id,
          reference_document_type: 'OPENING_BALANCE', reference_document_id: voucher.id, allocation_type: 'NEW_REFERENCE', amount: dto.opening_balance! } });
      }
      if(context)await tx.auditLog.create({data:{company_id:companyId,branch_id:context.branchId,user_id:context.userId,action:'RETAIL_'+type+'_CREATED',source_document_type:'Party',source_document_id:party.id}});
      return { ...party, mobile: party.phone, active: party.is_active, outstanding_amount: dto.opening_balance || 0 };
    };
    return suppliedTx ? create(suppliedTx) : this.prisma.$transaction(create);
  }

  createCustomer(companyId: string, dto: CreateRetailCustomerDto, context?: { branchId: string; financialYearId: string; userId: string; openingDate?: Date }, tx?: Prisma.TransactionClient) {
    return this.createParty(companyId, 'CUSTOMER', dto, context, tx);
  }
  createSupplier(companyId: string, dto: CreateRetailSupplierDto, context?: { branchId: string; financialYearId: string; userId: string; openingDate?: Date }, tx?: Prisma.TransactionClient) {
    return this.createParty(companyId, 'SUPPLIER', dto, context, tx);
  }

  private async getPartyKhata(companyId: string, partyId: string, type: 'CUSTOMER' | 'SUPPLIER') {
    const party = await this.prisma.party.findFirst({ where: { id: partyId, company_id: companyId, party_type: type } });
    if (!party) throw new NotFoundException(type === 'CUSTOMER' ? 'Customer not found' : 'Supplier not found');
    const allocations = await this.prisma.billAllocation.findMany({ where: { company_id: companyId, party_id: party.id },
      include: { voucher_line: { include: { voucher: true } } } });
    const entries = new Map<string, any>();
    for (const a of allocations) {
      const key = a.voucher_line_id + ':' + a.allocation_type;
      const entry = entries.get(key) || { id: a.voucher_line_id, type: a.allocation_type === 'NEW_REFERENCE' ? (type === 'CUSTOMER' ? 'SALE' : 'PURCHASE') : 'PAYMENT',
        date: a.voucher_line.voucher.voucher_date, created_at: a.voucher_line.voucher.created_at,
        amount: 0, balance_after: 0, reference: a.voucher_line.voucher.document_number,
        reference_id: a.voucher_line.voucher_id, note: a.voucher_line.voucher.narration, payment_method: a.voucher_line.voucher.payment_method,
        document_ids: [] };
      entry.amount += Number(a.amount);
      entry.document_ids.push(a.reference_document_id);
      if(a.allocation_type==='NEW_REFERENCE'&&a.reference_document_type==='SALES_INVOICE')entry.invoice_id=a.reference_document_id;
      entries.set(key, entry);
    }
    // Invoice text is not chronological. Keep same-day postings in their creation
    // order so a later payment cannot appear before the debt it settles.
    const transactions = [...entries.values()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      || a.reference_id.localeCompare(b.reference_id)
      || Number(a.type === 'PAYMENT') - Number(b.type === 'PAYMENT'));
    const ids = transactions.flatMap(t => [t.reference_id, ...t.document_ids]);
    const attachments = await this.prisma.attachment.findMany({ where: { company_id: companyId, entity_id: { in: ids } }, select: { entity_id: true, id: true } });
    let balance = 0;
    for (const t of transactions) {
      balance += t.amount * (t.type === 'PAYMENT' ? -1 : 1);
      t.balance_after = balance;
      t.attachment = attachments.find(a => a.entity_id === t.reference_id || t.document_ids.includes(a.entity_id)) || null;
      delete t.created_at;
    }
    return { [type === 'CUSTOMER' ? 'customer' : 'supplier']: { ...party, mobile: party.phone,active:party.is_active }, balance:(await this.getPartyBalance(companyId,partyId,type)).balance, transactions };
  }
  /** The same reference-allocation definition as Khata, without loading its history. */
  async getPartyBalance(companyId:string,partyId:string,type:'CUSTOMER'|'SUPPLIER') {
    const party=await this.prisma.party.findFirst({where:{id:partyId,company_id:companyId,party_type:type},select:{id:true,name:true}});
    if(!party)throw new NotFoundException('Party not found');
    const groups=await this.prisma.billAllocation.groupBy({by:['allocation_type'],where:{company_id:companyId,party_id:partyId},_sum:{amount:true}});
    const balance=groups.reduce((s,g)=>s+Number(g._sum.amount||0)*(g.allocation_type==='NEW_REFERENCE'?1:g.allocation_type==='AGAINST_REFERENCE'?-1:0),0);
    return {party,balance};
  }
  async getPartyStatement(companyId:string,partyId:string,type:'CUSTOMER'|'SUPPLIER',offset=0,dates?:{from:string;to:string}) {
    const summary=await this.getPartyBalance(companyId,partyId,type);
    const allocations=await this.prisma.billAllocation.findMany({where:{company_id:companyId,party_id:partyId,...(dates?{voucher_line:{voucher:{voucher_date:{gte:new Date(dates.from+'T00:00:00Z'),lte:new Date(dates.to+'T23:59:59.999Z')}}}}:{})},select:{id:true,amount:true,allocation_type:true,voucher_line:{select:{voucher:{select:{document_number:true,voucher_date:true}}}}},orderBy:{id:'asc'},skip:offset,take:6});
    return {...summary,rows:allocations.slice(0,5).map(a=>({reference:a.voucher_line.voucher.document_number,date:a.voucher_line.voucher.voucher_date.toISOString().slice(0,10),type:a.allocation_type==='NEW_REFERENCE'?'BILL':'PAYMENT',amount:Number(a.amount)})),hasMore:allocations.length>5};
  }
  getCustomerKhata(companyId: string, partyId: string) { return this.getPartyKhata(companyId, partyId, 'CUSTOMER'); }
  getSupplierKhata(companyId: string, partyId: string) { return this.getPartyKhata(companyId, partyId, 'SUPPLIER'); }

  private settleParty(companyId: string, branchId: string, financialYearId: string, userId: string, partyId: string,
    type: 'CUSTOMER' | 'SUPPLIER', dto: ReceivePaymentDto) {
    return this.prisma.$transaction(async tx => {
      const config=type==='CUSTOMER'&&dto.payment_method==='UPI'?await tx.companyConfiguration.findUnique({where:{company_id:companyId}}):null;
      const recipient=type==='CUSTOMER'?paymentRecipient(config?.payment_configuration,dto):{};
      const result=await this.accountingPostingService.settlePartyBalance(tx, {
      company_id: companyId, branch_id: branchId, financial_year_id: financialYearId, user_id: userId, party_id: partyId,
      party_type: type, amount: dto.amount, payment_method: dto.payment_method, date: dto.date ? new Date(dto.date) : new Date(), note: dto.note,
    });
      if(type==='CUSTOMER'&&dto.payment_method==='UPI')await tx.voucher.update({where:{id:result.payment_id},data:{receiving_snapshot:recipient}});
      return result;
    }, { timeout: 15000 });
  }
  receivePayment(companyId: string, branchId: string, financialYearId: string, userId: string, partyId: string, dto: ReceivePaymentDto) {
    return this.settleParty(companyId, branchId, financialYearId, userId, partyId, 'CUSTOMER', dto);
  }
  paySupplier(companyId: string, branchId: string, financialYearId: string, userId: string, partyId: string, dto: PaySupplierDto) {
    return this.settleParty(companyId, branchId, financialYearId, userId, partyId, 'SUPPLIER', dto);
  }

  // ── PURCHASES ────────────────────────────────────────────────────────

  async getPurchases(companyId: string,query:any={}) {
    const purchases = await this.prisma.purchaseInvoice.findMany({
      where: { company_id: companyId,...(query.search?{OR:[{document_number:{contains:String(query.search),mode:'insensitive' as const}},{party:{name:{contains:String(query.search),mode:'insensitive' as const}}}]}:{}) },
      ...page(query),
      include: { party: { select: { id: true, name: true } } },
      orderBy: { document_date: 'desc' }
    });

    const attachments = await this.prisma.attachment.findMany({
      where: { company_id: companyId, entity_type: 'PURCHASE',entity_id:{in:purchases.map(p=>p.id)} },
      select: { entity_id: true, id: true, mime_type: true }
    });
    const attachmentMap = new Map(attachments.map(a => [a.entity_id, a]));

    return purchases.map(p => ({
      ...p,
      attachment: attachmentMap.get(p.id) || null
    }));
  }

  createPurchase(companyId: string, branchId: string, financialYearId: string, userId: string, dto: CreateRetailPurchaseDto) {
    return this.purchaseService.postRetailPurchase(companyId, branchId, financialYearId, userId, dto);
  }

  // ── NEED LIST ────────────────────────────────────────────────────────

  async getNeeds(companyId: string,query:any={}) {
    const needs = await this.prisma.needList.findMany({
      where: { company_id: companyId,...(query.search?{name:{contains:String(query.search),mode:'insensitive' as const}}:{}) },
      ...page(query),
      include: { customer: { select: { name: true } }, preferred_supplier: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });

    const attachments = await this.prisma.attachment.findMany({
      where: { company_id: companyId, entity_type: 'NEED',entity_id:{in:needs.map(n=>n.id)} },
      select: { entity_id: true, id: true, mime_type: true }
    });
    const attachmentMap = new Map(attachments.map(a => [a.entity_id, a]));

    return needs.map(n => ({
      ...n,
      attachment: attachmentMap.get(n.id) || null
    }));
  }

  async createNeed(companyId: string, branchId: string, userId: string, dto: CreateNeedListDto) {
    if (dto.customer_id && !await this.prisma.party.findFirst({ where: { id: dto.customer_id, company_id: companyId, party_type: 'CUSTOMER' } })) throw new BadRequestException('Customer not found');
    if (dto.preferred_supplier_id && !await this.prisma.party.findFirst({ where: { id: dto.preferred_supplier_id, company_id: companyId, party_type: 'SUPPLIER' } })) throw new BadRequestException('Supplier not found');
    let org = await this.prisma.company.findUnique({ where: { id: companyId }, select: { organization_id: true } });
    return this.prisma.needList.create({
      data: {
        organization_id: org!.organization_id,
        company_id: companyId,
        branch_id: branchId,
        name: dto.name,
        quantity: dto.quantity ?? 1,
        expected_price: dto.expected_price,
        source: dto.source || (dto.customer_id ? 'CUSTOMER' : 'SHOP'),
        customer_id: dto.customer_id,
        customer_phone: dto.customer_phone,
        preferred_supplier_id: dto.preferred_supplier_id,
        needed_by: dto.needed_by ? new Date(dto.needed_by) : null,
        priority: dto.priority || 'NORMAL',
        note: dto.note,
        created_by: userId,
      }
    });
  }

  async updateNeedStatus(id: string, companyId: string, dto: UpdateNeedStatusDto) {
    return this.prisma.needList.update({
      where: { id, company_id: companyId },
      data: { status: dto.status }
    });
  }

  async updateNeed(id:string,companyId:string,dto:Partial<CreateNeedListDto>,userId:string){
    return this.prisma.$transaction(async tx=>{
      const need=await tx.needList.findFirst({where:{id,company_id:companyId}});
      if(!need)throw new NotFoundException('Need not found');
      if(dto.name!==undefined&&(typeof dto.name!=='string'||!dto.name.trim()))throw new BadRequestException('Item name is required');
      for(const key of ['quantity','source','priority'])if((dto as any)[key]===null)throw new BadRequestException(key+' cannot be null');
      if(dto.customer_id&&!await tx.party.findFirst({where:{id:dto.customer_id,company_id:companyId,party_type:'CUSTOMER',is_active:true}}))throw new BadRequestException('Customer not found');
      if(dto.preferred_supplier_id&&!await tx.party.findFirst({where:{id:dto.preferred_supplier_id,company_id:companyId,party_type:'SUPPLIER',is_active:true}}))throw new BadRequestException('Supplier not found');
      const data:any={...dto};if(dto.name!==undefined)data.name=dto.name.trim();if(dto.needed_by!==undefined)data.needed_by=dto.needed_by?new Date(dto.needed_by):null;
      const updated=await tx.needList.update({where:{id:need.id},data});
      await tx.auditLog.create({data:{company_id:companyId,user_id:userId,action:'RETAIL_NEED_UPDATED',details:JSON.stringify({need_id:id,fields:Object.keys(dto)})}});
      return updated;
    });
  }

}
