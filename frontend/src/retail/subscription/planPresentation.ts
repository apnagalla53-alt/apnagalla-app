// Presentation only. Prices, assignments and effective access come from the API.
export const planHighlights:Record<string,string[]>={
  STARTER:['Billing & Inventory','Customer & Supplier Khata','Purchases & Expenses','Daily Galla','Basic Reports','Text Ask Apna Galla','Items, Stock & Sales Export'],
  SMART:['Everything in Starter','Item Photos','GST Invoices','Profit & COGS','Business Insights','Advanced Inventory','2 Staff Accounts','Better Reports & Exports'],
  PRO:['Everything in Smart','Serial & Warranty','Advanced Staff Controls','5 Staff Accounts','Complete Business Export'],
};
export const planPosition:Record<string,string>={STARTER:'Run your shop',SMART:'Run it better. Understand your business.',PRO:'Advanced Control'};
export const featureGroups=['Daily Business','Inventory','Reports & Money','Apna Galla Assistant','Team & Data'];
export const launchPlanCodes=['STARTER','SMART','PRO'];
export const planName=(code:string|undefined)=>launchPlanCodes.includes(code||'')?'Apna Galla '+code![0]+code!.slice(1).toLowerCase():'Existing account';
export type FeatureAvailability='AVAILABLE'|'PARTIAL'|'COMING_SOON'|'FUTURE_PREMIUM'|'LEGACY';
export function featureAvailability(feature:{code:string;commercial_state?:string}):FeatureAvailability {
  if(['MULTIPLE_STOCK_LOCATIONS','EXPORT_LOCATIONS','EXPORT_SCHEDULED'].includes(feature.code))return 'FUTURE_PREMIUM';
  if(['ASSISTANT_VOICE','ADVANCED_PRICING'].includes(feature.code))return 'COMING_SOON';
  if(feature.code==='ADVANCED_REPORTS')return 'LEGACY';
  if(feature.code==='COMPATIBILITY')return 'PARTIAL';
  return (feature.commercial_state as FeatureAvailability)||'AVAILABLE';
}
