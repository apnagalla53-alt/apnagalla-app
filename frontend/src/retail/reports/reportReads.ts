import type { AxiosResponse } from 'axios';
import api from '../../shared/api';
import { useAuthStore } from '../../shared/store/authStore';

const cache=new Map<string,{until:number;response:AxiosResponse}>();
const pending=new Map<string,Promise<AxiosResponse>>();
let generation=0;
export function clearReportReads(){generation++;cache.clear();pending.clear();}
window.addEventListener('evolix-data-changed',clearReportReads);
useAuthStore.subscribe((next,previous)=>{if(next.authEpoch!==previous.authEpoch||JSON.stringify(next.tenantContext)!==JSON.stringify(previous.tenantContext))clearReportReads();});

/** Short, session-and-shop-scoped reuse for read-only reports. Financial writes clear it. */
export async function readReport<T=any>(path:string,params:Record<string,unknown>={}):Promise<AxiosResponse<T>>{
  if(!path.startsWith('/retail/reports/')&&path!=='/retail/galla')throw Error('Only read-only reports may be reused');
  const state=useAuthStore.getState(),key=JSON.stringify([state.authEpoch,state.user?.id,state.tenantContext,path,Object.entries(params).filter(([,value])=>value!==undefined).sort(([a],[b])=>a.localeCompare(b))]);
  const hit=cache.get(key);
  if(hit&&hit.until>Date.now())return {...hit.response,data:structuredClone(hit.response.data)};
  let request=pending.get(key);
  if(!request){
    const started=generation;
    request=(async()=>{
      let response:AxiosResponse;
      try{response=await api.get(path,{params});}
      catch(error:any){
        const delay=Number(error.response?.data?.retry_after_seconds||error.response?.headers?.['retry-after']);
        // One read retry only when the server's window is about to reopen. Long
        // limits remain visible; no loop, guessed delay or financial POST retry.
        if(error.response?.status!==429||!Number.isFinite(delay)||delay<=0||delay>2)throw error;
        await new Promise(resolve=>window.setTimeout(resolve,delay*1000+100));
        if(started!==generation)throw error;
        response=await api.get(path,{params});
      }
      if(started===generation){if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,{until:Date.now()+10000,response});}
      return response;
    })();
    pending.set(key,request);
    const remove=()=>{if(pending.get(key)===request)pending.delete(key);};
    void request.then(remove,remove);
  }
  const response=await request;
  const latest=useAuthStore.getState();
  if(latest.authEpoch!==state.authEpoch||JSON.stringify(latest.tenantContext)!==JSON.stringify(state.tenantContext))throw Error('The shop changed while the report was loading. Refresh the report.');
  return {...response,data:structuredClone(response.data)};
}
