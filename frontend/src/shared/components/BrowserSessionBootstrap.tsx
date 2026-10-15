import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '../store/authStore';

const base=(import.meta.env.VITE_API_URL||import.meta.env.VITE_API_BASE_URL||'').replace(/\/+$/,'').replace(/(?:\/api\/v1)+$/,'')+'/api/v1';
export default function BrowserSessionBootstrap({children}:{children:ReactNode}) {
  const skip=Capacitor.isNativePlatform()||window.location.pathname.startsWith('/platform')||(window.location.pathname!=='/auth/continue'&&!!useAuthStore.getState().user?.is_platform);
  const [ready,setReady]=useState(skip),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{
    if(skip)return;
    let current=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),70000);
    (async()=>{
      try {
        const response=await fetch(base+'/auth/session',{credentials:'include',signal:controller.signal});
        if(!current)return;
        if(response.status===401){useAuthStore.getState().clearSession();setReady(true);return;}
        if(!response.ok)throw new Error('Could not check your account. Please retry.');
        const profile=await response.json();if(!current)return;
        useAuthStore.getState().login(undefined,profile.user,profile.csrf_token);
        if(profile.tenant_context)useAuthStore.getState().setTenantContext(profile.tenant_context);
        setReady(true);setError('');
      }catch{if(current)setError('Cannot connect to your shop. Check your connection and try again.');}
      finally{clearTimeout(timer);}
    })();
    return ()=>{current=false;clearTimeout(timer);controller.abort();};
  },[skip,revision]);
  if(!ready)return <main className="login-container"><section className="login-card">{error?<><h1>Could not open your shop</h1><p role="alert">{error}</p><button onClick={()=>{setError('');setRevision(v=>v+1);}}>Try again</button></>:<p role="status">Checking your account…</p>}</section></main>;
  return <>{children}</>;
}
export function ContinueWebsiteSession() {
  const user=useAuthStore(s=>s.user),session=useAuthStore(s=>s.session_id);
  return <Navigate replace to={!session?'/login':user?.is_platform?'/platform/dashboard':user?.must_change_password?'/change-password':user?.onboarding_state&&user.onboarding_state!=='READY'?'/onboarding':'/retail/home'}/>;
}
