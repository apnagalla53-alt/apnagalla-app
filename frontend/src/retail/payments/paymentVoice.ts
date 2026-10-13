import api from '../../shared/api';
import { useAuthStore } from '../../shared/store/authStore';
export type VoiceSettings={enabled:boolean;text:string;language:string;rate:number;shop_name?:string};
export function playGreeting(settings:VoiceSettings):boolean {
  if(!window.speechSynthesis||typeof window.SpeechSynthesisUtterance!=='function')return false;
  try {
  const speech=new SpeechSynthesisUtterance(settings.text.replaceAll('{shop}',settings.shop_name||'our shop'));
  speech.lang=settings.language; speech.rate=settings.rate||0.9;
  const voices=window.speechSynthesis.getVoices();
  const language=settings.language.toLowerCase();
  const voice=voices.find(v=>v.lang.toLowerCase()===language) || voices.find(v=>v.lang.toLowerCase().split('-')[0]===language.split('-')[0]);
  if(voice)speech.voice=voice;
  window.speechSynthesis.cancel();window.speechSynthesis.speak(speech);return true;
  } catch { return false; }
}
export async function notifyPayment(id:string, receivedAmount?:number){
  if(receivedAmount!==undefined&&(!Number.isFinite(receivedAmount)||receivedAmount<=0))return;
  const company=useAuthStore.getState().tenantContext?.company_id;
  const key=`evolix-payment-greeting:${company}:${id}`;
  if(!company||sessionStorage.getItem(key))return;
  try{const settings=(await api.get('/retail/checkout-voice')).data as VoiceSettings;
    if(settings.enabled&&playGreeting(settings))sessionStorage.setItem(key,'played');
  }catch{/* Payment remains saved if this device cannot play a greeting. */}
}
