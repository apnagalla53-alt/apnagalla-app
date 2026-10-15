import axios from 'axios';
import { createUuid, sha256Hex } from './browserCrypto';
import { useAuthStore } from './store/authStore';
import { Capacitor } from '@capacitor/core';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '')
    .replace(/\/+$/, '').replace(/(?:\/api\/v1)+$/, '') + '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  withCredentials: true,
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  if (config.data instanceof FormData) config.headers.delete('Content-Type');
  const state = useAuthStore.getState();
  const financial=config.method==='post'&&/\/retail\/(bills(?:\/amount-sale|\/return)?|purchases|expenses|(?:customers|suppliers)\/[0-9a-f-]+\/payments)$/.test(config.url||'');
  const entityCreate=config.method==='post'&&/\/retail\/(?:items(?:\/inline|\/bulk)?|customers|suppliers)$/.test(config.url||'');
  const intakeConfirm=config.method==='post'&&/\/retail\/account\/intake\/[0-9a-f-]+\/confirm$/.test(config.url||'');
  if((financial||entityCreate||intakeConfirm)&&!config.headers['Idempotency-Key']) {
    const fingerprint=JSON.stringify([state.user?.id,state.tenantContext?.company_id,state.tenantContext?.branch_id,state.tenantContext?.financial_year_id,config.url,config.data]);
    const identity=await sha256Hex(fingerprint);
    const pending:Record<string,string>=JSON.parse(localStorage.getItem('evolix-pending-writes')||'{}');
    const key=pending[identity]||createUuid();pending[identity]=key;
    localStorage.setItem('evolix-pending-writes',JSON.stringify(pending));
    config.headers['Idempotency-Key']=key;
    (config as any).pendingIdentity=identity;
  }
  (config as any).authEpoch=state.authEpoch;
  if(Capacitor.isNativePlatform())config.headers['X-Evolix-Client']='native';
  if (state.session_id && state.session_id!=='cookie') {
    config.headers['Authorization'] = `Bearer ${state.session_id}`;
  }
  if(state.session_id==='cookie'&&state.csrf_token)config.headers['X-CSRF-Token']=state.csrf_token;
  if (state.tenantContext?.company_id) {
    config.headers['X-Company-Id'] = state.tenantContext.company_id;
  }
  if (state.tenantContext?.branch_id) {
    config.headers['X-Branch-Id'] = state.tenantContext.branch_id;
  }
  if (state.tenantContext?.financial_year_id) config.headers['X-Financial-Year-Id'] = state.tenantContext.financial_year_id;
  return config;
});

api.interceptors.response.use(
  (response) => { if((response.config as any).experienceEvent)return response;clearPending(response.config);if(['post','patch','put','delete'].includes(response.config.method||'')&&!/\/(?:quote|query)$/.test(response.config.url||''))window.dispatchEvent(new Event('evolix-data-changed'));window.dispatchEvent(new CustomEvent('evolix-api-recovered',{detail:response.config.url}));return response; },
  (error) => {
    if(error.config?.experienceEvent)return Promise.reject(error);
    if(error.response?.status>=400&&error.response?.status<500&&error.response?.status!==408)clearPending(error.config);
    if (import.meta.env.DEV) console.error('API request failed', error.config?.method, error.config?.url, error.response?.status || 'NETWORK');
    window.dispatchEvent(new CustomEvent('evolix-api-error', { detail: {message:getApiErrorMessage(error),url:error.config?.url} }));
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // If it's 401, token might be invalid or expired.
      if (error.response.status === 401 && !error.config?.url?.endsWith('/auth/login') && !['/login', '/platform/login'].includes(window.location.pathname)) {
         const currentToken=useAuthStore.getState().session_id;
         // A delayed failure from a previous session must not log out a new session.
         if(currentToken&&(error.config as any)?.authEpoch===useAuthStore.getState().authEpoch)useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;

function clearPending(config:any) {
  if(!config?.pendingIdentity)return;
  const pending=JSON.parse(localStorage.getItem('evolix-pending-writes')||'{}');delete pending[config.pendingIdentity];
  localStorage.setItem('evolix-pending-writes',JSON.stringify(pending));
}

export function getApiErrorMessage(error: any): string {
  const status = error.response?.status;
  const message = error.response?.data?.message;
  if (status === 401) return 'Your session expired. Please sign in again.';
  if (status === 403) return typeof message === 'string' ? message : 'You do not have access to this shop.';
  if (status === 404) return 'The requested information was not found.';
  if (status === 429) {
    const delay=Number(error.response?.data?.retry_after_seconds||error.response?.headers?.['retry-after']);
    return Number.isFinite(delay)&&delay>0&&delay<=60?'Too many requests. Try again in '+Math.ceil(delay)+' seconds.':'Too many requests. Please wait before trying again.';
  }
  if (status >= 500) {
    const reference=error.response?.data?.request_id || error.response?.headers?.['x-request-id'];
    const suffix=typeof reference==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)?' Reference: '+reference:'';
    return 'The server could not complete this request. Please try again.'+suffix;
  }
  if (Array.isArray(message)) return message.join('. ');
  if (typeof message === 'string') return message;
  return status ? 'Could not complete this request. Please try again.' : 'Cannot connect to the server. Please try again.';
}
