import { BadRequestException } from '@nestjs/common';
import { DateRange } from './assistant.types';
const shorthand:Record<string,string>={aj:'aaj',ajj:'aaj',sel:'sale',sells:'sale',gla:'galla',udr:'udhar',udhaar:'udhar',expns:'expense',pymnt:'payment',stok:'stock',kharacha:'kharcha'};
export function normalize(text:string,aliases=true):string {
  const base=text.normalize('NFKC').toLowerCase().replace(/[?!,।;:]/g,' ').replace(/\s+/g,' ').trim();
  return aliases?base.split(' ').map(t=>shorthand[t]||t).join(' '):base;
}
export function safeQuestion(text:string):string {
  return text.replace(/(?:bearer\s+)?eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi,'[token removed]')
    .replace(/\b(password|passwd|secret|token|api[_ -]?key)\b\s*[:=]?\s*\S+/gi,'[secret removed]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email removed]').replace(/\+?\d[\d ()-]{8,}\d/g,'[number removed]').slice(0,400);
}
const day=(d:Date)=>d.toISOString().slice(0,10);
const shift=(s:string,n:number)=>day(new Date(new Date(s+'T00:00:00Z').getTime()+n*86400000));
const months:Record<string,number>={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
export function dateRange(question:string,timezone='Asia/Kolkata',now=new Date()):DateRange {
  let today:string;
  try{today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}catch{throw new BadRequestException('Business timezone is not configured correctly');}
  const q=normalize(question);let from=today,to=today,explicit=false;
  const named=[...q.matchAll(/\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(20\d{2}))?\b/g)];
  const numeric=[...q.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/g)];
  const iso=[...q.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)];
  const dates=iso.length?iso.map(m=>m[1]):named.length?named.map(m=>`${m[3]||today.slice(0,4)}-${String(months[m[2]]).padStart(2,'0')}-${m[1].padStart(2,'0')}`):numeric.map(m=>`${m[3]||today.slice(0,4)}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
  if(dates.length>2)throw new BadRequestException('Use one date or one date range');
  if(dates.length){from=dates[0];to=dates[1]||from;explicit=true;}
  else if(/last\s+\d+\s+days/.test(q)){const count=Number(q.match(/last\s+(\d+)\s+days/)![1]);if(count<1||count>366)throw new BadRequestException('Choose 1 to 366 days');from=shift(today,1-count);explicit=true;}
  else if(/last week|pich[hl]+e? hafte|पिछले हफ्ते/.test(q)){const monday=shift(today,-(new Date(today+'T00:00:00Z').getUTCDay()+6)%7);from=shift(monday,-7);to=shift(monday,-1);explicit=true;}
  else if(/this week|is hafte|इस हफ्ते/.test(q)){from=shift(today,-((new Date(today+'T00:00:00Z').getUTCDay()+6)%7));explicit=true;}
  else if(/last month|pich[hl]+[ae] mahina|pich[hl]+e mahine|पिछले महीने/.test(q)){to=shift(today.slice(0,7)+'-01',-1);from=to.slice(0,7)+'-01';explicit=true;}
  else if(/this month|is month|is mahine|इस महीने/.test(q)){from=today.slice(0,7)+'-01';explicit=true;}
  else if(/\byesterday\b|\bkal\b|(?:^|\s)कल(?:\s|$)|बीते दिन/.test(q)){from=to=shift(today,-1);explicit=true;}
  else if(/\btoday\b|\baaj\b|आज/.test(q)){explicit=true;}
  if(/tomorrow|agle|आने वाले कल/.test(q)&&!/expire|expiry/.test(q))throw new BadRequestException('V1 reads recorded history. Use today or a past date.');
  for(const value of [from,to]){const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(+d)||day(d)!==value)throw new BadRequestException('Choose a valid business date');}
  if(from>to||(+new Date(to)-+new Date(from))/86400000>365)throw new BadRequestException('Choose an ordered range up to 366 days');
  return {from,to,timezone,label:from===to?from:`${from} to ${to}`,explicit};
}
export function stripDates(text:string):string {
  return text.replace(/\b20\d{2}-\d{2}-\d{2}\b/g,' ').replace(/\b\d{1,2}\/\d{1,2}(?:\/20\d{2})?\b/g,' ')
    .replace(/\b\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+20\d{2})?\b/gi,' ')
    .replace(/\b(?:last \d+ days|last week|this week|last month|this month|is month|is hafte|is mahine|pichle hafte|pichla mahina|pichle mahine|today|yesterday|aaj|kal)\b/gi,' ')
    .replace(/आज|कल|इस हफ्ते|इस महीने|पिछले हफ्ते|पिछले महीने/g,' ');
}
