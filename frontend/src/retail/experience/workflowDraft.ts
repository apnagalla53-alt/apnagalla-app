import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../../shared/store/authStore";
const prefix = "evolix-work-draft:",
  lifetime = 8 * 60 * 60 * 1000;
export function workflowScope() {
  const s = useAuthStore.getState(),
    t = s.tenantContext;
  return s.user?.id && t?.company_id && t.branch_id
    ? [
        s.user.id,
        t.organization_id,
        t.company_id,
        t.branch_id,
        t.financial_year_id,
      ].join(":")
    : "";
}
const keyFor = (flow: string, scope = workflowScope()) =>
  scope ? prefix + scope + ":" + flow : "";
export function readWorkflowDraft<T>(
  flow: string,
  scope = workflowScope(),
): T | null {
  const key = keyFor(flow, scope);
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const row = JSON.parse(raw);
    if (
      row.version !== 1 ||
      !Number.isFinite(row.expires) ||
      row.expires < Date.now()
    ) {
      sessionStorage.removeItem(key);
      return null;
    }
    return row.data as T;
  } catch {
    return null;
  }
}
export function writeWorkflowDraft(
  flow: string,
  data: unknown,
  scope = workflowScope(),
) {
  const key = keyFor(flow, scope);
  if (!key) return;
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ version: 1, expires: Date.now() + lifetime, data }),
    );
  } catch {
    /* Current mounted form remains usable when storage is full/blocked. */
  }
}
export function clearWorkflowDraft(flow: string, scope = workflowScope()) {
  const key = keyFor(flow, scope);
  if (key)
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Optional local recovery. */
    }
}
export function useWorkflowDraft(flow: string, data: unknown) {
  const [resumed] = useState(() => !!readWorkflowDraft(flow)),
    latest = useRef(data),
    cleared = useRef(false),
    scope = workflowScope();
  latest.current = data;
  useEffect(() => {
    if (cleared.current) return;
    const timer = setTimeout(
      () => writeWorkflowDraft(flow, latest.current, scope),
      120,
    );
    return () => clearTimeout(timer);
  }, [flow, scope, JSON.stringify(data)]);
  useEffect(() => {
    const flush = () => {
      if (!cleared.current) writeWorkflowDraft(flow, latest.current, scope);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
    };
  }, [flow, scope]);
  return {
    resumed,
    clear: () => {
      cleared.current = true;
      clearWorkflowDraft(flow, scope);
    },
  };
}
useAuthStore.subscribe((state, previous) => {
  if (previous.user && !state.user) {
    try {
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith(prefix)) sessionStorage.removeItem(key);
    } catch {
      /* No persistent draft if storage is unavailable. */
    }
  }
});
