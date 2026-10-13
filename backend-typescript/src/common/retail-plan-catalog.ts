/** Fixed launch defaults. Tenant overrides and rollout/configuration remain authoritative for exceptional access. */
export const RETAIL_FEATURES = {
  RETAIL_POS: ['Retail POS','Daily Business','Create bills and record Cash, UPI or Udhar.','STARTER',true],
  SALES: ['Sales','Daily Business','Keep your bills and sales history.','STARTER',true],
  KHATA: ['Khata','Daily Business','Track customer and supplier dues.','STARTER',true],
  PURCHASING: ['Purchases','Daily Business','Buy stock and record supplier payments.','STARTER',true],
  EXPENSES: ['Expenses','Daily Business','Record business expenses and owner withdrawals.','STARTER',true],
  DAILY_GALLA: ['Daily Galla','Daily Business','See real money received and expected counter cash.','STARTER',true],
  NEED_LIST: ['Need List','Daily Business','Remember stock you need to order.','STARTER',true],
  INVENTORY: ['Inventory','Inventory','Manage items, basic units and counted stock.','STARTER',true],
  SERVICES: ['Services','Inventory','Bill services without physical stock.','STARTER',true],
  VARIANTS: ['Variants','Inventory','Manage sizes, colours and other item choices.','SMART',false],
  MULTI_UNIT: ['Multiple Units','Inventory','Buy and sell in box, packet, strip or piece.','SMART',false],
  WEIGHT: ['Weight Selling','Inventory','Sell by gram, kilogram or other weight units.','SMART',false],
  VOLUME: ['Volume Selling','Inventory','Sell by litre, millilitre or other volume units.','SMART',false],
  LENGTH: ['Length Selling','Inventory','Sell by metre, foot or other length units.','SMART',false],
  AREA: ['Area Selling','Inventory','Sell by square foot or other area units.','SMART',false],
  BATCH_TRACKING: ['Batch & Expiry','Inventory','Track lots, expiry and first-expiring stock.','SMART',false],
  BUNDLES: ['Bundles','Inventory','Sell a kit while tracking its components.','SMART',false],
  MODIFIERS: ['Modifiers','Inventory','Offer add-ons and item customisation.','SMART',false],
  WASTAGE: ['Stock Wastage','Inventory','Record damaged or wasted stock.','SMART',false],
  MULTIPLE_STOCK_LOCATIONS: ['Stock Locations','Inventory','Additional shops, stock locations and transfers are reserved for Future Premium.','FUTURE_PREMIUM',false],
  SERIAL_TRACKING: ['Serial & Warranty','Inventory','Track serial numbers and warranties.','PRO',false],
  COMPATIBILITY: ['Compatibility','Inventory','Record models and compatible products.','PRO',false],
  ACCOUNTING: ['Accounting','Reports & Money','Keep balanced, authoritative financial records.','STARTER',true],
  REPORTS: ['Basic Reports','Reports & Money','Review sales, purchases, dues and stock.','STARTER',true],
  GST_INVOICES: ['GST Invoices','Reports & Money','Prepare GST invoices with statutory safety checks.','SMART',false],
  PROFIT_REPORTING: ['Profit & COGS','Reports & Money','Review known costs, margins and business profit.','SMART',false],
  ADVANCED_REPORTS: ['Advanced Reports','Reports & Money','Legacy label. Operational reports, profit and insights use their own capabilities.','LEGACY',false],
  ADVANCED_PRICING: ['Advanced Pricing','Reports & Money','Manage price levels and customer-specific prices.','PRO',false],
  ASSISTANT_TEXT: ['Text Ask Apna Galla','Apna Galla Assistant','Ask simple business questions in text.','STARTER',true],
  BUSINESS_INSIGHTS: ['Business Insights','Apna Galla Assistant','Understand why sales, profit or dues changed.','SMART',false],
  ASSISTANT_VOICE: ['Voice Assistant','Apna Galla Assistant','Coming soon. Voice is not included in the current launch plans.','FUTURE',false],
  STAFF: ['Staff','Team & Data','Give staff their own accounts, within your plan limit.','SMART',false],
  ADVANCED_STAFF: ['Advanced Staff Controls','Team & Data','Manage custom roles and permissions.','PRO',false],
  ITEM_IMAGES: ['Item Photos','Team & Data','Add photos to your item catalog.','SMART',false],
  BACKUP: ['Data Backup','Team & Data','Backup service access is included in paid plans. Protection requires a configured provider, successful backups and restore checks.','STARTER',true],
  EXPORT_ITEMS: ['Item Master Export','Team & Data','Download your item master CSV.','STARTER',true],
  EXPORT_STOCK: ['Stock Export','Team & Data','Download a current stock report.','STARTER',true],
  EXPORT_SALES: ['Sales Export','Team & Data','Download basic sales report data.','STARTER',true],
  EXPORT_CUSTOMERS: ['Customer Export','Team & Data','Download customer dues and details.','SMART',true],
  EXPORT_SUPPLIERS: ['Supplier Export','Team & Data','Download supplier dues and details.','SMART',true],
  EXPORT_KHATA: ['Khata Export','Team & Data','Download the selected party ledger.','SMART',true],
  EXPORT_PURCHASES: ['Purchase Export','Team & Data','Download purchase report data.','SMART',true],
  EXPORT_EXPENSES: ['Expense Export','Team & Data','Download expense report data.','SMART',true],
  EXPORT_GST: ['GST Export','Team & Data','Download issued GST invoice records.','SMART',true],
  EXPORT_PROFIT: ['Profit Export','Team & Data','Download authoritative profit report data.','SMART',true],
  EXPORT_STAFF: ['Staff Export','Team & Data','Download staff directory without credentials.','PRO',true],
  EXPORT_LOCATIONS: ['Stock Location Export','Team & Data','Location exports are reserved for Future Premium.','FUTURE_PREMIUM',true],
  EXPORT_DOCUMENTS: ['Document Metadata Export','Team & Data','Download attachment metadata. File archive is not implemented.','PRO',true],
  EXPORT_FULL_BUSINESS: ['Complete Business Export','Team & Data','Download business records. Attachment files are downloaded separately.','PRO',true],
  EXPORT_SCHEDULED: ['Scheduled Export','Team & Data','Not implemented. Reserved for future automation packaging.','FUTURE_PREMIUM',true],
} as const;
export type RetailFeatureCode = keyof typeof RETAIL_FEATURES;
export const PLAN_ORDER = ['STARTER','SMART','PRO'] as const;
export type LaunchPlanCode = typeof PLAN_ORDER[number];
export const LAUNCH_PLAN_REVISION = 'APNA_GALLA_LAUNCH_PLANS_V2';
export const RETAIL_PLAN_DEFAULTS = [
  {code:'STARTER',name:'Apna Galla Starter',monthly_price:75,description:'Run your shop',limits:{users:1,staff:0,devices:2,branches:1,stock_locations:1,companies:1}},
  {code:'SMART',name:'Apna Galla Smart',monthly_price:120,description:'Run it better. Understand your business.',limits:{users:3,staff:2,devices:5,branches:1,stock_locations:1,companies:1}},
  {code:'PRO',name:'Apna Galla Pro',monthly_price:210,description:'Advanced Control',limits:{users:6,staff:5,devices:10,branches:1,stock_locations:1,companies:1}},
];
export function featureMetadata(code:string) {
  const row=RETAIL_FEATURES[code as RetailFeatureCode];
  const commercial_state = row?.[3]==='FUTURE_PREMIUM'?'FUTURE_PREMIUM':row?.[3]==='FUTURE'||code==='ADVANCED_PRICING'?'COMING_SOON':row?.[3]==='LEGACY'?'LEGACY':code==='COMPATIBILITY'?'PARTIAL':'AVAILABLE';
  return row ? {name:row[0],group:row[1],description:row[2],required_plan:PLAN_ORDER.includes(row[3] as LaunchPlanCode)?row[3] as LaunchPlanCode:null,commercial_state,core:row[4],default_shop_enabled:true}
    : {group:'Team & Data',description:'Capability managed by your operator.',required_plan:null,commercial_state:'LEGACY',core:false,default_shop_enabled:true};
}
export function defaultPlanFeatures(code:string) {
  const rank=PLAN_ORDER.indexOf(code as LaunchPlanCode);
  if(rank<0)return [];
  return Object.entries(RETAIL_FEATURES).filter(([,row])=>{
    const minimum=PLAN_ORDER.indexOf(row[3] as LaunchPlanCode);
    return minimum>=0&&minimum<=rank;
  }).map(([key])=>key);
}
