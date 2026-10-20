import { useEffect } from 'react';
import { create } from 'zustand';
import api, { getApiErrorMessage } from '../../shared/api';
import { useAuthStore } from '../../shared/store/authStore';
import type { BusinessPreset } from '../experience/useBusinessPreset';

export type ShopFeature={code:string;name:string;group:string;description:string;required_plan:string|null;commercial_state?:string;core:boolean;plan_entitled:boolean;shop_enabled:boolean;enabled:boolean;rollout_enabled:boolean;override:boolean|null};
export type RetailPlan={id:string;code:string;name:string;monthly_price:number;description:string;limits:Record<string,number>;features:{code:string;name:string;group:string}[]};
export type SubscriptionAccess={additional_business_types?:string[];business_preset?:BusinessPreset;business_type?:string;current:{status:string;plan_name:string;plan_code:string;monthly_price:number;expires_at:string;complimentary:boolean}|null;entitlements:{plan:RetailPlan|null;subscription_status:string;subscription_active:boolean;features:ShopFeature[];limits:Record<string,number>;synced_at:string};plans:RetailPlan[];payments:{id:string;plan_name:string;amount:string;tax:string;discount:string;status:string;method:string;reference:string;paid_at:string;refund_amount:string}[];payment_provider:{status:string;checkout_available:boolean};voice_provider:{status:string;available:boolean};backup_provider:{configured:boolean;provider:string}};
type State={scope:string;data:SubscriptionAccess|null;loading:boolean;error:string;loadedAt:number};
const store=create<State>(()=>({scope:'',data:null,loading:false,error:'',loadedAt:0}));
const inFlight=new Map<string,Promise<void>>();
const scopeNow=()=>{const s=useAuthStore.getState();return [s.user?.id,s.tenantContext?.company_id,s.session_id].join(':');};
export async function refreshRetailEntitlements(force=false) {
  const scope=scopeNow(),auth=useAuthStore.getState();
  if(!auth.user||auth.user.is_platform||!auth.tenantContext?.company_id)return;
  if(inFlight.has(scope))return inFlight.get(scope);
  const current=store.getState();
  if(!force&&current.scope===scope&&current.data&&Date.now()-current.loadedAt<60000)return;
  store.setState({scope,loading:true,error:'',...(current.scope!==scope?{data:null}: {})});
  const promise=(async()=>{try{const response=await api.get<SubscriptionAccess>('/retail/account/subscription');if(scopeNow()===scope)store.setState({scope,data:response.data,loadedAt:Date.now(),error:''});}catch(error){if(scopeNow()===scope)store.setState({error:getApiErrorMessage(error)});}finally{inFlight.delete(scope);if(scopeNow()===scope)store.setState({loading:false});}})();
  inFlight.set(scope,promise);return promise;
}
useAuthStore.subscribe((state,previous)=>{if(state.session_id!==previous.session_id||state.tenantContext?.company_id!==previous.tenantContext?.company_id)store.setState({scope:'',data:null,loadedAt:0,error:''});});
export function useRetailEntitlements() {
  const user=useAuthStore(s=>s.user),tenant=useAuthStore(s=>s.tenantContext),token=useAuthStore(s=>s.session_id);
  const state=store(),scope=[user?.id,tenant?.company_id,token].join(':');
  useEffect(()=>{void refreshRetailEntitlements();},[scope]);
  const data=state.scope===scope?state.data:null;
  const feature=(code:string)=>data?.entitlements.features.find(f=>f.code===code);
  return {data,loading:state.scope!==scope||state.loading,error:state.scope===scope?state.error:'',refresh:refreshRetailEntitlements,
    hasEntitlement:(code:string)=>!!feature(code)?.plan_entitled,isShopFeatureEnabled:(code:string)=>!!feature(code)?.shop_enabled,
    isFeatureEffective:(code:string)=>!!feature(code)?.enabled,getFeatureLimit:(code:string)=>data?.entitlements.limits[code]??null,
    canManage:['OWNER','ADMIN','TENANT_ADMIN'].includes(user?.role||'')};
}
