import { useState, useRef } from "react";
import { Pencil, Trash2, RotateCcw } from "lucide-react";
import { useAuthStore } from "../../shared/store/authStore";
import api, { getApiErrorMessage } from "../../shared/api";
import { ui } from "../../i18n";
import { Sheet } from "./MobileControls";
import {ItemActionsLauncher} from './ItemActionsSheet';
export function useCanManageMaster(kind: "items" | "customers" | "suppliers") {
  const user = useAuthStore((s) => s.user);
  return (
    !!user &&
    (["OWNER", "ADMIN", "TENANT_ADMIN"].includes(user.role || "") ||
      user.roles?.some((role: any) =>
        ["OWNER", "ADMIN", "TENANT_ADMIN"].includes(
          role.name || role.role?.name,
        ),
      ) ||
      user.permissions?.includes(
        kind === "items"
          ? "inventory.write"
          : kind === "suppliers"
            ? "purchase.write"
            : "accounting.write",
      ))
  );
}
export default function MasterRecordActions({
  kind,
  id,
  name,
  active = true,
  onEdit,
  onChanged,
}: {
  kind: "items" | "customers" | "suppliers";
  id: string;
  name: string;
  active?: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const allowed = useCanManageMaster(kind),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    lock = useRef(false);
  const change = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (active) await api.delete("/retail/" + kind + "/" + id);
      else if (kind === "items")
        await api.post("/retail/items/" + id, { active: true });
      else await api.patch("/retail/" + kind + "/" + id, { active: true });
      setConfirm(false);
      onChanged();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!allowed) return null;
  if(kind==='items')return <ItemActionsLauncher id={id} name={name} onEdit={onEdit} onChanged={onChanged}/>;
  return (
    <>
      <div className="r-secondary-workflows">
        <button type="button" onClick={onEdit}>
          <Pencil size={18} />
          {ui("Edit")}
        </button>
        <button
          type="button"
          onClick={() => {
            setError("");
            setConfirm(true);
          }}
        >
          {active ? <Trash2 size={18} className="r-text-danger" /> : <RotateCcw size={18} />}{" "}
          {ui(active ? "Delete" : "Restore")}
        </button>
      </div>
      <Sheet
        open={confirm}
        onClose={() => !busy && setConfirm(false)}
        title={ui(active ? "Delete record" : "Restore record")}
      >
        <p>
          <strong>{name}</strong>
        </p>
        <p>
          {ui(
            active
              ? "This removes the record from new transactions. Past bills, balances and stock history are kept. You can restore it later."
              : "This makes the record available for new transactions again.",
          )}
        </p>
        {active && (
          <p>
            {ui("An account with a pending balance must be settled first.")}
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <button
          className="r-btn r-btn--primary r-w-full"
          disabled={busy}
          onClick={() => void change()}
        >
          {ui(busy ? "Saving…" : active ? "Confirm Delete" : "Confirm Restore")}
        </button>
        <button
          className="r-btn r-w-full"
          disabled={busy}
          onClick={() => setConfirm(false)}
        >
          {ui("Cancel")}
        </button>
      </Sheet>
    </>
  );
}
