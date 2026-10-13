import { EntityKind } from './intent-library';
import { normalize,stripDates } from './nlp';
// Matching tokens only. Names are never changed in the database or response.
const words='profit margin gross net munafa लाभ मुनाफा मार्जिन se ko ka ki ke ne mein me hai hain kitna kitni kitne kya batao dikhao show tell how much many of for from to available quantity stock stok packet packets pcs piece pieces bottle bottles sales sale sel sold bika biki becha kharida purchase purchases purchse customer customers custmer supplier suppliers suplier staff staf employee cashier category expense expenses expns kharcha kharch spending spent cost total report balance balnce khata khatta ledger history statement transactions entries payments payment pymnt received receive collection performance bill invoice receipt details number godown warehouse location batches batch lots lot please mera uska the and on at amount current due udhar baki dena lena diya paisa made business hindi english क्या कितना कितनी कितने से को का की के ने में है हैं बताओ दिखाओ मैगी बिक्री स्टॉक बचा बिकी खरीदा खरीद ग्राहक सप्लायर कर्मचारी खर्च बकाया खाता हिसाब भुगतान गोदाम बैच पैसा';
const stop=new Set([...words.split(' ').filter(w=>w!=='मैगी'),'hisab','hisaab','kg','box','is','are','hui','hua','hoga','thi','tha','par','pe','give','do','kholo','get','see','by','was','were','who','which','kiya','huye','gaya','total','लेना','देना','दिया','किया','हुआ','हुई','रहा','चाहिए','किया']);
export function extractEntity(question:string,kind:EntityKind):{search:string;quantity?:number;unitSearch?:string;variantSearch?:string} {
  const original=normalize(question,false);
  const quantity=kind==='item'?Number(original.match(/(?:^|\s)(\d+(?:\.\d+)?)\s+(?:packet|packets|pcs|piece|pieces|bottle|bottles|kg|box)?\s*/)?.[1]):undefined;
  const unitSearch=kind==='item'?original.match(/\b(packet|packets|pcs|piece|pieces|bottle|bottles|kg|box)\b/)?.[1]:undefined;
  if(kind==='bill')return {search:original.match(/\b(?:pos|inv)[\w/-]+/i)?.[0]||original.split(' ').filter(w=>!stop.has(w)).join(' ')};
  const search=stripDates(original).split(/\s+/).filter(w=>!stop.has(w)&&!/^\d+(?:\.\d+)?$/.test(w)).join(' ').trim();
  return {search,quantity:quantity&&Number.isFinite(quantity)?quantity:undefined,unitSearch};
}

