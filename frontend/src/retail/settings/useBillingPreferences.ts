import { useEffect, useState } from "react";
import api, { getApiErrorMessage } from "../../shared/api";
import { useAuthStore } from "../../shared/store/authStore";
export function useBillingPreferences() {
  const company = useAuthStore((s) => s.tenantContext?.company_id);
  const [enabled, setEnabled] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setEnabled(false);
    const load = () => {
      setLoading(true);
      api
        .get("/retail/account/billing-preferences")
        .then((r) => {
          if (active) {
            setEnabled(r.data.barcode_scanning_enabled === true);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(getApiErrorMessage(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    load();
    window.addEventListener("evolix-billing-preferences", load);
    return () => {
      active = false;
      window.removeEventListener("evolix-billing-preferences", load);
    };
  }, [company]);
  return { enabled, loading, error, setEnabled };
}
