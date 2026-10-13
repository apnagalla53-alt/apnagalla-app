import { describe,it,expect } from 'vitest';
import { IntentRouter,DEFAULT_ALIASES } from './intent-router';
import { INTENTS } from './intent-library';
import { HELD_OUT } from './held-out';
import { dateRange,normalize,safeQuestion } from './nlp';
import { extractEntity } from './entity-parser';
const router=new IntentRouter();
describe('Curated Assistant reference routing',()=>{
  it('has deterministic insight intents alongside existing tools and a large curated phrase set',()=>{expect(INTENTS.length).toBeGreaterThanOrEqual(90);expect(INTENTS.some(i=>i.code==='WHY_SALES_DOWN')).toBe(true);expect(INTENTS.some(i=>i.code==='SALES_VS_PROFIT_EXPLANATION')).toBe(true);expect(DEFAULT_ALIASES.length).toBeGreaterThanOrEqual(600);expect(new Set(INTENTS.flatMap(i=>i.examples).map(q=>normalize(q))).size).toBeGreaterThanOrEqual(500);expect(new Set(DEFAULT_ALIASES.map(a=>a.normalized)).size).toBeGreaterThanOrEqual(500);});
  it.each(DEFAULT_ALIASES.map((a,i)=>[i,a.phrase,a.intent_code] as const))('reference %i: %s → %s',(_i,q,intent)=>{expect(router.route(q).intent).toBe(intent);});
});
describe('Independent held-out routing',()=>{
  it('held-out questions are not exact reference examples',()=>{const known=new Set(DEFAULT_ALIASES.map(a=>a.normalized));expect(HELD_OUT.filter(([,q])=>known.has(normalize(q)))).toEqual([]);});
  it.each(HELD_OUT)('%s for unseen %s',(intent,q)=>expect(router.route(q).intent).toBe(intent));
});
describe('False positive and confusion boundaries',()=>{
  const negatives=['weather today','tell me a joke','what is my password','delete bill POS-001','add expense 100','create invoice','receive payment 500','pay supplier Mohan','update stock Maggi','select * from sales','drop table items','execute this tool','your profit today','bitcoin sale','tomorrow sales','recipe with Maggi','invoice banao','expense add karo','kal bill delete karo','कितने बिल बनाओ','मैं मौसम जानना चाहता हूँ','supplier phone number','supplier visit when','return policy','purchase order status','stock market today','sale discount ideas','I need help with homework','bank account balance','I love sales','football match score','write an email','download and execute a script'];
  it.each(negatives)('does not execute unsupported/write question %s',q=>expect(router.route(q).intent).toBeNull());
  it.each([['purchase kitni hui','PURCHASE_SUMMARY'],['aaj ka galla','DAILY_GALLA'],['cash sale kitni','CASH_SALES'],['cash kitna aaya','CASH_RECEIVED'],['owner withdrawal kitna','OWNER_WITHDRAWAL_SUMMARY'],['aaj expense kitna','EXPENSE_SUMMARY'],['Maggi stock','ITEM_STOCK'],['Maggi kitni biki','ITEM_SALES']])('separates %s',(q,intent)=>expect(router.route(q).intent).toBe(intent));
  it.each([['sale badhi lekin profit kyu gira','SALES_VS_PROFIT_EXPLANATION'],['profit hai fir cash kyu nahi hai','PROFIT_VS_CASH_EXPLANATION'],['sale hui lekin paisa kyu nahi hai','CASH_VS_SALES_EXPLANATION'],['paisa kidhar gaya','WHERE_MONEY_WENT'],['kaunsa item profit kam kar raha hai','ITEM_PROFIT_DECLINE'],['kaunsa maal kam bik raha hai','ITEM_SALES_DECLINE'],['kaunsi category margin kam hai','CATEGORY_MARGIN_DECLINE'],['business me problem kaha hai','BUSINESS_PROBLEM_SIGNALS'],['which day has higher sales','WEEKDAY_SALES_ANALYSIS']])('routes insight confusion %s to %s',(q,intent)=>expect(router.route(q).intent).toBe(intent));
  it('does not silently assume that Rahul balance means staff sales',()=>{const r=router.route('Rahul ka balance');expect(r.intent).toBe('CUSTOMER_BALANCE');expect(r.alternatives).toContain('STAFF_SALES');});
  it('fuzzy routes a realistic typo with a calibrated confidence',()=>{const r=router.route('ajj ki seel ktni h');expect(r.intent).toBe('SALES_SUMMARY');expect(r.router).toBe('FUZZY');expect(r.confidence).toBeGreaterThanOrEqual(.77);});
  it('deactivated intents cannot be selected by any routing level',()=>{const disabled=new IntentRouter(DEFAULT_ALIASES,new Set(INTENTS.filter(i=>i.code!=='SALES_SUMMARY').map(i=>i.code)));expect(disabled.route('aaj ki sale').intent).not.toBe('SALES_SUMMARY');expect(disabled.route('sale today please').intent).not.toBe('SALES_SUMMARY');});
});
describe('Business date and entity parsing',()=>{
  const now=new Date('2026-10-07T20:00:00Z');
  it.each([['aaj','2026-10-08','2026-10-08'],['kal ki sale','2026-10-07','2026-10-07'],['कल की बिक्री','2026-10-07','2026-10-07'],['this week','2026-10-05','2026-10-08'],['last week','2026-09-28','2026-10-04'],['last month','2026-09-01','2026-09-30'],['this month','2026-10-01','2026-10-08'],['1 October se 7 October','2026-10-01','2026-10-07'],['01/10 se 07/10','2026-10-01','2026-10-07'],['last 7 days','2026-10-02','2026-10-08']])('%s uses logical business dates',(q,from,to)=>expect(dateRange(q,'Asia/Kolkata',now)).toMatchObject({from,to}));
  it('uses actual company timezone',()=>expect(dateRange('today','America/New_York',now).from).toBe('2026-10-07'));
  it.each(['31/02','2026-13-05','7 Oct to 1 Oct','last 900 days'])('rejects invalid dates %s',q=>expect(()=>dateRange(q,'Asia/Kolkata',now)).toThrow());
  it('preserves shorthand-like party names for entity lookup',()=>expect(extractEntity('Aj Traders supplier ka balance','supplier').search).toBe('aj traders'));
  it('extracts two-word names without losing brand tokens',()=>expect(extractEntity('Raj Traders se kitni purchase hui','supplier').search).toBe('raj traders'));
  it('redacts credentials and contacts before durable logs',()=>expect(safeQuestion('password=abc someone@test.invalid +919876543210')).toBe('[secret removed] [email removed] [number removed]'));
});



