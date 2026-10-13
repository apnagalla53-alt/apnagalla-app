import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PricingEngineService } from './pricing-engine.service';
import { CreatePriceListDto, UpdatePriceListDto } from './dto/create-price-list.dto';
import { CreatePriceListItemDto, UpdatePriceListItemDto } from './dto/price-list-item.dto';
import { CreateCustomerRateDto, UpdateCustomerRateDto } from './dto/customer-rate.dto';
import { CreatePromotionSchemeDto, UpdatePromotionSchemeDto } from './dto/promotion-scheme.dto';
import { EvaluatePricingDto } from './dto/evaluate-pricing.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEngine: PricingEngineService,
  ) {}

  // ── 1. Slab Overlap Validation Helpers ─────────────────────────────────────

  private checkSlabOverlap(
    existingSlabs: Array<{ id: string; min_qty: any; max_qty: any }>,
    newMin: number,
    newMax: number | null | undefined,
    excludeId?: string,
  ) {
    const minA = newMin;
    const maxA = newMax !== null && newMax !== undefined ? newMax : Infinity;

    if (minA < 0) {
      throw new BadRequestException('Minimum quantity cannot be negative');
    }
    if (maxA < minA) {
      throw new BadRequestException(`Maximum quantity (${maxA}) cannot be less than minimum quantity (${minA})`);
    }

    for (const slab of existingSlabs) {
      if (excludeId && slab.id === excludeId) continue;
      const minB = Number(slab.min_qty);
      const maxB = slab.max_qty !== null && slab.max_qty !== undefined ? Number(slab.max_qty) : Infinity;

      // Overlap condition: minA <= maxB && maxA >= minB
      if (minA <= maxB && maxA >= minB) {
        throw new ConflictException(
          `Overlapping quantity slab detected: [${minA}, ${maxA === Infinity ? '∞' : maxA}] overlaps with existing slab [${minB}, ${maxB === Infinity ? '∞' : maxB}]`,
        );
      }
    }
  }

  // ── 2. Price List CRUD ────────────────────────────────────────────────────

  async createPriceList(companyId: string, dto: CreatePriceListDto) {
    // Check code uniqueness within company
    const existing = await this.prisma.priceList.findUnique({
      where: { company_id_code: { company_id: companyId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Price list with code "${dto.code}" already exists for this company`);
    }

    if (dto.branch_id) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branch_id } });
      if (!branch || branch.company_id !== companyId) {
        throw new BadRequestException('Branch not found or belongs to another company');
      }
    }

    return this.prisma.priceList.create({
      data: {
        company_id: companyId,
        code: dto.code,
        name: dto.name,
        currency: dto.currency || 'INR',
        status: dto.status || 'ACTIVE',
        branch_id: dto.branch_id,
        valid_from: dto.valid_from ? new Date(dto.valid_from) : undefined,
        valid_to: dto.valid_to ? new Date(dto.valid_to) : undefined,
        priority: dto.priority || 0,
        customer_type: dto.customer_type,
        is_active: dto.is_active !== undefined ? dto.is_active : true,
      },
      include: { items: true },
    });
  }

  async getPriceLists(companyId: string, filters?: { status?: string; branchId?: string }) {
    return this.prisma.priceList.findMany({
      where: {
        company_id: companyId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.branchId ? { branch_id: filters.branchId } : {}),
      },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        items: { include: { item: { select: { id: true, sku: true, name: true } } } },
      },
      orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
    });
  }

  async getPriceListById(companyId: string, id: string) {
    const pl = await this.prisma.priceList.findUnique({
      where: { id },
      include: {
        branch: true,
        items: {
          include: {
            item: { select: { id: true, sku: true, name: true, default_sale_rate: true, mrp: true } },
            unit: true,
          },
        },
      },
    });
    if (!pl || pl.company_id !== companyId) {
      throw new NotFoundException('Price list not found');
    }
    return pl;
  }

  async updatePriceList(companyId: string, id: string, dto: UpdatePriceListDto) {
    await this.getPriceListById(companyId, id);

    if (dto.branch_id) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branch_id } });
      if (!branch || branch.company_id !== companyId) {
        throw new BadRequestException('Branch not found or belongs to another company');
      }
    }

    return this.prisma.priceList.update({
      where: { id },
      data: {
        name: dto.name,
        status: dto.status,
        branch_id: dto.branch_id,
        valid_from: dto.valid_from ? new Date(dto.valid_from) : undefined,
        valid_to: dto.valid_to ? new Date(dto.valid_to) : undefined,
        priority: dto.priority,
        customer_type: dto.customer_type,
        is_active: dto.is_active,
      },
    });
  }

  async deletePriceList(companyId: string, id: string) {
    await this.getPriceListById(companyId, id);
    return this.prisma.priceList.delete({ where: { id } });
  }

  // ── 3. Price List Item & Slabs ────────────────────────────────────────────

  async addPriceListItem(companyId: string, priceListId: string, dto: CreatePriceListItemDto) {
    const pl = await this.getPriceListById(companyId, priceListId);

    // Validate item belongs to company
    const item = await this.prisma.item.findUnique({ where: { id: dto.item_id } });
    if (!item || item.company_id !== companyId) {
      throw new BadRequestException('Item not found or belongs to another company');
    }

    const minQty = dto.min_qty !== undefined ? dto.min_qty : 0;
    const maxQty = dto.max_qty !== undefined ? dto.max_qty : null;

    // Fetch existing slabs for this item in this price list
    const existingSlabs = await this.prisma.priceListItem.findMany({
      where: { price_list_id: priceListId, item_id: dto.item_id },
    });

    this.checkSlabOverlap(existingSlabs, minQty, maxQty);

    return this.prisma.priceListItem.create({
      data: {
        price_list_id: priceListId,
        item_id: dto.item_id,
        unit_id: dto.unit_id || item.primary_unit_id,
        rate: new Prisma.Decimal(dto.rate),
        min_qty: new Prisma.Decimal(minQty),
        max_qty: maxQty !== null ? new Prisma.Decimal(maxQty) : null,
        discount_percent: new Prisma.Decimal(dto.discount_percent || 0),
        is_active: dto.is_active !== undefined ? dto.is_active : true,
      },
      include: { item: true, unit: true },
    });
  }

  async updatePriceListItem(companyId: string, priceListId: string, id: string, dto: UpdatePriceListItemDto) {
    await this.getPriceListById(companyId, priceListId);

    const existing = await this.prisma.priceListItem.findUnique({ where: { id } });
    if (!existing || existing.price_list_id !== priceListId) {
      throw new NotFoundException('Price list item not found');
    }

    const minQty = dto.min_qty !== undefined ? dto.min_qty : Number(existing.min_qty);
    const maxQty = dto.max_qty !== undefined ? dto.max_qty : (existing.max_qty ? Number(existing.max_qty) : null);

    if (dto.min_qty !== undefined || dto.max_qty !== undefined) {
      const existingSlabs = await this.prisma.priceListItem.findMany({
        where: { price_list_id: priceListId, item_id: existing.item_id },
      });
      this.checkSlabOverlap(existingSlabs, minQty, maxQty, id);
    }

    return this.prisma.priceListItem.update({
      where: { id },
      data: {
        rate: dto.rate !== undefined ? new Prisma.Decimal(dto.rate) : undefined,
        min_qty: dto.min_qty !== undefined ? new Prisma.Decimal(dto.min_qty) : undefined,
        max_qty: dto.max_qty !== undefined ? (dto.max_qty !== null ? new Prisma.Decimal(dto.max_qty) : null) : undefined,
        discount_percent: dto.discount_percent !== undefined ? new Prisma.Decimal(dto.discount_percent) : undefined,
        is_active: dto.is_active,
      },
    });
  }

  async deletePriceListItem(companyId: string, priceListId: string, id: string) {
    await this.getPriceListById(companyId, priceListId);
    const item = await this.prisma.priceListItem.findUnique({ where: { id } });
    if (!item || item.price_list_id !== priceListId) {
      throw new NotFoundException('Price list item not found');
    }
    return this.prisma.priceListItem.delete({ where: { id } });
  }

  // ── 4. Customer-Specific Rates & Slabs ────────────────────────────────────

  async createCustomerRate(companyId: string, dto: CreateCustomerRateDto) {
    const party = await this.prisma.party.findUnique({ where: { id: dto.party_id } });
    if (!party || party.company_id !== companyId) {
      throw new BadRequestException('Customer/Party not found or belongs to another company');
    }

    const item = await this.prisma.item.findUnique({ where: { id: dto.item_id } });
    if (!item || item.company_id !== companyId) {
      throw new BadRequestException('Item not found or belongs to another company');
    }

    const minQty = dto.min_qty !== undefined ? dto.min_qty : 0;
    const maxQty = dto.max_qty !== undefined ? dto.max_qty : null;

    // Fetch existing customer rate slabs
    const existingSlabs = await this.prisma.customerItemPrice.findMany({
      where: { company_id: companyId, party_id: dto.party_id, item_id: dto.item_id },
    });

    this.checkSlabOverlap(existingSlabs, minQty, maxQty);

    return this.prisma.customerItemPrice.create({
      data: {
        company_id: companyId,
        party_id: dto.party_id,
        item_id: dto.item_id,
        unit_id: dto.unit_id || item.primary_unit_id,
        rate: new Prisma.Decimal(dto.rate),
        min_qty: new Prisma.Decimal(minQty),
        max_qty: maxQty !== null ? new Prisma.Decimal(maxQty) : null,
        valid_from: dto.valid_from ? new Date(dto.valid_from) : undefined,
        valid_to: dto.valid_to ? new Date(dto.valid_to) : undefined,
        is_active: dto.is_active !== undefined ? dto.is_active : true,
      },
      include: { party: true, item: true },
    });
  }

  async getCustomerRates(companyId: string, partyId?: string) {
    return this.prisma.customerItemPrice.findMany({
      where: {
        company_id: companyId,
        ...(partyId ? { party_id: partyId } : {}),
      },
      include: {
        party: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true, default_sale_rate: true, mrp: true } },
      },
      orderBy: [{ min_qty: 'asc' }],
    });
  }

  async updateCustomerRate(companyId: string, id: string, dto: UpdateCustomerRateDto) {
    const existing = await this.prisma.customerItemPrice.findUnique({ where: { id } });
    if (!existing || existing.company_id !== companyId) {
      throw new NotFoundException('Customer rate not found');
    }

    const minQty = dto.min_qty !== undefined ? dto.min_qty : Number(existing.min_qty);
    const maxQty = dto.max_qty !== undefined ? dto.max_qty : (existing.max_qty ? Number(existing.max_qty) : null);

    if (dto.min_qty !== undefined || dto.max_qty !== undefined) {
      const existingSlabs = await this.prisma.customerItemPrice.findMany({
        where: { company_id: companyId, party_id: existing.party_id, item_id: existing.item_id },
      });
      this.checkSlabOverlap(existingSlabs, minQty, maxQty, id);
    }

    return this.prisma.customerItemPrice.update({
      where: { id },
      data: {
        rate: dto.rate !== undefined ? new Prisma.Decimal(dto.rate) : undefined,
        min_qty: dto.min_qty !== undefined ? new Prisma.Decimal(dto.min_qty) : undefined,
        max_qty: dto.max_qty !== undefined ? (dto.max_qty !== null ? new Prisma.Decimal(dto.max_qty) : null) : undefined,
        valid_from: dto.valid_from ? new Date(dto.valid_from) : undefined,
        valid_to: dto.valid_to ? new Date(dto.valid_to) : undefined,
        is_active: dto.is_active,
      },
    });
  }

  async deleteCustomerRate(companyId: string, id: string) {
    const existing = await this.prisma.customerItemPrice.findUnique({ where: { id } });
    if (!existing || existing.company_id !== companyId) {
      throw new NotFoundException('Customer rate not found');
    }
    return this.prisma.customerItemPrice.delete({ where: { id } });
  }

  // ── 5. Promotion Schemes CRUD ─────────────────────────────────────────────

  async createPromotionScheme(companyId: string, dto: CreatePromotionSchemeDto) {
    // Unique code check
    const existing = await this.prisma.promotionScheme.findUnique({
      where: { company_id_code: { company_id: companyId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Promotion scheme with code "${dto.code}" already exists for this company`);
    }

    if (dto.branch_id) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branch_id } });
      if (!branch || branch.company_id !== companyId) {
        throw new BadRequestException('Branch not found or belongs to another company');
      }
    }
    if (dto.party_id) {
      const party = await this.prisma.party.findUnique({ where: { id: dto.party_id } });
      if (!party || party.company_id !== companyId) {
        throw new BadRequestException('Party not found or belongs to another company');
      }
    }
    if (dto.item_id) {
      const item = await this.prisma.item.findUnique({ where: { id: dto.item_id } });
      if (!item || item.company_id !== companyId) {
        throw new BadRequestException('Item not found or belongs to another company');
      }
    }

    // Validate scheme-specific constraints
    if (dto.scheme_type === 'BUY_X_GET_Y' || dto.scheme_type === 'FREE_QUANTITY') {
      if (!dto.buy_quantity || dto.buy_quantity <= 0) {
        throw new BadRequestException('Buy quantity must be greater than zero for Buy X Get Y / Free Quantity schemes');
      }
      if (!dto.get_quantity || dto.get_quantity <= 0) {
        throw new BadRequestException('Get quantity must be greater than zero');
      }
    }
    if (dto.discount_percent !== undefined && (dto.discount_percent < 0 || dto.discount_percent > 100)) {
      throw new BadRequestException('Discount percentage must be between 0 and 100');
    }
    if (dto.discount_amount !== undefined && dto.discount_amount < 0) {
      throw new BadRequestException('Discount amount cannot be negative');
    }

    return this.prisma.promotionScheme.create({
      data: {
        company_id: companyId,
        code: dto.code,
        name: dto.name,
        scheme_type: dto.scheme_type,
        status: dto.status || 'ACTIVE',
        branch_id: dto.branch_id,
        valid_from: dto.valid_from ? new Date(dto.valid_from) : undefined,
        valid_to: dto.valid_to ? new Date(dto.valid_to) : undefined,
        priority: dto.priority || 0,
        stackable: dto.stackable || false,
        customer_type: dto.customer_type,
        party_id: dto.party_id,
        item_id: dto.item_id,
        buy_quantity: dto.buy_quantity !== undefined ? new Prisma.Decimal(dto.buy_quantity) : null,
        get_quantity: dto.get_quantity !== undefined ? new Prisma.Decimal(dto.get_quantity) : null,
        free_item_id: dto.free_item_id,
        discount_percent: dto.discount_percent !== undefined ? new Prisma.Decimal(dto.discount_percent) : null,
        discount_amount: dto.discount_amount !== undefined ? new Prisma.Decimal(dto.discount_amount) : null,
        min_order_amount: dto.min_order_amount !== undefined ? new Prisma.Decimal(dto.min_order_amount) : null,
        max_benefit: dto.max_benefit !== undefined ? new Prisma.Decimal(dto.max_benefit) : null,
        is_active: dto.is_active !== undefined ? dto.is_active : true,
      },
      include: { item: true, party: true },
    });
  }

  async getPromotionSchemes(companyId: string, filters?: { schemeType?: string; status?: string }) {
    return this.prisma.promotionScheme.findMany({
      where: {
        company_id: companyId,
        ...(filters?.schemeType ? { scheme_type: filters.schemeType } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        party: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
    });
  }

  async getPromotionSchemeById(companyId: string, id: string) {
    const scheme = await this.prisma.promotionScheme.findUnique({
      where: { id },
      include: { item: true, party: true, free_item: true },
    });
    if (!scheme || scheme.company_id !== companyId) {
      throw new NotFoundException('Promotion scheme not found');
    }
    return scheme;
  }

  async updatePromotionScheme(companyId: string, id: string, dto: UpdatePromotionSchemeDto) {
    await this.getPromotionSchemeById(companyId, id);

    return this.prisma.promotionScheme.update({
      where: { id },
      data: {
        name: dto.name,
        status: dto.status,
        branch_id: dto.branch_id,
        valid_from: dto.valid_from ? new Date(dto.valid_from) : undefined,
        valid_to: dto.valid_to ? new Date(dto.valid_to) : undefined,
        priority: dto.priority,
        stackable: dto.stackable,
        customer_type: dto.customer_type,
        party_id: dto.party_id,
        item_id: dto.item_id,
        buy_quantity: dto.buy_quantity !== undefined ? new Prisma.Decimal(dto.buy_quantity) : undefined,
        get_quantity: dto.get_quantity !== undefined ? new Prisma.Decimal(dto.get_quantity) : undefined,
        free_item_id: dto.free_item_id,
        discount_percent: dto.discount_percent !== undefined ? new Prisma.Decimal(dto.discount_percent) : undefined,
        discount_amount: dto.discount_amount !== undefined ? new Prisma.Decimal(dto.discount_amount) : undefined,
        min_order_amount: dto.min_order_amount !== undefined ? new Prisma.Decimal(dto.min_order_amount) : undefined,
        max_benefit: dto.max_benefit !== undefined ? new Prisma.Decimal(dto.max_benefit) : undefined,
        is_active: dto.is_active,
      },
    });
  }

  async deletePromotionScheme(companyId: string, id: string) {
    await this.getPromotionSchemeById(companyId, id);
    return this.prisma.promotionScheme.delete({ where: { id } });
  }

  // ── 6. Pricing Evaluation Preview ─────────────────────────────────────────

  async evaluatePricingPreview(companyId: string, dto: EvaluatePricingDto) {
    const context = {
      branchId: dto.branch_id,
      documentDate: dto.document_date,
      customerType: dto.customer_type,
    };

    const calculatedLines = await Promise.all(
      dto.lines.map((l) =>
        this.pricingEngine.calculateLinePricing(
          companyId,
          dto.party_id,
          {
            itemId: l.item_id,
            quantity: l.quantity,
            unitId: l.unit_id,
            overrideRate: l.override_rate,
            overrideDiscountAmount: l.override_discount_amount,
            overrideDiscountPercent: l.override_discount_percent,
          },
          context,
        ),
      ),
    );

    const billDiscountRule =
      dto.bill_discount_amount !== undefined || dto.bill_discount_percent !== undefined
        ? {
            discountAmount: dto.bill_discount_amount,
            discountPercent: dto.bill_discount_percent,
          }
        : undefined;

    return this.pricingEngine.calculateBillPricing(companyId, calculatedLines, billDiscountRule);
  }

  // ── 7. Pricing Trace Inspection ───────────────────────────────────────────

  async getPricingTraces(companyId: string, documentType: string, documentId: string) {
    return this.prisma.pricingTrace.findMany({
      where: {
        company_id: companyId,
        document_type: documentType,
        document_id: documentId,
      },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        party: { select: { id: true, code: true, name: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }
}
