export const PRESETS = [
  {id:'VYAPAR',name:'Import from Vyapar',guide:'Open the relevant Items/Parties report in Vyapar, export it to Excel, and select that file here. Export stock and customer/supplier balances as of your chosen cutover date. The exact menus vary by desktop/mobile version.',url:'https://vyaparapp.in/free/inventory-management-software/excel'},
  {id:'TALLY',name:'Import from TallyPrime',guide:'In TallyPrime use Alt+E → Masters → XML or JSON (Data Exchange). Export Stock Items and Ledgers, including opening/closing balances at your cutover date. Select Customers for direct Sundry Debtors, Suppliers for direct Sundry Creditors. Custom ledger groups need a tabular export with explicit mappings.',url:'https://help.tallysolutions.com/export-data/'},
  {id:'BUSY',name:'Import from BUSY',guide:'Export the Item Master / Account Master and stock/balance reports to Excel. Choose one data type per file. Use the mapping preview because BUSY report columns depend on your configuration.',url:'https://busy.in/faqs/data-conversion/voucher-import-export/42/'},
  {id:'ZOHO',name:'Import from Zoho Books',guide:'Open Items, Customers or Vendors → Export. Download CSV or Excel with the desired fields; export stock and outstanding balances separately if they are not in the master file.',url:'https://www.zoho.com/ca/books/help/import-export/export.html'},
  {id:'MYBILLBOOK',name:'Import from myBillBook / another app',guide:'Download the Items, Parties or Stock report as a spreadsheet. Map the actual column headings in the preview. This is a configurable tabular preset, not a certified vendor connector.',url:''},
  {id:'GENERIC',name:'Other app / EVOLIX template',guide:'Use the sample CSV template, or export a named-column spreadsheet from your old app. PDFs, screenshots, encrypted databases and proprietary backup files must first be converted/exported to structured data.',url:''},
];
export const FIELDS: Record<string,string[]> = {
  ITEMS:['name','sku','barcode','unit_code','selling_price','purchase_price','mrp','opening_stock','gst_rate','hsn_sac','category','low_stock_threshold','selling_mode','inventory_tracking','external_id'],
  CUSTOMERS:['name','code','mobile','email','address','gstin','credit_days','credit_limit','opening_balance','external_id'],
  SUPPLIERS:['name','code','mobile','email','address','gstin','pan','state','nickname','credit_days','credit_limit','opening_balance','external_id'],
  STOCK:['sku','barcode','quantity','cost_rate','unit_code','location_code','external_id'],
};
const aliases: Record<string,string[]> = {
  name:['name','item name','product name','party name','customer name','supplier name','ledger name','account name','itemname','display name'],
  sku:['sku','item code','product code','stock code'], barcode:['barcode','item barcode','ean'], code:['code','party code','customer code','supplier code','account code'],
  mobile:['mobile','phone','phone number','mobile number','contact number','ledgermobile'], email:['email','email address','emailid'],
  address:['address','billing address'], gstin:['gstin','gst number','gst identification number','partygstin'], pan:['pan','pan number'],state:['state','state name','statename'],nickname:['nickname'],
  unit_code:['unit','unit name','unit code','base unit','baseunits'], selling_price:['selling price','sale price','sales rate','rate','selling rate'],
  purchase_price:['purchase price','purchase rate','cost price','buying price','openingrate'], mrp:['mrp','maximum retail price'],
  opening_stock:['opening stock','opening quantity','current stock','stock quantity','openingbalance'], quantity:['quantity','qty','stock','closing stock','current stock','openingbalance'],
  cost_rate:['cost rate','purchase price','purchase rate','openingrate'], opening_balance:['opening due','opening balance','balance','balance due','outstanding amount'],
  gst_rate:['gst rate','tax rate','gst percentage'],hsn_sac:['hsn','hsn code','hsn sac'],category:['category','group','parent'],
  low_stock_threshold:['low stock threshold','minimum stock','low stock alert'],credit_days:['credit days','credit period'],credit_limit:['credit limit'],
  selling_mode:['selling mode','sold by'],inventory_tracking:['inventory tracking'],location_code:['location code','godown','warehouse'],external_id:['external id','id','guid'],
};
const key=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function suggestMapping(kind:string,headers:string[]) {
  const map:Record<string,string>={};
  for(const field of FIELDS[kind] || []) {
    const choices=headers.filter(h=>(aliases[field] || [field]).some(a=>key(a)===key(h)));
    if(choices.length===1)map[field]=choices[0]; // Ambiguity must be resolved by a person.
  }
  return map;
}
