import Fuse from 'fuse.js';
import { INTENTS, INTENT_MAP } from './intent-library';
import { normalize } from './nlp';
import { Routing } from './assistant.types';
export interface Alias {intent_code:string;phrase:string;normalized:string;}
export const DEFAULT_ALIASES:Alias[]=INTENTS.flatMap(i=>[...i.examples,`please tell me ${i.examples[0]}`,`can you show ${i.examples[1]}`].map(phrase=>({intent_code:i.code,phrase,normalized:normalize(phrase)})));
export class IntentRouter {
  private exact=new Map<string,string>();
  private fuzzy:Fuse<Alias>;
  private businessFuzzy:Fuse<Alias>;
  constructor(private aliases:Alias[]=DEFAULT_ALIASES,private active=new Set(INTENTS.map(i=>i.code))){
    const allowed=aliases.filter(a=>active.has(a.intent_code)&&INTENT_MAP.has(a.intent_code));
    for(const a of allowed)this.exact.set(a.normalized,a.intent_code);
    this.fuzzy=new Fuse(allowed,{keys:['normalized'],includeScore:true,threshold:0.30,ignoreLocation:true,ignoreFieldNorm:true});
    this.businessFuzzy=new Fuse(allowed.filter(a=>INTENT_MAP.get(a.intent_code)?.category!=='financial'),{keys:['normalized'],includeScore:true,threshold:0.30,ignoreLocation:true,ignoreFieldNorm:true});
  }
  route(question:string):Routing {
    const q=normalize(question);
    const unknown:Routing={intent:null,confidence:0,router:'UNKNOWN'};
    if(/\byour profit\b/.test(q))return unknown;
    // A read-only boundary is checked even before administrator-approved aliases.
    if(/\b(?:add|create|delete|update|edit|pay|record|remove|modify|insert|drop|select|execute|script|password|secret|weather|joke|recipe|bitcoin|tomorrow)\b|(?:जोड़ो|हटाओ|बनाओ|बदल दो|मौसम|पासवर्ड)|\b(?:banao|hatao|mitao)\b/.test(q))return unknown;
    const exact=this.exact.get(q);
    // A bare person's balance may refer to more than one role; resolve real data.
    const genericPerson=/balance|balnce|hisab|hisaab|khata|खाता|हिसाब|बकाया/.test(q)&&! /customer|custmer|supplier|suplier|staff|staf|employee|cashier|ग्राहक|सप्लायर|कर्मचारी|total|कुल/.test(q);
    if(exact&&genericPerson&&['CUSTOMER_BALANCE','CUSTOMER_KHATA'].includes(exact))return {intent:exact,confidence:1,router:'EXACT',matched:q,alternatives:[exact,'SUPPLIER_BALANCE','STAFF_SALES']};
    if(exact)return {intent:exact,confidence:1,router:'EXACT',matched:q};
    if(/\b(?:teach|meaning|definition|weather|love|politics|stock market|share market|how to|discount|sales tax law|order status|return policy|refund policy|homework|bank account balance)\b|supplier.*(?:phone|mobile|visit|address)/.test(q))return unknown;
    const insight=this.insightPattern(q);
    if(insight&&this.active.has(insight))return {intent:insight,confidence:0.97,router:'PATTERN',matched:'controlled:'+insight};
    const intent=this.pattern(q);
    if(intent&&this.active.has(intent))return {intent,confidence:0.96,router:'PATTERN',matched:'controlled:'+intent,...(genericPerson?{alternatives:[intent,'SUPPLIER_BALANCE','STAFF_SALES']}: {})};
    const financialSignal=/profit|margin|munafa|मुनाफ|लाभ|मार्जिन|below cost|loss me|नुकसान/.test(q);
    const matches=(financialSignal?this.fuzzy:this.businessFuzzy).search(q,{limit:12});
    if(!matches.length||q.length<5)return unknown;
    const top=matches[0],score=1-(top.score??1);
    const other=matches.find(m=>m.item.intent_code!==top.item.intent_code);
    const margin=other?score-(1-(other.score??1)):1;
    if(score>=0.77&&margin>=0.10)return {intent:top.item.intent_code,confidence:score,router:'FUZZY',matched:top.item.normalized};
    if(score>=0.70)return {intent:null,confidence:score,router:'FUZZY',alternatives:[...new Set(matches.filter(m=>1-(m.score??1)>=0.70).map(m=>m.item.intent_code))].slice(0,3)};
    return unknown;
  }
  private insightPattern(q:string):string|null {
    const has=(r:RegExp)=>r.test(q),why=has(/why|kyu|kyun|reason|down|declin|fell|fall|decreas|gira|kam|कम|गिर|कमजोर|क्यों|क्यूं|वजह|कारण/);
    const sales=has(/sale|sales|bikri|bika|बिक्री|बिकी/),profit=has(/profit|margin|munafa|कमाई|मुनाफ|लाभ|मार्जिन/);
    if(sales&&profit&&has(/lekin|but|fir bhi|फिर भी|बढ़ी|बढ़ी|badhi|up|ज्यादा/))return 'SALES_VS_PROFIT_EXPLANATION';
    if(has(/paisa kidhar|paisa kaha|money went|where.*money|cash kaha|कैश कहाँ|पैसा कहाँ|पैसा किधर/))return 'WHERE_MONEY_WENT';
    const cashGap=has(/(?:cash|nakdi|नकद|कैश|paisa|पैसा).*(?:nahi|kam|low|missing|kaha|kidhar|नहीं|कम|कहाँ|किधर)|(?:cash|पैसा).*(?:short|difference)|cash vs sales/);
    if(profit&&cashGap)return 'PROFIT_VS_CASH_EXPLANATION';
    if(sales&&cashGap)return 'CASH_VS_SALES_EXPLANATION';
    if(has(/business|dukaan|दुकान|व्यापार/)&&has(/problem|dikkat|issue|क्या गलत|समस्या|दिक्कत/))return 'BUSINESS_PROBLEM_SIGNALS';
    if(has(/business kaisa|business health|dukaan kaisi|दुकान कैसी|व्यापार कैसा/))return 'BUSINESS_HEALTH_SIGNALS';
    if(has(/item|maal|product|सामान|माल/)&&sales&&why)return 'ITEM_SALES_DECLINE';
    if(has(/item|maal|product|सामान|माल/)&&profit&&why)return 'ITEM_PROFIT_DECLINE';
    if(has(/category|श्रेणी/)&&profit)return has(/margin/)?'CATEGORY_MARGIN_DECLINE':'CATEGORY_PROFIT_DECLINE';
    if(has(/category|श्रेणी/)&&sales)return has(/badhi|बढ़ी|growth|up/)?'CATEGORY_SALES_GROWTH':'CATEGORY_SALES_DECLINE';
    if(why&&profit){if(has(/margin/))return 'MARGIN_CHANGE_EXPLANATION';if(has(/cost|cogs|maal ki cost/))return 'COGS_CHANGE_EXPLANATION';if(has(/expense|kharch|खर्च/))return 'WHY_EXPENSES_UP';return 'WHY_PROFIT_DOWN';}
    if(why&&sales)return has(/badhi|बढ़ी|बढ़ी|up|increased|increase/)?'WHY_SALES_UP':'WHY_SALES_DOWN';
    if(has(/compare|vs|versus|तुलना/)){
      if(profit)return 'COMPARE_PROFIT';if(sales)return 'COMPARE_SALES';if(has(/expense|kharch|खर्च/))return 'COMPARE_EXPENSES';if(has(/purchase|kharid|खरीद/))return 'COMPARE_PURCHASES';
    }
    if(has(/trend|प्रवृत्ति/))return profit?'PROFIT_TREND':sales?'SALES_TREND':null;
    if(has(/staff|employee|performance|कर्मचारी/)&&has(/compare|vs|versus|change|declin|down|kam|कम|गिर|बदल/))return 'STAFF_PERFORMANCE_COMPARE';
    if(has(/customer|ग्राहक/)&&has(/activity|change|badal|बढ़|बढ़/))return 'CUSTOMER_ACTIVITY_CHANGE';
    if(has(/customer|ग्राहक/)&&has(/receivable.*(?:grow|increase|change)|udhar.*(?:bad|badh|grow|increase)|due.*(?:grow|increase|change)|उधार.*(?:बढ़|बढ़|बदल)|बकाया.*(?:बढ़|बढ़|बदल)/))return 'CUSTOMER_RECEIVABLE_GROWTH';
    if(has(/supplier|payable|सप्लायर/)&&has(/payable.*(?:grow|increase|change)|due.*(?:grow|increase|change)|bad|badh|grow|increase|change|बढ़|बढ़|बदल/))return 'SUPPLIER_PAYABLE_CHANGE';
    if(has(/stock.?out|out of stock|stock khatam|स्टॉक.*खत्म/)&&(why||has(/impact|affect|sales|sale|bikri|प्रभाव|बिक्री/)))return 'STOCKOUT_IMPACT';
    if(has(/weekday|which day|sunday|monday|वार|किस दिन/))return 'WEEKDAY_SALES_ANALYSIS';
    if(has(/return|refund|वापसी/)&&why)return 'RETURN_IMPACT';
    if(has(/loss me|loss-making|नुकसान में/))return 'LOSS_MAKING_ITEMS_ANALYSIS';
    if(has(/low margin|कम मार्जिन/))return 'LOW_MARGIN_ITEMS_ANALYSIS';
    return null;
  }
  private pattern(q:string):string|null {
    const has=(p:RegExp)=>p.test(q);
    if(has(/profit|margin|munafa|मुनाफ|लाभ|मार्जिन|below cost|loss me|नुकसान/)){
      if(has(/below cost|loss me|नुकसान/))return 'BELOW_COST_SALES';
      if(has(/low margin|kam margin|कम मार्जिन/))return 'LOW_MARGIN_ITEMS';
      if(has(/category|श्रेणी/))return 'CATEGORY_PROFIT';
      if(has(/bill|invoice|बिल/))return 'BILL_PROFIT';
      if(has(/net|शुद्ध/))return 'NET_PROFIT';
      if(has(/gross.*profit|सकल लाभ/))return 'GROSS_PROFIT';
      if(has(/sabse|most profitable|top profit|सबसे/))return 'TOP_PROFIT_ITEMS';
      if(has(/\b\w+\s+(?:mein|me|ka).*profit|\b\w+\s+profit$/)&&!has(/aaj|today|month|kal|yesterday|gross|net/))return 'ITEM_PROFIT';
      if(has(/margin|मार्जिन/))return 'GROSS_MARGIN';
      return 'PROFIT_SUMMARY';
    }
    if(has(/subscription|subscrption|plan|योजना|सदस्यता|din bache|दिन बचे/))return has(/expire|expiry|end date|din bache|days left|समाप्त|दिन बचे/)?'SUBSCRIPTION_EXPIRY':has(/status|active|state|स्थिति|चालू/)?'SUBSCRIPTION_STATUS':'CURRENT_PLAN';
    if(has(/opening|shuruaat|subah|शुरुआती/)&&has(/cash|galla|cas|नकद|गल्ला/))return 'OPENING_CASH';
    if(has(/expected|hona chahiye|should be|अपेक्षित|होना चाहिए/)&&has(/cash|galla|drawer|counter|नकद|गल्ला/))return 'EXPECTED_CASH';
    if(has(/galla|galle|drawer|cash hisab|cash hisaab|गल्ला|नकद हिसाब/))return 'DAILY_GALLA';
    if(has(/old.*(?:due|credit)|purana.*(?:udhar|baki)|पुरान.*उधार|पुरानी उधारी/)&&has(/collect|receiv|receive|vasooli|mila|aaya|वसूली|मिला/))return 'CUSTOMER_DUE_RECEIVED';
    if(has(/owner|malik|मालिक|drawings/)&&has(/withdraw|nikal|taken|drawings|निकाल|निकासी/))return 'OWNER_WITHDRAWAL_SUMMARY';
    if(has(/expir|expiry|समाप्त सामान|एक्सपायर/))return has(/expired|past expiry|already|ho gaya|ho chuka|हुआ/)?'EXPIRED_ITEMS':'EXPIRING_ITEMS';
    if(has(/need|mangwana|order.*items|मंगवाना|सामान की सूची/))return has(/urgent|priority|jaldi|तुरंत|अति जरूरी/)?'URGENT_NEEDS':has(/pending|outstanding|unfulfilled|baki|लंबित|बाकी/)?'PENDING_NEEDS':'NEED_LIST';
    if(has(/return|retrn|wapas|वापसी/))return has(/count|kitne|number|how many|cnt|कितनी|संख्या/)?'RETURN_COUNT':'RETURN_SUMMARY';
    if(has(/supplier|suplier|payable|सप्लायर|सप्लायरों/)){
      if(has(/purchase|purchse|kharida|खरीद/))return 'SUPPLIER_PURCHASE_SUMMARY';
      if(has(/payment|paid|pymnt|diya|भुगतान|दिया/))return 'SUPPLIER_PAYMENT_SUMMARY';
      if(has(/khata|ledger|statement|transactions|entries|hisab|खाता|हिसाब/))return 'SUPPLIER_KHATA';
      return has(/total|all|sabhi|कुल/)?'SUPPLIER_TOTAL_DUE':'SUPPLIER_BALANCE';
    }
    if(has(/ko kitna dena|owe to|owed to/))return 'SUPPLIER_BALANCE';
    if(has(/overdue|past payment|late.*customer|customer.*late|late udhar|देरी वाले|भुगतान बाकी/))return 'CUSTOMER_OVERDUE';
    if(has(/staff|staf|cashier|employee|performance|\bne\b.*sale|कर्मचारी/)&&has(/sale|billing|becha|बिक्री|बेचा/))return 'STAFF_SALES';
    if(has(/customer|custmer|ग्राहक/)&&has(/sales|sale|becha|bills total|kharida|बिक्री|बेचा/))return 'CUSTOMER_SALES';
    if(has(/(?:ne|from|se).*payment|payments from|collection|paid me|paisa diya|भुगतान किया|की वसूली/)&&!has(/supplier/))return 'CUSTOMER_PAYMENT_RECEIVED';
    if(has(/cash|नकद|कैश/)&&has(/\baaya\b|\baya\b|received|receiv|inflow|incoming|\bmila\b|आया|प्राप्ति/))return 'CASH_RECEIVED';
    if(has(/upi|यूपीआई/)&&has(/\baaya\b|\baya\b|received|receiv|collections|incoming|\bmila\b|आया|प्राप्ति/))return 'UPI_RECEIVED';
    if(has(/customers? ka (?:baki|udhar)|customer.*total|total.*customer|all customer|receivables|ग्राहकों.*कुल|कुल ग्राहक/))return 'CUSTOMER_TOTAL_DUE';
    if(has(/balance|balnce|se kitna lena|ka udhar|customer.*due|amount owed by|baki|से कितना लेना|ग्राहक.*बकाया/))return 'CUSTOMER_BALANCE';
    if(has(/khata|khatta|ledger|statement|hisab|हिसाब|खाता/))return 'CUSTOMER_KHATA';
    if(has(/godown|warehouse|location|गोदाम/))return 'LOCATION_STOCK';
    if(has(/stock|stok|inventory|available|quantity|bacha|स्टॉक|बचा/)){
      if(has(/batch|lots|lot |बैच/))return 'BATCH_STOCK';
      if(has(/godown|warehouse|location|गोदाम/))return 'LOCATION_STOCK';
      if(has(/out of|zero|no inventory|no stock|khatam hai|खत्म है|खत्म सामान/))return 'OUT_OF_STOCK';
      if(has(/low|below|reorder|running low|khatam hone|kam bacha|कम|होने वाला/))return 'LOW_STOCK';
      if(has(/summary|overview|report overview|total stock items|kitne stock items|सारांश|कुल स्टॉक/))return 'STOCK_SUMMARY';
      if(has(/new stock|received|recived|incoming/))return 'NEW_STOCK_RECEIVED';
      return 'ITEM_STOCK';
    }
    if(has(/khatam hone|खत्म होने/))return 'LOW_STOCK';
    if(has(/naya maal|maal aaya|maal aya|goods received|माल आया|माल प्राप्ति/))return 'NEW_STOCK_RECEIVED';
    if(has(/purchase|purchse|kharida|kharidi|खरीद/))return has(/\bse\b|from /)?'SUPPLIER_PURCHASE_SUMMARY':'PURCHASE_SUMMARY';
    if(has(/expense|expns|kharch|kharcha|costs|spending|spent|खर्च/))return has(/petrol|rent|transport|electricity|category|pe kitna|ka kharcha|पेट्रोल|किराया/)?'EXPENSE_BY_CATEGORY':'EXPENSE_SUMMARY';
    if(has(/top|best sell|popular product|highest sell|sabse|सबसे/)&&has(/selling|bik|bika|bikta|maal|product|item|sellers|बिका|सामान/))return 'TOP_SELLING_ITEMS';
    if(has(/bill|invoice|receipt|बिल/)&&has(/pos-|inv-|bill number|बिल संख्या/))return 'BILL_LOOKUP';
    if(has(/bill|invoice|बिल/)&&has(/count|cnt|kitne|number|how many|कितने|संख्या/))return has(/credit|udhar|उधार/)?'UDHAR_BILL_COUNT':'BILL_COUNT';
    if(has(/sale|sales|sold|bika|bikri|bik|becha|business total|business hua|revenue|बिक्री|बिका|बेचा/)){
      if(has(/cash|नकद|कैश/))return 'CASH_SALES';if(has(/upi|QR payment|यूपीआई/i))return 'UPI_SALES';if(has(/card|कार्ड/))return 'CARD_SALES';if(has(/bank|बैंक/))return 'BANK_SALES';if(has(/udhar|credit|उधार/))return 'UDHAR_SALES';
      if(has(/\b(?:maggi|coke|rice|milk|biscuit|surf|amul)\b|मैगी|चावल/)||has(/\b(?:ki|ka) sales|sales (?:of|for)\b/))return 'ITEM_SALES';
      return 'SALES_SUMMARY';
    }
    if(has(/udhar diya|udhar bill|credit given|credit billing|उधार दिया/))return 'UDHAR_SALES';
    return null;
  }
}

