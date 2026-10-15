import type { CSSProperties } from 'react';
import { Banknote, BookOpen, CalendarDays, ChartNoAxesCombined, CheckCircle, CircleDollarSign, Download, House, Package, Receipt, Settings, Shield, Sparkles, Truck, Undo2, UsersRound, Zap, type LucideIcon } from 'lucide-react';

const palettes={
  home:['#176b63','#e4f1ed','#f7faf8','#8fd9ce','#213e38','#121c19'],
  quick:['#9a4b00','#fff0d5','#fffbf3','#ffce83','#422e14','#20190f'],
  billing:['#1d4ed8','#e8efff','#f7f9ff','#adc6ff','#233354','#131b2c'],
  stock:['#0f766e','#dff5f1','#f3faf8','#8ee0d3','#1e3d38','#101e1c'],
  purchase:['#6d28d9','#f0e8ff','#faf7ff','#ccb2ff','#35264f','#1d172b'],
  khata:['#a13d0a','#ffeddf','#fff8f3','#ffc098','#432b1e','#211911'],
  money:['#9a3412','#ffeddf','#fff8f3','#ffbe9c','#432b1e','#211911'],
  expense:['#9f1239','#ffe8ef','#fff8fa','#ffb2c8','#462330','#25151b'],
  reports:['#1e3a8a','#e8edfb','#f6f8fd','#b9ccff','#25304b','#151c2b'],
  calendar:['#7e22ce','#f3e8ff','#fcf8ff','#ddb5ff','#3b254e','#21172c'],
  assistant:['#4338ca','#ecebff','#f8f8ff','#c4c0ff','#2e2b50','#1b1930'],
  settings:['#475569','#eef1f5','#f8f9fb','#c9d5e7','#2b3543','#19212b'],
  people:['#0e7490','#def5fa','#f5fbfd','#93dcef','#203c44','#142128'],
  data:['#155e75','#e0f2f7','#f6fbfd','#a5e0f0','#203d45','#14232a'],
  returns:['#9f1239','#ffe8ef','#fff8fa','#ffb2c8','#462330','#25151b'],
  complete:['#166534','#e4f6e9','#f5fcf7','#9ce2b0','#223d2b','#142219'],
  platform:['#334155','#eaf0f8','#f7f9fc','#c4d4ed','#28364c','#19222f'],
} as const;
export type WorkflowKey=keyof typeof palettes;
export type Workflow={key:WorkflowKey;family:string;title:string;hint:string;Icon:LucideIcon};
const flow=(key:WorkflowKey,family:string,title:string,hint:string,Icon:LucideIcon):Workflow=>({key,family,title,hint,Icon});
export function workflowFor(path:string):Workflow {
  if(path.startsWith('/platform/')){
    const section=path.split('/')[2],titles:Record<string,string>={dashboard:'Platform overview',tenants:'Manage shops',plans:'Plans',payments:'Subscriptions & revenue',revenue:'Revenue',expenses:'Platform expenses',users:'Platform users',sessions:'Devices & sessions',devices:'Devices & sessions',settings:'Platform settings',publishing:'Publishing',support:'Support',alerts:'Platform alerts',assistant:'Platform assistant',backups:'Backups',audit:'Audit log',infrastructure:'Infrastructure',database:'Database',health:'System health',features:'Features & rollout','account-policy':'Account & trial policy',referrals:'Referral program','activation-campaigns':'Demo activation codes','deletion-jobs':'Tenant erasure jobs'};
    const keys:Record<string,WorkflowKey>={tenants:'people',users:'people',sessions:'people',devices:'people',payments:'money',subscriptions:'money',revenue:'money',expenses:'expense',plans:'purchase',referrals:'purchase','activation-campaigns':'calendar',alerts:'returns','deletion-jobs':'returns',assistant:'assistant',backups:'data',audit:'reports',infrastructure:'data',database:'data',health:'stock',features:'settings',settings:'settings',publishing:'complete','account-policy':'settings',support:'people'};
    return flow(keys[section]||'platform','Platform administration',titles[section]||(section==='subscriptions'?'Subscriptions':'Manage platform'),'Platform changes affect the selected shops.',Shield);
  }
  if(path.endsWith('/print'))return flow('billing','Billing','Print receipt','Review the saved bill before printing.',Receipt);
  if(/\/(?:return|returns)(?:\/|$)/.test(path))return flow('returns','Returns','Sale return & refund','Review the original bill and returned quantity.',Undo2);
  if(path==='/retail/amount-sale')return flow('quick','Amount-only sale','Quick amount','Enter an amount, then collect the payment.',Zap);
  if(path==='/retail/quick-sale')return flow('quick','Quick Bill','Bill as you sell','Search an item or type a new one. Setup can wait.',Zap);
  if(path==='/retail/udhar')return flow('khata','Khata','Record Udhar','Choose a customer and record their credit.',BookOpen);
  if(path==='/retail/bill')return flow('billing','Item billing','Build an item bill','Add items and quantities, then review payment.',Receipt);
  if(path==='/retail/payment')return flow('billing','Item billing','Review & collect payment','Check the total and confirm money received.',Banknote);
  if(path==='/retail/sale-complete')return flow('complete','Sale complete','Bill saved','Your sale is recorded. Start another bill or return Home.',CheckCircle);
  if(path.startsWith('/retail/bills'))return flow('billing','Billing',path==='/retail/bills/held'?'Held bills':path==='/retail/bills'?'Bill history':'Saved bill details','View the saved sale, payment and outstanding balance.',Receipt);
  if(path.startsWith('/retail/gst'))return flow('billing','GST billing','GST invoice','Review tax details before preparing the invoice.',Receipt);
  if(path==='/retail/stock'||path.startsWith('/inventory/'))return flow('stock','Stock',path.includes('adjustments')?'Update stock':path.includes('transfers')?'Transfer stock':path.includes('movements')?'Stock movements':path.includes('barcodes')?'Barcode labels':'Stock overview','Review available stock and record actual changes.',Package);
  if(path==='/retail/items/add-faster')return flow('stock','Inventory','Add Items Faster','Review your bill, file or spoken items before saving.',Package);
  if(path.startsWith('/retail/items'))return flow('stock','Inventory',path.endsWith('/add')?'Add an item':path.endsWith('/bulk')?'Add many items':path==='/retail/items'?'Item directory':'Item details & stock','Manage selling prices, units and stock.',Package);
  if(path.startsWith('/retail/purchases'))return flow('purchase','Purchasing',path.endsWith('/new')?'Buy stock':'Purchase history','Record supplier bills and actual stock received.',Truck);
  if(path.startsWith('/retail/needs'))return flow('purchase','Purchasing','Buying list','Track what you need to order or receive.',Truck);
  if(path==='/retail/pay-supplier'||/^\/retail\/suppliers\/[^/]+\/pay$/.test(path))return flow('money','Supplier payment','Pay a supplier','Choose the supplier and confirm the amount paid.',Banknote);
  if(path==='/retail/receive-payment')return flow('money','Customer payment','Receive a payment','Record money received against customer dues.',Banknote);
  if(path.startsWith('/retail/suppliers'))return flow('purchase','Suppliers',path==='/retail/suppliers'?'Supplier directory':'Supplier ledger','Review purchases, payments and supplier dues.',Truck);
  if(path.startsWith('/retail/khata')||path==='/retail/customers/add')return flow('khata','Customers & Khata',path.endsWith('/add')?'Add a customer':path==='/retail/khata'?'Customer dues':'Customer ledger','Review Udhar, collections and outstanding balances.',BookOpen);
  if(path.startsWith('/retail/expenses'))return flow('expense','Expenses',path.endsWith('/add')?'Record money out':'Expense history','Keep expenses and owner withdrawals clear.',CircleDollarSign);
  if(path==='/retail/galla'||path.startsWith('/accounting/'))return flow('money','Money & accounts',path==='/retail/galla'?'Daily Galla':'Account records','Review cash, payments and your financial records.',Banknote);
  if(path.startsWith('/retail/reports'))return flow('reports','Reports & insights','Business reports','Review recorded sales, costs, profit and dues.',ChartNoAxesCombined);
  if(path==='/retail/calendar')return flow('calendar','Calendar','Shop calendar','Udhar sale dates, collections, supplier visits and tasks.',CalendarDays);
  if(path==='/retail/assistant')return flow('assistant','AI Assistant','Ask Apna Galla','Ask questions about your recorded shop activity.',Sparkles);
  if(path==='/retail/more/import'||path==='/retail/more/backup'||path==='/retail/more/documents')return flow('data','Shop data',path.endsWith('/import')?'Import your data':path.endsWith('/backup')?'Backup & export':'Saved documents','Review files and data for this shop.',Download);
  if(path==='/retail/more/staff'||['/users','/roles','/sessions'].includes(path))return flow('people','Staff & access',path.endsWith('roles')?'Roles & permissions':path.endsWith('sessions')?'Staff devices':'Staff accounts','Manage staff details and access to this shop.',UsersRound);
  if(path.startsWith('/retail/more')){
    const titles:Record<string,string>={voice:'Payment greeting',security:'Account security',settings:'Shop settings',invoice:'Printer & invoice',business:'My business',profile:'My profile',subscription:'Subscription',features:'Shop features',devices:'Logged-in devices',locations:'Stock locations',payments:'UPI & payments',help:'Help & support',referrals:'Refer a friend'};
    return flow('settings','Settings & tools',titles[path.split('/')[3]]||'Shop tools','Manage your shop preferences and account.',Settings);
  }
  if(path.startsWith('/retail/home')||path==='/retail')return flow('home','My shop','Home','Quick Bill, shortcuts and your daily shop summary.',House);
  return flow('settings','Business administration',({'/organizations':'Organizations','/companies':'Companies','/branches':'Branches','/godowns':'Stock locations','/financial-years':'Financial years'} as Record<string,string>)[path]||'Business settings','Review the selected business and its settings.',Settings);
}
export function workflowStyle(workflow:Workflow):CSSProperties {
  const [accent,soft,canvas,darkAccent,darkSoft,darkCanvas]=palettes[workflow.key];
  return {'--workflow-accent-light':accent,'--workflow-soft-light':soft,'--workflow-canvas-light':canvas,'--workflow-accent-dark':darkAccent,'--workflow-soft-dark':darkSoft,'--workflow-canvas-dark':darkCanvas} as CSSProperties;
}
