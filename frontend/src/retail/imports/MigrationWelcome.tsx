import { ui, useUiLanguage } from "../../i18n";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { getApiErrorMessage } from "../../shared/api";
import { useAuthStore } from "../../shared/store/authStore";
import { Sheet } from "../components/MobileControls";

export default function MigrationWelcome() {
  useUiLanguage();
  const user = useAuthStore((s) => s.user),
    tenant = useAuthStore((s) => s.tenantContext),
    navigate = useNavigate(),
    { pathname } = useLocation();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setOpen(false);
    if (
      tenant?.company_id &&
      ["OWNER", "ADMIN", "TENANT_ADMIN"].includes(user?.role || "")
    ) {
      api
        .get("/retail/account/migration")
        .then((r) => {
          if (active) setOpen(!r.data);
        })
        .catch((e) => {
          if (active) setError(getApiErrorMessage(e));
        });
    }
    return () => {
      active = false;
    };
  }, [user?.id, tenant?.company_id]);
  async function choose(choice: string) {
    setBusy(true);
    setError("");
    try {
      await api.post("/retail/account/migration", { choice });
      setOpen(false);
      if (choice === "IMPORT") navigate("/retail/more/import");
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open={open && pathname === "/retail/home"}
      onClose={() => {
        if (!busy) setOpen(false);
      }}
      title="Welcome to your EVOLIX shop"
    >
      <p>
        Already using another billing app? Bring your items, customers,
        suppliers, stock and opening dues with you.
      </p>
      <p>
        Export a spreadsheet from Vyapar, Tally, BUSY or another app. We will
        guide you through mapping and review before saving.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        autoFocus
        className="r-btn r-btn--primary r-btn--full"
        disabled={busy}
        onClick={() => choose("IMPORT")}
      >{ui("Import your data")}</button>
      <button
        className="r-btn r-btn--outline r-btn--full"
        disabled={busy}
        onClick={() => choose("FRESH")}
      >{ui("Start fresh")}</button>
      <p className="r-caption">
        Start fresh continues into your shop; it does not delete any records.
        Import stays available in More.
      </p>
    </Sheet>
  );
}
