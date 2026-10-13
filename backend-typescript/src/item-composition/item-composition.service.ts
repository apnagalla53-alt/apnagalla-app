import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { BatchExpiryService } from '../inventory/batch-expiry.service';
import { EntitlementService } from '../common/entitlement.service';
import { BundleRecipeDto, ModifierGroupsDto, AddVariantDto, AddConversionDto } from './item-composition.dto';

const compositionInclude = { bundle_components: { include: { component_item: true } }, modifier_groups: { include: { options: true } } };

@Injectable()
export class ItemCompositionService {
  constructor(private readonly db: PrismaService, private readonly batches: BatchExpiryService, private readonly entitlements: EntitlementService) {}

  private async feature(tx: any, companyId: string, code: string) {
    const company = await tx.company.findUnique({ where: { id: companyId }, select: { organization_id: true } });
    if (!company) throw new BadRequestException('Business not found');
    const effective = await this.entitlements.resolve(company.organization_id, tx,companyId);
    if (!effective.features.some(feature => feature.code === code && feature.enabled)) throw new ForbiddenException('Your subscription does not enable ' + code.replace(/_/g, ' ').toLowerCase());
  }
  private validateComponent(item: any) {
    if (item.inventory_tracking === false) throw new BadRequestException('Count component stock through Buy Stock before using it in a bundle');
    if (!item.is_active || item.is_bundle || item.item_type === 'BUNDLE') throw new BadRequestException('Use active individual items as components. Nested bundles and cycles are not supported');
    if (item.track_serial || item.has_variants) throw new BadRequestException('Serial and variant components require individual selection; bill these items separately');
  }
  private async ownedItem(tx: any, companyId: string, id: string) {
    const item = await tx.item.findFirst({ where: { id, company_id: companyId, is_system: false }, include: compositionInclude });
    if (!item) throw new NotFoundException('Item not found'); return item;
  }
  private async audit(tx: any, user: any, id: string, action: string) {
    await tx.auditLog.create({ data: { company_id: user.company_id, branch_id: user.branch_id, user_id: user.id, action, source_document_type: 'ITEM', source_document_id: id } });
  }
  async getComposition(companyId: string, id: string) {
    const item = await this.ownedItem(this.db, companyId, id);
    return { is_bundle: item.is_bundle, bundle_components: item.bundle_components, modifier_groups: item.modifier_groups };
  }
  async addVariant(user:any,id:string,dto:AddVariantDto) {
    return this.db.$transaction(async tx=>{
      await this.feature(tx,user.company_id,'VARIANTS');
      await tx.$queryRaw`SELECT id FROM companies WHERE id=${user.company_id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM items WHERE id=${id}::uuid AND company_id=${user.company_id}::uuid FOR UPDATE`;
      const item=await this.ownedItem(tx,user.company_id,id);
      if(item.inventory_tracking===false||!item.has_variants||item.is_bundle||item.item_type==='SERVICE')throw new BadRequestException('Enable variants on an individual stock item');
      const entries=Object.entries(dto.attributes);
      if(!entries.length||entries.length>10||entries.some(([key,value])=>!key.trim()||key.length>50||typeof value!=='string'||!value.trim()||value.length>100))throw new BadRequestException('Use 1–10 named text attributes');
      const attributes=Object.fromEntries(entries.map(([key,value])=>[key.trim(),value.trim()]));
      if(Object.keys(attributes).length!==entries.length)throw new BadRequestException('Use distinct attribute names');
      if(dto.sku!==undefined&&!dto.sku.trim())throw new BadRequestException('SKU cannot be empty');
      const current=await tx.itemVariant.findMany({where:{item_id:id},select:{attributes:true}});
      const canonical=(value:any)=>JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
      if(current.some(v=>canonical(v.attributes)===canonical(attributes)))throw new BadRequestException('This variant already exists');
      if(dto.sku&&(await tx.itemVariant.findFirst({where:{item:{company_id:user.company_id},sku:{equals:dto.sku.trim(),mode:'insensitive'}}})||await tx.item.findFirst({where:{company_id:user.company_id,sku:{equals:dto.sku.trim(),mode:'insensitive'}}})))throw new BadRequestException('SKU already exists in this business');
      const result=await tx.itemVariant.create({data:{item_id:id,attributes,sku:dto.sku?.trim(),default_sale_rate:dto.default_sale_rate}});
      await this.audit(tx,user,id,'ITEM_VARIANT_ADD');return result;
    });
  }
  async addConversion(user:any,id:string,dto:AddConversionDto) {
    return this.db.$transaction(async tx=>{
      await this.feature(tx,user.company_id,'MULTI_UNIT');
      await tx.$queryRaw`SELECT id FROM companies WHERE id=${user.company_id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM items WHERE id=${id}::uuid AND company_id=${user.company_id}::uuid FOR UPDATE`;
      const item=await this.ownedItem(tx,user.company_id,id),factor=new Prisma.Decimal(dto.conversion_factor);
      if(factor.decimalPlaces()>6||item.selling_mode==='PIECE'&&!factor.isInteger())throw new BadRequestException('Use up to six decimals and whole base pieces');
      const unit=await tx.unit.findFirst({where:{company_id:user.company_id,code:dto.unit_code}}) || await tx.unit.create({data:{company_id:user.company_id,code:dto.unit_code,name:dto.unit_code,decimal_places:item.selling_mode==='PIECE'?0:6}});
      if(unit.id===item.primary_unit_id)throw new BadRequestException('The base unit does not need a conversion');
      if(await tx.itemUnitConversion.findFirst({where:{item_id:id,from_unit_id:unit.id,to_unit_id:item.primary_unit_id}}))throw new BadRequestException('This conversion already exists. Existing factors are preserved for stock and financial safety');
      const result=await tx.itemUnitConversion.create({data:{item_id:id,from_unit_id:unit.id,to_unit_id:item.primary_unit_id,conversion_factor:factor}});
      await this.audit(tx,user,id,'ITEM_UNIT_CONVERSION_ADD');return result;
    });
  }
  async replaceBundle(user: any, id: string, dto: BundleRecipeDto) {
    return this.db.$transaction(async tx => {
      await this.feature(tx, user.company_id, 'BUNDLES');
      await tx.$queryRaw`SELECT id FROM items WHERE id=${id}::uuid AND company_id=${user.company_id}::uuid FOR UPDATE`;
      const parent = await this.ownedItem(tx, user.company_id, id);
      if (!parent.is_bundle || parent.track_batch || parent.track_serial || parent.has_variants) throw new BadRequestException('Configure a bundle item with no parent batch, serial or variant tracking');
      if (new Set(dto.components.map(component => component.item_id)).size !== dto.components.length) throw new BadRequestException('Combine duplicate components');
      for (const component of dto.components) {
        if (component.item_id === id) throw new BadRequestException('A bundle cannot contain itself');
        const item = await tx.item.findFirst({ where: { id: component.item_id, company_id: user.company_id } });
        if (!item) throw new BadRequestException('Component item not found in this business'); this.validateComponent(item);
        const quantity = new Prisma.Decimal(component.quantity);
        if (quantity.decimalPlaces() > 6 || item.selling_mode === 'PIECE' && item.item_type !== 'SERVICE' && !quantity.isInteger()) throw new BadRequestException('Component quantities must match the item base unit and precision');
      }
      await tx.itemBundleComponent.deleteMany({ where: { bundle_item_id: id } });
      await tx.itemBundleComponent.createMany({ data: dto.components.map(component => ({ bundle_item_id: id, component_item_id: component.item_id, quantity: component.quantity })) });
      await this.audit(tx, user, id, 'BUNDLE_RECIPE_UPDATE'); return this.ownedItem(tx, user.company_id, id);
    });
  }
  async replaceModifiers(user: any, id: string, dto: ModifierGroupsDto) {
    return this.db.$transaction(async tx => {
      await this.feature(tx, user.company_id, 'MODIFIERS');
      await tx.$queryRaw`SELECT id FROM items WHERE id=${id}::uuid AND company_id=${user.company_id}::uuid FOR UPDATE`;
      await this.ownedItem(tx, user.company_id, id);
      for (const group of dto.groups) {
        if (!group.name.trim() || group.min_select > group.max_select || group.max_select > group.options.length) throw new BadRequestException('Modifier selection limits must fit the available options');
        if (new Set(group.options.map(option => option.name.trim().toLowerCase())).size !== group.options.length || group.options.some(option => !option.name.trim())) throw new BadRequestException('Use a unique, nonempty name for each option in a group');
        if (group.options.some(option => new Prisma.Decimal(option.price_delta).decimalPlaces() > 2)) throw new BadRequestException('Modifier prices support up to two decimal places');
      }
      await tx.itemModifierGroup.deleteMany({ where: { item_id: id } });
      for (const group of dto.groups) await tx.itemModifierGroup.create({ data: { item_id: id, name: group.name.trim(), min_select: group.min_select, max_select: group.max_select,
        options: { create: group.options.map(option => ({ name: option.name.trim(), price_delta: option.price_delta })) } } });
      await this.audit(tx, user, id, 'MODIFIER_GROUPS_UPDATE'); return this.ownedItem(tx, user.company_id, id);
    });
  }

  /** Lock all selected roots and physical components in one stable order before allocating FEFO. */
  async lockSaleItems(tx: any, companyId: string, lines: { item_id: string }[]) {
    const roots = await tx.item.findMany({ where: { company_id: companyId, id: { in: lines.map(line => line.item_id) } }, include: { bundle_components: true } });
    const ids = [...new Set([...lines.map(line => line.item_id), ...roots.flatMap((root: any) => root.bundle_components.map((component: any) => component.component_item_id))])].sort() as string[];
    for (const id of ids) await tx.$queryRaw`SELECT id FROM items WHERE id=${id}::uuid AND company_id=${companyId}::uuid FOR UPDATE`;
    const current = await tx.itemBundleComponent.findMany({ where: { bundle_item_id: { in: roots.filter((root: any) => root.is_bundle).map((root: any) => root.id) } } });
    if (current.some((component: any) => !ids.includes(component.component_item_id))) throw new ConflictException('A bundle recipe changed while preparing the bill. Reload the item and try again');
  }

  async modifierPricing(tx: any, companyId: string, itemId: string, selected: string[] | undefined, quantity: Prisma.Decimal, pricing: any) {
    const groups = await tx.itemModifierGroup.findMany({ where: { item_id: itemId, item: { company_id: companyId } }, include: { options: true }, orderBy: { id: 'asc' } });
    const ids = selected || [];
    if (!groups.length && !ids.length) return undefined;
    await this.feature(tx, companyId, 'MODIFIERS');
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Select each modifier option once');
    const options = groups.flatMap((group: any) => group.options);
    if (ids.some(id => !options.some((option: any) => option.id === id))) throw new BadRequestException('Modifier option is unavailable or belongs to another item');
    let delta = new Prisma.Decimal(0);
    const selectedGroups = [];
    for (const group of groups) {
      const choices = group.options.filter((option: any) => ids.includes(option.id));
      if (choices.length < group.min_select || choices.length > group.max_select) throw new BadRequestException(`Choose ${group.min_select} to ${group.max_select} options for ${group.name}`);
      choices.forEach((option: any) => { delta = delta.plus(option.price_delta); });
      selectedGroups.push({ id: group.id, name: group.name, options: choices.map((option: any) => ({ id: option.id, name: option.name, price_delta: option.price_delta.toString() })) });
    }
    const surcharge = delta.mul(quantity).toDecimalPlaces(2);
    if (pricing.taxableValue.plus(surcharge).lt(0) || pricing.resolvedRate.plus(delta).lt(0)) throw new BadRequestException('Modifier discount exceeds the item value');
    pricing.resolvedRate = pricing.resolvedRate.plus(delta);
    pricing.taxableValue = pricing.taxableValue.plus(surcharge);
    pricing.lineTotal = pricing.lineTotal.plus(surcharge);
    pricing.pricingTrace = { ...pricing.pricingTrace, resolvedRate: pricing.resolvedRate.toString(), finalLineAmount: pricing.taxableValue.toString(),
      appliedSequence: [...(pricing.pricingTrace.appliedSequence || []), 'MODIFIERS'],
      ruleDetails: [...(pricing.pricingTrace.ruleDetails || []), { step: 'MODIFIERS', ruleType: 'MODIFIER_SELECTION', description: 'Catalog option price adjustments; base price discounts apply before modifiers', originalValue: '0', adjustedValue: surcharge.toString() }] };
    return { groups: selectedGroups, unit_delta: delta.toString(), amount: surcharge.toString() };
  }

  async prepareBundle(tx: any, companyId: string, itemId: string, godownId: string, totalBaseQuantity: Prisma.Decimal, date: string) {
    await this.feature(tx, companyId, 'BUNDLES');
    const parent = await this.ownedItem(tx, companyId, itemId);
    if (!parent.bundle_components.length || parent.track_serial || parent.has_variants || parent.track_batch) throw new BadRequestException('Configure a complete bundle recipe before billing');
    if (parent.selling_mode === 'PIECE' && !totalBaseQuantity.isInteger()) throw new BadRequestException('Bundle quantity must be a whole number of kits');
    const inventoryLines: any[] = [], snapshot: any[] = [];
    for (const entry of [...parent.bundle_components].sort((a: any, b: any) => a.component_item_id.localeCompare(b.component_item_id))) {
      const component = entry.component_item;
      if (component.company_id !== companyId) throw new BadRequestException('Bundle component is outside this business'); this.validateComponent(component);
      const quantity = new Prisma.Decimal(entry.quantity).mul(totalBaseQuantity);
      let allocations: any[] = [];
      if (component.item_type !== 'SERVICE') {
        if (component.track_batch) {
          await this.feature(tx, companyId, 'BATCH_TRACKING');
          allocations = (await this.batches.resolveBatchesForSale(companyId, { itemId: component.id, godownId, quantityBase: quantity, transactionDate: new Date(date) }, tx))
            .map(allocation => ({ id: randomUUID(), batch_id: allocation.batchId, quantity: allocation.quantity.toString(), godown_id: godownId }));
        } else allocations = [{ id: randomUUID(), batch_id: null, quantity: quantity.toString(), godown_id: godownId }];
        for (const allocation of allocations) inventoryLines.push({ item_id: component.id, godown_id: godownId, unit_id: component.primary_unit_id, batch_id: allocation.batch_id,
          quantity: allocation.quantity, source_line_id: allocation.id, cost_rate: 0 });
      }
      snapshot.push({ item_id: component.id, name: component.name, unit_id: component.primary_unit_id, item_type: component.item_type,
        quantity_per_base_bundle: entry.quantity.toString(), total_quantity: quantity.toString(), allocations });
    }
    return { inventoryLines, snapshot: { base_bundle_quantity: totalBaseQuantity.toString(), components: snapshot } };
  }

  /** Restore exactly the purchased composition; subsequent recipe/option changes cannot alter a refund. */
  async returnBundle(tx: any, companyId: string, source: any, ratio: Prisma.Decimal) {
    const snapshot = source.bundle_snapshot as any;
    if (!snapshot?.components?.length) throw new BadRequestException('Original bundle inventory snapshot is unavailable');
    const lines: any[] = [];
    for (const component of snapshot.components) {
      if (component.item_type === 'SERVICE') continue;
      const item = await tx.item.findFirst({ where: { id: component.item_id, company_id: companyId } });
      if (!item || item.primary_unit_id !== component.unit_id) throw new BadRequestException('Original bundle component cannot be restored safely');
      for (const allocation of component.allocations) {
        const quantity = new Prisma.Decimal(allocation.quantity).mul(ratio);
        if (quantity.decimalPlaces() > 6 || item.selling_mode === 'PIECE' && !quantity.isInteger()) throw new BadRequestException('Return the complete kit to restore its whole components');
        lines.push({ item_id: component.item_id, godown_id: allocation.godown_id, unit_id: component.unit_id, batch_id: allocation.batch_id || null,
          quantity: quantity.toString(), source_line_id: randomUUID(), cost_rate: 0 });
      }
    }
    return lines;
  }
}
