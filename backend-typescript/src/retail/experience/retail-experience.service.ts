import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EntitlementService } from '../../common/entitlement.service';
import { businessDate } from '../../common/business-date';
import { presetForBusiness } from '../../auth/business-types';
import { CounterService } from '../counter/counter.service';

export type Recommendation = {
  id: string;
  kind: string;
  category: 'DO_NOW' | 'DONT_MISS' | 'IMPROVE_DATA';
  tone: 'brand' | 'info' | 'warning' | 'danger' | 'special';
  title: string;
  description: string;
  why: string;
  action: { label: string; path: string };
  score: number;
  critical: boolean;
  facts: Record<string, string | number>;
};
const money = (value: unknown) =>
  '₹' + Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export function rankRecommendations(
  rows: Recommendation[],
  priority: string[],
  dismissed: string[] = [],
) {
  return rows
    .filter((r) => r.critical || !dismissed.includes(r.id))
    .sort((a, b) => {
      const rank = (r: Recommendation) => {
        const p = priority.indexOf(r.kind);
        return r.score + (p < 0 ? 0 : 30 / (p + 1));
      };
      return rank(b) - rank(a) || a.id.localeCompare(b.id);
    })
    .slice(0, 3);
}

/** Deterministic, permission-filtered read model over existing ledgers and saved facts. */
@Injectable()
export class RetailExperienceService {
  constructor(
    private db: PrismaService,
    private entitlements: EntitlementService,
    private counter: CounterService,
  ) {}
  async home(user: any, dismissed: string[] = []) {
    const owner = ['OWNER', 'ADMIN', 'TENANT_ADMIN'].includes(user.role),
      can = (p: string) => owner || user.permissions.includes(p),
      scope = { company_id: user.company_id, branch_id: user.branch_id };
    const [
      organization,
      effective,
      sales,
      purchases,
      itemCount,
      customerCount,
    ] = await Promise.all([
      this.db.organization.findUniqueOrThrow({
        where: { id: user.organization_id },
        select: { business_type: true },
      }),
      this.entitlements.resolve(user.organization_id, this.db, user.company_id),
      can('sales.read')
        ? this.db.salesInvoice.count({ where: { ...scope, status: 'POSTED' } })
        : Promise.resolve(0),
      can('purchase.read')
        ? this.db.purchaseInvoice.count({
            where: { ...scope, status: 'POSTED' },
          })
        : Promise.resolve(0),
      can('inventory.read')
        ? this.db.item.count({
            where: {
              company_id: user.company_id,
              is_system: false,
              is_active: true,
            },
          })
        : Promise.resolve(null),
      can('accounting.read')
        ? this.db.party.count({
            where: {
              company_id: user.company_id,
              party_type: 'CUSTOMER',
              is_walkin: false,
              is_active: true,
            },
          })
        : Promise.resolve(null),
    ]);
    const preset = presetForBusiness(organization.business_type),
      feature = (code: string) =>
        effective.features.some((f) => f.code === code && f.enabled),
      maturity =
        sales === 0 && purchases === 0
          ? 'NEW'
          : sales < 20
            ? 'LEARNING'
            : 'ACTIVE';
    const today = businessDate(),
      date = new Date(today + 'T00:00:00Z'),
      since = new Date(date.getTime() - 30 * 86400000),
      endExpiry = new Date(date.getTime() + 30 * 86400000),
      rows: Recommendation[] = [];
    const add = (
      r: Omit<Recommendation, 'critical'> & { critical?: boolean },
    ) => rows.push({ ...r, critical: !!r.critical });
    const jobs: Promise<unknown>[] = [];
    if (can('sales.read'))
      jobs.push(
        (async () => {
          const count = await this.db.posHeldBill.count({
            where: { ...scope, user_id: user.id },
          });
          if (count)
            add({
              id: 'held-bills',
              kind: 'HELD_BILL',
              category: 'DO_NOW',
              tone: 'info',
              title: 'A bill is waiting',
              description:
                count +
                ' held bill' +
                (count === 1 ? '' : 's') +
                ' ready to resume.',
              why: 'These are your saved held bills in the selected shop and branch. They have not been posted as sales.',
              action: { label: 'Resume held bill', path: '/retail/bills/held' },
              score: 900,
              facts: { count },
            });
        })(),
      );
    if (can('inventory.read') && feature('INVENTORY'))
      jobs.push(
        (async () => {
          const facts = await this.db.$queryRaw<any[]>(Prisma.sql`
    WITH recent AS (SELECT l.item_id,COUNT(DISTINCT s.id)::int sales_count,COUNT(*) FILTER(WHERE COALESCE(l.cost_status,'UNKNOWN')<>'KNOWN')::int unknown_lines
      FROM sales_invoice_lines l JOIN sales_invoices s ON s.id=l.sales_invoice_id WHERE s.company_id=${scope.company_id}::uuid AND s.branch_id=${scope.branch_id}::uuid AND s.status='POSTED' AND s.document_date>=${since}::date GROUP BY l.item_id),
    stock AS (SELECT item_id,SUM(quantity) quantity FROM stock_balance_projection WHERE company_id=${scope.company_id}::uuid AND branch_id=${scope.branch_id}::uuid GROUP BY item_id)
    SELECT i.id,i.name,i.inventory_tracking,i.low_stock_threshold,i.track_serial,i.has_variants,(SELECT COUNT(*) FROM item_unit_conversions uc WHERE uc.item_id=i.id) unit_count,(SELECT COUNT(*) FROM item_modifier_groups mg WHERE mg.item_id=i.id) modifier_count,u.code unit,COALESCE(s.quantity,0) quantity,COALESCE(r.sales_count,0) sales_count,COALESCE(r.unknown_lines,0) unknown_lines,COALESCE(c.unknown_quantity,0) unknown_quantity
    FROM items i JOIN units u ON u.id=i.primary_unit_id LEFT JOIN stock s ON s.item_id=i.id LEFT JOIN recent r ON r.item_id=i.id LEFT JOIN inventory_cost_states c ON c.company_id=i.company_id AND c.item_id=i.id AND c.variant_key='BASE'
    WHERE i.company_id=${scope.company_id}::uuid AND i.is_system=false AND i.is_active=true AND i.item_type='STOCK_ITEM' AND i.is_bundle=false AND i.has_variants=false
    AND ((i.inventory_tracking=true AND COALESCE(s.quantity,0)<=i.low_stock_threshold) OR (i.inventory_tracking=false AND COALESCE(r.sales_count,0)>=2) OR (COALESCE(c.unknown_quantity,0)>0 AND COALESCE(r.sales_count,0)>=2))
    ORDER BY CASE WHEN i.inventory_tracking=true AND COALESCE(s.quantity,0)<=0 AND COALESCE(r.sales_count,0)>=2 THEN 0 WHEN i.inventory_tracking=true THEN 1 ELSE 2 END,COALESCE(r.sales_count,0) DESC,i.id LIMIT 12`);
          for (const f of facts) {
            const qty = Number(f.quantity),
              threshold = Number(f.low_stock_threshold),
              count = Number(f.sales_count),
              known = f.inventory_tracking;
            // Two distinct posted bills in the last 30 days; never a single sale.
            // Saved item configuration and commercial feature access take precedence.
            const family=preset.family, contextual=!known&&count>=2&&can('inventory.write')
              ? (['CLOTHING','FOOTWEAR'].includes(family)&&feature('VARIANTS')&&!f.has_variants
                  ? {label:family==='FOOTWEAR'?'Set Up Sizes':'Set Up Sizes & Colours',question:family==='FOOTWEAR'?'Does it have different sizes?':'Does it have different sizes or colours?',section:'item-size-setup'}
                  : ['PHARMACY','HARDWARE','STATIONERY'].includes(family)&&feature('MULTI_UNIT')&&Number(f.unit_count)===0
                  ? {label:'Set Up Units',question:'Do you buy and sell it in different packs or units?',section:'item-unit-setup'}
                  : family==='ELECTRONICS'&&feature('SERIAL_TRACKING')&&!f.track_serial&&/phone|mobile|laptop|television/i.test(f.name)
                  ? {label:'Set Up Serial & Warranty',question:'Would serial numbers and warranty help for this item?',section:'item-context-tracking'}
                  : family==='EATERY'&&feature('MODIFIERS')&&Number(f.modifier_count)===0
                  ? {label:'Set Up Options',question:'Any options or add-ons for this item?',section:'item-modifier-setup'} : null) : null;
            if(contextual){
              add({id:'enrich:'+f.id,kind:'REPEATED_MINIMAL_ITEM',category:'IMPROVE_DATA',tone:'special',title:f.name+' is selling regularly',description:'Sold on '+count+' posted bills. '+contextual.question,why:'This item appeared on '+count+' distinct posted bills in this branch in the last 30 days. Stock is not configured. This optional suggestion uses saved records, not an estimate.',action:{label:contextual.label,path:'/retail/items/'+f.id+'#'+contextual.section},score:470,facts:{sales_count:count,threshold:2}});
              continue;
            }
            if (known && qty <= threshold) {
              const fast = qty <= 0 && count >= 2;
              add({
                id: 'stock:' + f.id,
                kind: fast ? 'OUT_OF_STOCK_FAST_MOVER' : 'LOW_STOCK',
                category: 'DONT_MISS',
                tone: qty <= 0 ? 'danger' : 'warning',
                title:
                  qty <= 0
                    ? f.name + ' is out of stock'
                    : f.name + ' is low in stock',
                description:
                  qty +
                  ' ' +
                  f.unit +
                  ' recorded · minimum ' +
                  threshold +
                  ' ' +
                  f.unit +
                  '.',
                why:
                  'The stock ledger for this branch records ' +
                  qty +
                  ' ' +
                  f.unit +
                  '. The item minimum is ' +
                  threshold +
                  '. It appeared on ' +
                  count +
                  ' posted bills in the last 30 days.',
                action: {
                  label:
                    can('inventory.write') && feature('NEED_LIST')
                      ? 'Add to buying list'
                      : 'Review stock',
                  path:
                    can('inventory.write') && feature('NEED_LIST')
                      ? '/retail/needs?name=' + encodeURIComponent(f.name)
                      : '/retail/items/' + f.id,
                },
                score: fast ? 960 : qty <= 0 ? 850 : 800,
                critical: fast,
                facts: {
                  quantity: qty,
                  minimum: threshold,
                  unit: f.unit,
                  sales_count: count,
                },
              });
            } else {
              if (
                known &&
                !(can('reports.read') && feature('PROFIT_REPORTING'))
              )
                continue;
              const cost =
                can('reports.read') &&
                feature('PROFIT_REPORTING') &&
                (Number(f.unknown_quantity) > 0 ||
                  (!known && Number(f.unknown_lines) > 0));
              add({
                id: 'enrich:' + f.id,
                kind: cost
                  ? 'UNKNOWN_COST_FREQUENT_ITEM'
                  : 'UNKNOWN_STOCK_FREQUENT_ITEM',
                category: 'IMPROVE_DATA',
                tone: 'info',
                title: cost
                  ? 'Record the next purchase for ' + f.name
                  : 'Count stock for ' + f.name,
                description: cost
                  ? 'Exact profit is incomplete for this frequently sold item.'
                  : 'This item is selling, but its stock has not been set up.',
                why:
                  'It appeared on ' +
                  count +
                  ' posted bills in the last 30 days. ' +
                  (cost
                    ? 'The item has incomplete cost coverage. A real purchase establishes future cost; past bill snapshots are kept.'
                    : 'Stock tracking is off, so the app does not claim a zero balance.'),
                action: {
                  label:
                    can('purchase.write') && feature('PURCHASING')
                      ? cost?'Record purchase':'Set Up Stock'
                      : 'Review item',
                  path:
                    can('purchase.write') && feature('PURCHASING')
                      ? '/retail/purchases/new?item=' + f.id
                      : '/retail/items/' + f.id,
                },
                score: 430,
                facts: { sales_count: count },
              });
            }
          }
        })(),
      );
    if(can('inventory.read')&&feature('VARIANTS'))jobs.push((async()=>{
      const variants=await this.db.$queryRaw<any[]>(Prisma.sql`SELECT v.id,v.item_id,v.attributes,i.name,u.code unit,SUM(s.quantity) quantity FROM stock_balance_projection s JOIN item_variants v ON v.id=s.variant_id JOIN items i ON i.id=v.item_id JOIN units u ON u.id=i.primary_unit_id WHERE s.company_id=${scope.company_id}::uuid AND s.branch_id=${scope.branch_id}::uuid AND i.company_id=${scope.company_id}::uuid AND i.is_active=true AND i.has_variants=true AND v.is_active=true GROUP BY v.id,i.name,u.code HAVING SUM(s.quantity)<=0 ORDER BY v.id LIMIT 3`);
      for(const v of variants)add({id:'variant-stock:'+v.id,kind:'VARIANT_OUT_OF_STOCK',category:'DONT_MISS',tone:'warning',title:v.name+' · '+Object.values(v.attributes||{}).join(' / '),description:'This size or colour has no recorded stock remaining.',why:'The stock ledger for this branch and this exact variant records '+Number(v.quantity)+' '+v.unit+'. Other sizes keep their own variant balances in the same inventory engine.',action:{label:'Restock this size',path:'/retail/purchases/new?item='+v.item_id},score:820,facts:{quantity:Number(v.quantity),unit:v.unit}});
    })());
    if (can('inventory.read') && feature('BATCH_TRACKING'))
      jobs.push(
        (async () => {
          const batches = await this.db.$queryRaw<
            any[]
          >(Prisma.sql`SELECT b.id,b.item_id,b.batch_number,b.expiry_date,i.name,u.code unit,SUM(s.quantity) quantity FROM item_batches b JOIN items i ON i.id=b.item_id AND i.company_id=b.company_id JOIN units u ON u.id=i.primary_unit_id JOIN stock_balance_projection s ON s.batch_id=b.id AND s.item_id=i.id AND s.company_id=b.company_id
    WHERE b.company_id=${scope.company_id}::uuid AND s.branch_id=${scope.branch_id}::uuid AND i.is_active=true AND i.track_batch=true AND b.expiry_date<=${endExpiry}::date GROUP BY b.id,i.name,u.code HAVING SUM(s.quantity)>0 ORDER BY b.expiry_date,b.id LIMIT 3`);
          for (const b of batches) {
            const expired = new Date(b.expiry_date) < date,
              expiry = new Date(b.expiry_date).toISOString().slice(0, 10);
            add({
              id: 'batch:' + b.id,
              kind: expired ? 'EXPIRED_BATCH' : 'EXPIRING_BATCH',
              category: 'DONT_MISS',
              tone: expired ? 'danger' : 'warning',
              title:
                b.name + (expired ? ' has expired stock' : ' expires soon'),
              description:
                'Batch ' +
                b.batch_number +
                ' · ' +
                Number(b.quantity) +
                ' ' +
                b.unit +
                ' · ' +
                expiry,
              why:
                'The selected branch has positive recorded stock in this batch. Its saved expiry date is ' +
                expiry +
                '. This is a stock reminder, not a regulatory assessment.',
              action: {
                label: 'Review batch',
                path: '/retail/items/' + b.item_id,
              },
              score: expired ? 1000 : 920,
              critical: expired,
              facts: { quantity: Number(b.quantity), expiry, unit: b.unit },
            });
          }
        })(),
      );
    if (can('inventory.read') && feature('NEED_LIST'))
      jobs.push(
        (async () => {
          const count = await this.db.needList.count({
            where: {
              company_id: scope.company_id,
              OR: [{ branch_id: scope.branch_id }, { branch_id: null }],
              status: { in: ['NEED', 'ORDERED'] },
            },
          });
          if (count)
            add({
              id: 'needs-pending',
              kind: 'NEED_LIST_PENDING',
              category: 'DO_NOW',
              tone: 'warning',
              title: 'Your buying list is waiting',
              description: count + ' saved needs are still open.',
              why: 'These entries are marked To buy or Ordered in your shop buying list. Received and cancelled entries are excluded.',
              action: { label: 'Open buying list', path: '/retail/needs' },
              score: 600,
              facts: { count },
            });
        })(),
      );
    if (can('accounting.read') && feature('KHATA'))
      jobs.push(
        this.partyDue(
          scope.company_id,
          'CUSTOMER',
          can('accounting.write'),
        ).then((r) => {
          if (r) add(r);
        }),
      );
    if (can('purchase.read') && feature('PURCHASING'))
      jobs.push(
        this.partyDue(scope.company_id, 'SUPPLIER', can('purchase.write')).then(
          (r) => {
            if (r) add(r);
          },
        ),
      );
    if (can('accounting.read') && feature('DAILY_GALLA') && sales > 0)
      jobs.push(
        (async () => {
          try {
            const g = await this.counter.galla(
              scope.company_id,
              scope.branch_id,
              today,
            );
            if (g.difference !== null && Math.abs(g.difference) >= 0.01)
              add({
                id: 'galla:' + today,
                kind: 'GALLA_MISMATCH',
                category: 'DO_NOW',
                tone: 'danger',
                title: 'Counter cash needs review',
                description:
                  'Counted cash differs by ' +
                  money(Math.abs(g.difference)) +
                  '.',
                why:
                  'Daily Galla compares the saved cash count with actual posted cash movements. ' +
                  g.status.toLowerCase() +
                  ' by ' +
                  money(Math.abs(g.difference)) +
                  '.',
                action: { label: 'Review Daily Galla', path: '/retail/galla' },
                score: 970,
                critical: true,
                facts: {
                  difference: g.difference,
                  expected_cash: g.expected_cash,
                  actual_cash: g.actual_cash!,
                },
              });
          } catch {
            /* No amount or discrepancy is invented when an older ledger cannot be summarized. */
          }
        })(),
      );
    await Promise.all(jobs);
    return {
      maturity,
      activity: {
        sales,
        purchases,
        items: itemCount,
        customers: customerCount,
      },
      business_preset: preset,
      personalization_missing: !organization.business_type,
      can: {
        sell: can('sales.write'),
        buy: can('purchase.write') && feature('PURCHASING'),
        receive: can('accounting.write') && feature('KHATA'),
        manageItems: can('inventory.write') && feature('INVENTORY'),
      },
      suggestions: rankRecommendations(
        rows,
        preset.recommendationPriority,
        dismissed,
      ),
      as_of: new Date().toISOString(),
      source_window_days: 30,
    };
  }
  private async partyDue(
    companyId: string,
    type: 'CUSTOMER' | 'SUPPLIER',
    write: boolean,
  ): Promise<Recommendation | null> {
    const [p] = await this.db.$queryRaw<any[]>(
      Prisma.sql`SELECT p.id,p.name,SUM(CASE WHEN a.allocation_type='NEW_REFERENCE' THEN a.amount WHEN a.allocation_type='AGAINST_REFERENCE' THEN -a.amount ELSE 0 END) balance FROM parties p JOIN bill_allocations a ON a.party_id=p.id AND a.company_id=p.company_id WHERE p.company_id=${companyId}::uuid AND p.party_type=${type} AND p.is_active=true AND p.is_walkin=false GROUP BY p.id HAVING SUM(CASE WHEN a.allocation_type='NEW_REFERENCE' THEN a.amount WHEN a.allocation_type='AGAINST_REFERENCE' THEN -a.amount ELSE 0 END)>0 ORDER BY balance DESC,p.id LIMIT 1`,
    );
    if (!p) return null;
    const customer = type === 'CUSTOMER';
    return {
      id: 'due:' + p.id,
      kind: customer ? 'CUSTOMER_DUE' : 'SUPPLIER_DUE',
      category: 'DO_NOW',
      tone: customer ? 'danger' : 'info',
      title: customer
        ? p.name + ' has a pending balance'
        : 'Payment pending for ' + p.name,
      description: money(p.balance) + (customer ? ' to receive.' : ' to pay.'),
      why:
        'This is the current reference-allocation balance shown in ' +
        (customer ? 'Customer' : 'Supplier') +
        ' Khata for this shop, including recorded payments. A pending balance alone does not mean it is overdue.',
      action: {
        label: customer
          ? 'Review customer due'
          : write
            ? 'Pay supplier'
            : 'Review supplier due',
        path: customer
          ? '/retail/khata/' + p.id
          : write
            ? '/retail/suppliers/' + p.id + '/pay'
            : '/retail/suppliers/' + p.id,
      },
      score: customer ? 730 : 720,
      critical: false,
      facts: { amount: Number(p.balance) },
    };
  }
}
