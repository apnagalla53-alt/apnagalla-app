import { RETAIL_UNITS } from '../retail/retail-units';
/** Presentation recommendations only. Never enable shop features or change saved item units. */
export type CategoryPreset = {
  name: string;
  units: string[];
  capabilities?: string[];
};
export type BusinessPreset = {
  family: string;
  intakeOrder: string[];
  voiceExample: string;
  key: string;
  displayName: string;
  recommendedUnits: string[];
  unitSuggestions: { code: string; name: string; selling_mode: string }[];
  recommendedCategories: CategoryPreset[];
  recommendedCapabilities: string[];
  itemPrompts: {
    variants: string;
    multiUnit: string;
    batch: string;
    measured: string;
  };
  defaultQuickActions: string[];
  terminology: { item: string; supplier: string };
  homePriority: string[];
  recommendationPriority: string[];
};
type Definition = {
  units: string[];
  categories: CategoryPreset[];
  actions?: string[];
  priority?: string[];
  variants?: string;
};
const c = (
  name: string,
  units: string[],
  capabilities?: string[],
): CategoryPreset => ({
  name,
  units,
  ...(capabilities ? { capabilities } : {}),
});
const generic: Definition = {
  units: ['PCS', 'PKT', 'BOX', 'KG', 'LTR'],
  categories: [
    c('Everyday goods', ['PCS', 'PKT', 'BOX']),
    c('Services', ['JOB', 'HOUR']),
  ],
};
const definitions: Record<string, Definition> = {
  GROCERY: {
    units: ['PCS', 'PKT', 'BOX', 'KG', 'GM', 'LTR', 'ML', 'BOTTLE'],
    categories: [
      c('Rice / Grains', ['KG', 'GM', 'SACK']),
      c('Biscuits / Packaged Food', ['PKT', 'BOX', 'PCS']),
      c('Oil & Ghee', ['LTR', 'ML', 'BOTTLE', 'CAN']),
      c('Spices & Staples', ['PKT', 'GM', 'KG']),
      c('Household essentials', ['PCS', 'PKT', 'BOX']),
    ],
    priority: [
      'LOW_STOCK',
      'OUT_OF_STOCK_FAST_MOVER',
      'NEED_LIST_PENDING',
      'SUPPLIER_DUE',
      'CUSTOMER_DUE',
    ],
  },
  GENERAL: generic,
  SUPERMARKET: {
    units: ['PCS', 'PKT', 'BOX', 'KG', 'GM', 'LTR', 'ML', 'BOTTLE'],
    categories: [
      c('Grocery & Staples', ['KG', 'PKT', 'PCS']),
      c('Packaged Food', ['PKT', 'BOX', 'PCS']),
      c('Personal Care', ['PCS', 'BOTTLE', 'TUBE']),
      c('Dairy', ['LTR', 'ML', 'PCS'], ['BATCH_TRACKING']),
    ],
  },
  PRODUCE: {
    units: ['KG', 'GM', 'PCS', 'PETI'],
    categories: [
      c('Vegetables', ['KG', 'GM', 'PCS']),
      c('Fruits', ['KG', 'PCS', 'PETI']),
    ],
    priority: ['LOW_STOCK', 'NEED_LIST_PENDING', 'UNKNOWN_COST_FREQUENT_ITEM'],
  },
  DAIRY: {
    units: ['LTR', 'ML', 'PCS', 'PKT', 'BOTTLE'],
    categories: [
      c('Milk', ['LTR', 'ML', 'PKT'], ['BATCH_TRACKING']),
      c('Dairy products', ['KG', 'GM', 'PKT'], ['BATCH_TRACKING']),
    ],
    priority: ['EXPIRED_BATCH', 'EXPIRING_BATCH', 'LOW_STOCK'],
  },
  PHARMACY: {
    units: ['TABLET', 'PCS', 'STRIP', 'BOX', 'BOTTLE', 'TUBE', 'SACHET', 'ML'],
    categories: [
      c('Medicines', ['STRIP', 'BOX', 'PCS'], ['BATCH_TRACKING', 'MULTI_UNIT']),
      c('Syrups', ['BOTTLE', 'ML'], ['BATCH_TRACKING']),
      c('Ointments', ['TUBE', 'PCS'], ['BATCH_TRACKING']),
      c('Health essentials', ['PCS', 'BOX']),
    ],
    priority: ['EXPIRED_BATCH', 'EXPIRING_BATCH', 'LOW_STOCK', 'SUPPLIER_DUE'],
  },
  BAKERY: {
    units: ['PCS', 'KG', 'GM', 'BOX', 'PKT'],
    categories: [
      c('Bakery products', ['PCS', 'PKT'], ['BATCH_TRACKING']),
      c('Sweets', ['KG', 'GM', 'BOX']),
    ],
    priority: ['EXPIRED_BATCH', 'EXPIRING_BATCH', 'LOW_STOCK'],
  },
  EATERY: {
    units: ['PCS', 'PLATE', 'CUP', 'GLASS', 'KG'],
    categories: [
      c('Food', ['PLATE', 'PCS']),
      c('Tea & drinks', ['CUP', 'GLASS']),
    ],
  },
  STATIONERY: {
    units: ['PCS', 'PACK', 'BOX', 'SET', 'DZ', 'REAM'],
    categories: [
      c('Notebooks & Paper', ['PCS', 'REAM', 'PKT']),
      c('Pens & Supplies', ['PCS', 'BOX', 'DZ']),
    ],
  },
  ELECTRONICS: {
    units: ['PCS', 'SET', 'BOX'],
    categories: [
      c('Mobiles & Devices', ['PCS'], ['SERIAL_TRACKING']),
      c('Accessories', ['PCS', 'BOX']),
      c('Repairs', ['JOB'], ['SERVICES']),
    ],
  },
  HARDWARE: {
    units: ['PCS', 'BOX', 'KG', 'GM', 'MTR', 'FT', 'ROLL', 'SHEET'],
    categories: [
      c('Tools & Fasteners', ['PCS', 'BOX', 'KG']),
      c('Cable & Wire', ['MTR', 'FT', 'ROLL'], ['LENGTH', 'MULTI_UNIT']),
      c('Sheets & Panels', ['SHEET', 'SQFT', 'SQM'], ['AREA']),
    ],
    priority: [
      'LOW_STOCK',
      'SUPPLIER_DUE',
      'UNKNOWN_COST_FREQUENT_ITEM',
      'UNKNOWN_STOCK_FREQUENT_ITEM',
    ],
  },
  CLOTHING: {
    units: ['PCS', 'SET', 'PAIR'],
    categories: [
      c('Clothing', ['PCS', 'SET'], ['VARIANTS']),
      c('Accessories', ['PCS', 'PAIR']),
    ],
    variants: 'Does this item have different sizes or colours?',
    priority: [
      'OUT_OF_STOCK_FAST_MOVER',
      'LOW_STOCK',
      'UNKNOWN_STOCK_FREQUENT_ITEM',
      'UNKNOWN_COST_FREQUENT_ITEM',
    ],
  },
  FOOTWEAR: {
    units: ['PAIR', 'PCS', 'BOX'],
    categories: [
      c('Footwear', ['PAIR', 'BOX'], ['VARIANTS']),
      c('Shoe care', ['PCS', 'BOTTLE']),
    ],
    variants: 'Does this item have different sizes?',
    priority: [
      'OUT_OF_STOCK_FAST_MOVER',
      'LOW_STOCK',
      'UNKNOWN_STOCK_FREQUENT_ITEM',
    ],
  },
  BEAUTY: {
    units: ['PCS', 'BOTTLE', 'TUBE', 'BOX', 'ML'],
    categories: [
      c('Cosmetics', ['PCS', 'BOX'], ['VARIANTS']),
      c('Skin & Hair Care', ['BOTTLE', 'TUBE', 'ML'], ['BATCH_TRACKING']),
    ],
  },
  SALON: {
    units: ['JOB', 'PCS', 'HOUR', 'BOTTLE'],
    categories: [
      c('Salon services', ['JOB', 'HOUR'], ['SERVICES']),
      c('Care products', ['BOTTLE', 'PCS']),
    ],
    actions: ['bill', 'receive', 'expenses', 'calendar', 'suppliers'],
  },
  OPTICAL: {
    units: ['PCS', 'PAIR', 'SET', 'BOX'],
    categories: [
      c('Frames', ['PCS'], ['VARIANTS']),
      c('Lenses', ['PAIR', 'PCS']),
      c('Eye care', ['BOTTLE', 'PCS']),
    ],
  },
  AUTO_PARTS: {
    units: ['PCS', 'SET', 'PAIR', 'BOX', 'LTR'],
    categories: [
      c('Spare parts', ['PCS', 'SET'], ['COMPATIBILITY', 'VARIANTS']),
      c('Oil & Maintenance', ['LTR', 'BOTTLE', 'PCS']),
    ],
  },
  OTHER: generic,
};
const aliases: Record<string, string> = {
  KIRANA_GROCERY: 'GROCERY',
  KIRANA: 'GROCERY',
  GENERAL_STORE: 'GENERAL',
  MINI_SUPERMARKET: 'SUPERMARKET',
  LARGE_SUPERMARKET: 'SUPERMARKET',
  VEGETABLES_FRUITS: 'PRODUCE',
  BAKERY_SWEETS: 'BAKERY',
  SMALL_EATERY: 'EATERY',
  RESTAURANT: 'EATERY',
  BEVERAGES: 'EATERY',
  MOBILE_ELECTRONICS: 'ELECTRONICS',
  COMPUTERS: 'ELECTRONICS',
  COMPUTER_ACCESSORIES: 'ELECTRONICS',
  MOBILE_REPAIR: 'ELECTRONICS',
  ELECTRONICS_REPAIR: 'ELECTRONICS',
  HARDWARE_ELECTRICAL: 'HARDWARE',
  ELECTRICAL: 'HARDWARE',
  PLUMBING: 'HARDWARE',
  TOOLS: 'HARDWARE',
  PLYWOOD: 'HARDWARE',
  GLASS_ALUMINIUM: 'HARDWARE',
  TILES: 'HARDWARE',
  GARMENTS: 'CLOTHING',
  BOUTIQUE: 'CLOTHING',
  INNERWEAR: 'CLOTHING',
  KIDS_WEAR: 'CLOTHING',
  BAGS: 'CLOTHING',
  COSMETICS_BEAUTY: 'BEAUTY',
  AUTO_SPARES: 'AUTO_PARTS',
  TWO_WHEELER_PARTS: 'AUTO_PARTS',
  CAR_ACCESSORIES: 'AUTO_PARTS',
  AUTOMOTIVE: 'AUTO_PARTS',
  MEAT: 'PRODUCE',
};
export function businessPreset(
  code?: string | null,
  displayName?: string,
  capabilities: readonly string[] = [],
): BusinessPreset {
  const stable = (code || 'OTHER').trim().toUpperCase(),
    key = aliases[stable] || stable,
    d = definitions[key] || generic;
  return {
    family: key,
    intakeOrder:
      key === 'CLOTHING' || key === 'FOOTWEAR'
        ? ['EXCEL', 'SUPPLIER_BILL_IMAGE', 'SHARED_DOCUMENT', 'VOICE']
        : key === 'PHARMACY'
          ? ['SUPPLIER_BILL_IMAGE', 'EXCEL', 'SHARED_DOCUMENT', 'VOICE']
          : ['SUPPLIER_BILL_IMAGE', 'EXCEL', 'VOICE', 'SHARED_DOCUMENT'],
    voiceExample:
      key === 'HARDWARE'
        ? 'PVC pipe 20 metre price 180 rupees'
        : key === 'PHARMACY'
          ? 'ORS sachet 50 packet selling price 20 rupees'
          : 'Biscuit 20 packet price 14 rupees',
    key: stable,
    displayName: displayName || 'Your shop',
    recommendedUnits: d.units,
    unitSuggestions: d.units.flatMap((code) => {
      const u = RETAIL_UNITS.find((u) => u.code === code);
      return u ? [u] : [];
    }),
    recommendedCategories: d.categories,
    recommendedCapabilities: [...capabilities],
    itemPrompts: {
      variants: d.variants || 'Different sizes or colours?',
      multiUnit: 'Buy and sell in different packs?',
      batch: 'Track batch & expiry?',
      measured: 'How do you sell this item?',
    },
    defaultQuickActions: d.actions || [
      'purchases',
      'receive',
      'needs',
      'suppliers',
      'expenses',
    ],
    terminology: { item: 'Item', supplier: 'Supplier' },
    homePriority: ['bill', 'purchases', 'receive'],
    recommendationPriority: d.priority || [
      'LOW_STOCK',
      'CUSTOMER_DUE',
      'SUPPLIER_DUE',
      'NEED_LIST_PENDING',
      'UNKNOWN_COST_FREQUENT_ITEM',
    ],
  };
}
