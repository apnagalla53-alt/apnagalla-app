import { QueryContext,Result,Language } from './assistant.types';
const money=(n:number)=>'₹'+n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
export function renderAnswer(q:QueryContext,r:Result,language:Language):string {
  const s=r.summary,name=q.entity?.name||'',hi=language==='hi',hinglish=language==='hinglish';
  if(r.insight){
    const i=r.insight;
    if(i.confidence==='INSUFFICIENT')return hi?'तुलना के लिए अभी पर्याप्त बिल या इतिहास नहीं है। कुछ और बिक्री दर्ज होने पर EVOLIX बेहतर संकेत दिखा सकेगा।':hinglish?'Abhi comparison ke liye enough bills ya history nahi hai. Kuch aur sales record hone par EVOLIX behtar signals dikha sakega.':'There is not enough comparable bill history yet. EVOLIX can show a more useful comparison after more sales are recorded.';
    if(i.metric==='gross_margin'&&i.delta==null)return hi?'मार्जिन की तुलना उपलब्ध नहीं है, क्योंकि कम से कम एक अवधि में ज्ञात लागत वाली बिक्री नहीं है।':'Margin comparison available nahi hai, kyunki kam se kam ek period mein known-cost sale record nahi hai.';
    const margin=i.metric==='gross_margin';
    const amount=(v:number|null|undefined)=>v==null?'—':margin?`${Math.abs(v).toFixed(2)} percentage points`:'₹'+Math.abs(v).toLocaleString('en-IN',{maximumFractionDigits:0});
    const change=i.delta??0,word=Math.abs(change)<1?'largely stable':change<0?'decreased':'increased';
    const metric=i.metric==='net_business_profit'?'net profit':i.metric==='business_expenses'?'business expenses':i.metric==='purchases'?'purchases':i.metric==='returns'?'returns':margin?'gross margin':i.metric==='cogs'?'COGS':i.metric==='recorded_outflows'?'recorded outflows':i.metric==='expected_cash'?'expected drawer cash':i.metric==='cash_paid_out'?'cash paid out':i.metric==='customer_receivable_change'?'customer receivables':i.metric==='supplier_payable_change'?'supplier payables':i.metric==='gross_profit'?'gross profit':'sales';
    const headline=hi?`${i.current_period.from} से ${i.current_period.to} तक ${metric} ${change<0?'कम हुआ':change>0?'बढ़ा':'लगभग स्थिर रहा'} (${amount(change)})।`:hinglish?`${i.current_period.from} se ${i.current_period.to} tak ${metric} ${change<0?'kam hua':change>0?'badha':'lagbhag stable raha'} (${amount(change)}).`:`${metric[0].toUpperCase()+metric.slice(1)} ${word} by ${amount(change)} in the selected period.`;
    const driverLine=(d:any)=>{
      const cash=(v:any)=>v==null?'—':'₹'+Math.abs(Number(v)).toLocaleString('en-IN',{maximumFractionDigits:0});
      if(d.type==='BILL_COUNT')return hi?`बिल ${d.previous_value} से ${d.current_value} हुए; बिक्री के बदलाव में इनका मापा योगदान ${cash(d.impact_amount)} है।`:`Bills ${d.previous_value} se ${d.current_value} hue; sales change mein inka measured contribution ${cash(d.impact_amount)} hai.`;
      if(d.type==='AVERAGE_BILL')return hi?`औसत बिल ${cash(d.previous_value)} से ${cash(d.current_value)} हुआ; बिक्री के बदलाव में इसका मापा योगदान ${cash(d.impact_amount)} है।`:`Average bill ${cash(d.previous_value)} se ${cash(d.current_value)} hua; sales change mein iska measured contribution ${cash(d.impact_amount)} hai.`;
      if(d.type==='GROSS_PROFIT_CHANGE')return hi?`सकल लाभ ${cash(d.previous_value)} से ${cash(d.current_value)} हुआ।`:`Gross profit ${cash(d.previous_value)} se ${cash(d.current_value)} hua.`;
      if(d.type==='EXPENSE_CHANGE')return hi?`व्यावसायिक खर्च और write-off ${cash(d.previous_value)} से ${cash(d.current_value)} हुए; यह बदलाव लाभ को प्रभावित करता है।`:`Business expenses and write-offs ${cash(d.previous_value)} se ${cash(d.current_value)} hue; this movement affects profit.`;
      return d.title+': '+(d.description||'');
    };
    const main=i.drivers.filter(d=>d.evidence_type==='DIRECT').slice(0,2).map(driverLine).join(' ');
    const supporting=i.drivers.some(d=>d.evidence_type==='CORRELATED')?(hi?' साथ के संकेत संबंध दिखाते हैं, पक्का कारण नहीं।':hinglish?'Saath ke signals correlated hain, pakka cause prove nahi hota.':' Other signals are correlated observations, not proven external causes.'):'';
    const incomplete=i.confidence==='LIMITED'?(hi?' लागत कवरेज अधूरी है; लाभ का आकलन पूरा नहीं है।':hinglish?' Cost coverage adhuri hai; profit view complete nahi hai.':' Cost coverage is incomplete, so the profit view is partial.'):'';
    return `${headline} ${main}${supporting}${incomplete} ${hi?'यह EVOLIX में दर्ज जानकारी पर आधारित है।':hinglish?'EVOLIX ke recorded data ke aadhar par.':'Based on records in EVOLIX.'}`;
  }
  if(['PROFIT_SUMMARY','TOP_PROFIT_ITEMS','GROSS_PROFIT','NET_PROFIT','GROSS_MARGIN','ITEM_PROFIT','BILL_PROFIT','CATEGORY_PROFIT','LOW_MARGIN_ITEMS','BELOW_COST_SALES'].includes(q.intent)){
    const key=q.intent==='NET_PROFIT'?'net_business_profit':q.intent==='GROSS_MARGIN'?'gross_margin':'gross_profit';
    const amount=s[key]==null?'Unavailable':key==='gross_margin'?s[key]+'%':money(Number(s[key]));
    const details=r.rows?.slice(0,5).map(row=>`${row.item}: ${row.profit==null?'cost unknown':money(Number(row.profit))}${Number(row.unknown_lines)>0?' (incomplete)':''}`).join('; ');
    if(['TOP_PROFIT_ITEMS','CATEGORY_PROFIT','LOW_MARGIN_ITEMS','BELOW_COST_SALES'].includes(q.intent))return `${q.dates.label}: ${r.title}. ${details||'No matching posted transactions.'} Cost coverage ${s.cost_coverage}%. ${s.warning||''}`;
    const margin=q.intent==='ITEM_PROFIT'?` Margin ${s.gross_margin==null?'Unavailable':s.gross_margin+'%'}.`:'';
    return `${q.dates.label}: ${r.title} ${amount}.${margin} ${details||''}. ${hi?'लागत कवरेज':hinglish?'Cost coverage':'Cost coverage'} ${s.cost_coverage}%. ${s.warning?(hi?'अधूरा लाभ: कुछ खरीद लागत या सेवा लागत नहीं है।':hinglish?'Profit adhura hai: kuch purchase ya service cost nahi hai.':s.warning):''}`;
  }
  if(r.empty){
    const hindiTitles:Record<string,string>={SALES_SUMMARY:'बिक्री का सारांश',CUSTOMER_SALES:'ग्राहक की बिक्री',STAFF_SALES:'स्टाफ की बिक्री',PURCHASE_SUMMARY:'खरीद का सारांश',LOW_STOCK:'कम स्टॉक',EXPIRING_ITEMS:'समाप्त होने वाला माल',EXPENSE_SUMMARY:'खर्च का सारांश',NEED_LIST:'मंगवाने की सूची',NEW_STOCK_RECEIVED:'नया आया माल',UDHAR_SALES:'उधार बिक्री'};
    return hi?`${hindiTitles[q.intent]||r.title}: अभी कोई संबंधित रिकॉर्ड नहीं मिला।`:hinglish?`${r.title}: abhi koi matching record nahi mila.`:`${r.title}: no matching records are recorded yet.`;
  }
  if(q.intent==='CUSTOMER_BALANCE'||q.intent==='SUPPLIER_BALANCE'){
    const balance=Number(s.balance);if(balance<0)return `${name}: ${money(-balance)} ${hi?'अग्रिम':hinglish?'advance':'advance balance'}.`;
    return hi?`${name} ${q.intent==='CUSTOMER_BALANCE'?'से':'को'} ${money(balance)} ${q.intent==='CUSTOMER_BALANCE'?'लेना':'देना'} है।`:hinglish?`${name} ${q.intent==='CUSTOMER_BALANCE'?'se':'ko'} ${money(balance)} ${q.intent==='CUSTOMER_BALANCE'?'lena':'dena'} hai.`:`${name}: ${money(balance)} ${q.intent==='CUSTOMER_BALANCE'?'receivable':'payable'}.`;
  }
  if(q.intent==='SALES_SUMMARY'||q.intent==='CUSTOMER_SALES'||q.intent==='STAFF_SALES')return hi?`${q.dates.label}: कुल बिक्री ${money(Number(s.net_sales))}, ${s.bills_count} बिल।`:hinglish?`${q.dates.label}: total net sale ${money(Number(s.net_sales))}, ${s.bills_count} bills.`:`${q.dates.label}: net sales ${money(Number(s.net_sales))} across ${s.bills_count} bills.`;
  if(q.intent==='DAILY_GALLA')return hi?`${q.dates.label}: बिक्री ${money(Number(s.total_sales))}। नकद आया ${money(Number(s.cash_received))}। अपेक्षित गल्ला ${money(Number(s.expected_cash))}।`:hinglish?`${q.dates.label}: sale ${money(Number(s.total_sales))}, cash aaya ${money(Number(s.cash_received))}, expected galla ${money(Number(s.expected_cash))}.`:`${q.dates.label}: sales ${money(Number(s.total_sales))}, cash received ${money(Number(s.cash_received))}, expected drawer ${money(Number(s.expected_cash))}.`;
  if(q.intent==='UDHAR_SALES')return hi?`${q.dates.label}: ${s.udhar_customers_count} ग्राहकों को ${s.udhar_bill_count} बिलों में ${money(Number(s.udhar_sales))} उधार दिया।`:hinglish?`${q.dates.label}: ${s.udhar_customers_count} customers ko ${s.udhar_bill_count} bills mein ${money(Number(s.udhar_sales))} udhar diya.`:`${q.dates.label}: ${money(Number(s.udhar_sales))} credit given to ${s.udhar_customers_count} recorded customers across ${s.udhar_bill_count} bills.`;
  if(q.intent==='ITEM_STOCK')return `${name}: ${s.quantity} ${s.unit} ${hi?'उपलब्ध':hinglish?'available hain':'available'}.${s.requested_quantity?` ${s.available==='Yes'?(hi?'हाँ':hinglish?'Haan':'Yes'):(hi?'नहीं':hinglish?'Nahi':'No')}, ${s.requested_quantity} ${s.unit}.`:''}`;
  if(q.intent.startsWith('SUBSCRIPTION')||q.intent==='CURRENT_PLAN')return `${s.plan||'No plan'} · ${s.status}${s.expires?` · ${hi?'समाप्ति':hinglish?'expiry':'expires'} ${s.expires} · ${s.days_left} ${hi?'दिन बाकी':hinglish?'din bache':'days left'}`:''}.`;
  const scalar=Object.entries(s).find(([k,v])=>typeof v==='number'&&k!=='record_count');
  const list=!!r.rows?.length;
  if(list)return hi?`${r.title}: विवरण नीचे है।`:hinglish?`${r.title}: details neeche hain.`:`${r.title}: details are shown below.`;
  if(scalar){const [key,value]=scalar,count=/count|bills|items|needs|lots|records/.test(key);return `${q.dates.label}: ${r.title} ${count?value:money(Number(value))}.`;}
  return `${r.title}: ${hi?'विवरण नीचे है।':hinglish?'details neeche hain.':'details are shown below.'}`;
}

