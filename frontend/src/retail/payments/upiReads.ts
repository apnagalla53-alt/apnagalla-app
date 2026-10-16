import api from '../../shared/api';
import { useAuthStore } from '../../shared/store/authStore';
let cached:{scope:string;until:number;data:any}|null=null,pending:{scope:string;promise:Promise<any>}|null=null,generation=0;
const clear=()=>{generation++;cached=null;pending=null;};
window.addEventListener('evolix-data-changed',clear);
useAuthStore.subscribe((next,previous)=>{if(next.authEpoch!==previous.authEpoch||next.tenantContext?.company_id!==previous.tenantContext?.company_id)clear();});
/** Reuse static receiving settings briefly while typing amounts. No sale/payment totals are cached. */
export async function readUpiProfiles(){
  const state=useAuthStore.getState(),scope=[state.authEpoch,state.tenantContext?.company_id].join(':'),version=generation;
  if(cached?.scope===scope&&cached.until>Date.now())return structuredClone(cached.data);
  if(!pending||pending.scope!==scope){const promise=api.get('/retail/payments/upi').then(r=>{if(version===generation)cached={scope,until:Date.now()+3000,data:r.data};return r.data;});pending={scope,promise};void promise.then(()=>{if(pending?.promise===promise)pending=null;},()=>{if(pending?.promise===promise)pending=null;});}
  const data=await pending.promise;if(version!==generation)throw Error('Receiving settings changed. Please reload the QR.');return structuredClone(data);
}
