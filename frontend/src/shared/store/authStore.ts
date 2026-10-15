import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearNativeGoogleState } from '../googleNative';
import { createUuid } from '../browserCrypto';

export interface User {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  roles: any[];
  permissions: string[];
  is_platform?: boolean;
  organization_id?: string;
  organization_name?: string;
  role?: string;
  must_change_password?: boolean;
  password_min_length?: number;
  onboarding_state?: string;
}

export interface TenantContext {
  organization_id: string;
  organization_name: string;
  company_id: string;
  company_name: string;
  branch_id: string;
  branch_name: string;
  financial_year_id?: string;
  financial_year_label?: string;
}

interface AuthState {
  session_id: string | null;
  csrf_token: string | null;
  authEpoch: string;
  user: User | null;
  tenantContext: TenantContext | null;
  login: (session_id: string | undefined, user: User, csrf_token?:string) => void;
  logout: () => void;
  clearSession: () => void;
  setTenantContext: (ctx: TenantContext) => void;
  setCompany: (id: string, name: string) => void;
  setBranch: (id: string, name: string) => void;
  setFinancialYear: (id: string, label: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session_id: null,
      csrf_token:null,
      authEpoch:createUuid(),
      user: null,
      tenantContext: null,
      login: (session_id, user, csrf_token) => set({ session_id:session_id||'cookie', csrf_token:csrf_token||null, authEpoch:createUuid(), user, tenantContext: null }),
      clearSession: () => set({ session_id:null, csrf_token:null, authEpoch:createUuid(), user:null, tenantContext:null }),
      logout: () => {
        navigator.serviceWorker?.controller?.postMessage({type:'PURGE_INTAKE_SHARED'});
        const destination = window.location.pathname.startsWith('/platform') ? '/platform/login' : '/login';
        set({ session_id: null, csrf_token:null, authEpoch:createUuid(), user: null, tenantContext: null });
        void clearNativeGoogleState().finally(()=>{window.location.href = destination;});
      },
      setTenantContext: (ctx) => set({ tenantContext: ctx }),
      setCompany: (id, name) =>
        set((state) => ({
          tenantContext: state.tenantContext
            ? { ...state.tenantContext, company_id: id, company_name: name }
            : null,
        })),
      setBranch: (id, name) =>
        set((state) => ({
          tenantContext: state.tenantContext
            ? { ...state.tenantContext, branch_id: id, branch_name: name }
            : null,
        })),
      setFinancialYear: (id, label) =>
        set((state) => ({
          tenantContext: state.tenantContext
            ? { ...state.tenantContext, financial_year_id: id, financial_year_label: label }
            : null,
        })),
    }),
    {
      name: 'evolix-auth',
      version:1,
      partialize: state=>({session_id:state.session_id==='cookie'?'cookie':null,csrf_token:state.csrf_token,authEpoch:state.authEpoch,user:state.user,tenantContext:state.tenantContext}),
      // Older storage contained a JWT. Remove it rather than carry credentials
      // into the new persistent state. Existing users sign in once again.
      migrate: ()=>({session_id:null,csrf_token:null,authEpoch:createUuid(),user:null,tenantContext:null}),
    }
  )
);
