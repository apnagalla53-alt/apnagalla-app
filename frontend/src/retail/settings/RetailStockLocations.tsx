import StitchHeader from '../design/StitchHeader';
import { ui, useUiLanguage } from "../../i18n";
import StockTransferSheet from "../components/StockTransferSheet";
import { useAuthStore } from "../../shared/store/authStore";
import { MobileSelect, Sheet } from "../components/MobileControls";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, MapPin, Plus } from "lucide-react";
import api, { getApiErrorMessage } from "../../shared/api";

type Location = {
  id: string;
  name: string;
  code?: string;
  branch_id: string;
  address?: string;
  is_default?: boolean;
  is_active?: boolean;
};
export default function RetailStockLocations() {
  useUiLanguage();
  const navigate = useNavigate();
  const branch = useAuthStore((s) => s.tenantContext?.branch_id);
  const [transfer, setTransfer] = useState(false),
    [stock, setStock] = useState<any[] | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canAdd, setCanAdd] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    branch_id: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [locationResponse, branchResponse, accountResponse] =
        await Promise.all([
          api.get("/godowns"),
          api.get("/branches"),
          api.get("/retail/account"),
        ]);
      const list = Array.isArray(locationResponse.data)
        ? locationResponse.data
        : locationResponse.data.data || [];
      const branchList = Array.isArray(branchResponse.data)
        ? branchResponse.data
        : branchResponse.data.data || [];
      setLocations(list);
      setBranches(branchList);
      setForm((previous) => ({
        ...previous,
        branch_id: previous.branch_id || branchList[0]?.id || "",
      }));
      setCanAdd(
        (accountResponse.data.features || []).some(
          (feature: any) =>
            ["MULTIPLE_STOCK_LOCATIONS", "MULTI_LOCATION"].includes(
              feature.key,
            ) && feature.enabled,
        ),
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api.post("/godowns", {
        ...form,
        name: form.name.trim(),
        code: form.code.trim(),
      });
      setShowAdd(false);
      setForm((previous) => ({ ...previous, name: "", code: "", address: "" }));
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <StitchHeader className="r-page-header" hasBack>
        <button
          className="r-btn r-btn--icon"
          aria-label={ui("Back to More")}
          onClick={() => navigate("/retail/more")}
        >
          <ArrowLeft size={22} />
        </button>
        <h1>{ui("Stock Locations")}</h1>
        <Building2 size={24} />
      </StitchHeader>
      <main className="r-section r-account-page">
        <p className="r-caption">
          Your shop uses one default stock location automatically. Additional locations and transfers are reserved for Future Premium. Historical stock remains available to view.
        </p>
        {loading && <p role="status">Loading stock locations…</p>}
        {error && (
          <div className="r-state-message" role="alert">
            <p>{error}</p>
            <button className="r-btn r-btn--outline" onClick={load}>{ui("Try Again")}</button>
          </div>
        )}
        {!loading && !error && !locations.length && (
          <div className="r-empty">
            <Building2 size={40} />
            <h2>No stock locations found</h2>
            <p>Ask your shop administrator to check the store setup.</p>
          </div>
        )}
        {locations.map((location) => (
          <article className="r-card" key={location.id}>
            <h2>
              <MapPin size={22} /> {location.name}
            </h2>
            <button
              className="r-btn r-btn--outline"
              onClick={() => {
                api
                  .get("/inventory/stock", {
                    params: { godown_id: location.id },
                  })
                  .then((r) => setStock(r.data))
                  .catch((e) => setError(getApiErrorMessage(e)));
              }}
            >
              View Stock Here
            </button>
            <div className="r-detail-row">
              <span>Store</span>
              <strong>
                {branches.find((branch) => branch.id === location.branch_id)
                  ?.name || "Current business"}
              </strong>
            </div>
            <div className="r-detail-row">
              <span>Location code</span>
              <strong>{location.code || "Not specified"}</strong>
            </div>
            {location.address && (
              <p className="r-caption">{location.address}</p>
            )}
            {location.is_default && (
              <span className="r-status-badge is-enabled">
                Default location
              </span>
            )}
          </article>
        ))}
        {canAdd && (
          <button
            className="r-btn r-btn--outline r-btn--full"
            onClick={() => setShowAdd(!showAdd)}
          >
            <Plus size={20} />
            {showAdd ? "Close form" : "Add Stock Location"}
          </button>
        )}
        {showAdd && (
          <Sheet
            open
            onClose={() => setShowAdd(false)}
            title="Add Stock Location"
          >
            <form className="r-card" onSubmit={submit}>
              <h2>Add Stock Location</h2>
              <label htmlFor="location-name">Location name *</label>
              <input
                id="location-name"
                className="r-input"
                required
                maxLength={120}
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
              <label htmlFor="location-code">Location code *</label>
              <input
                id="location-code"
                className="r-input"
                required
                maxLength={30}
                value={form.code}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value })
                }
              />
              <label htmlFor="location-branch">Store</label>
              <MobileSelect
                id="location-branch"
                className="r-select"
                required
                value={form.branch_id}
                onChange={(event) =>
                  setForm({ ...form, branch_id: event.target.value })
                }
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </MobileSelect>
              <label htmlFor="location-address">Address (optional)</label>
              <textarea
                id="location-address"
                className="r-input"
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
              />
              <button
                className="r-btn r-btn--primary r-btn--full"
                disabled={saving}
              >
                {saving ? ui("Saving…") : "Save Stock Location"}
              </button>
            </form>
          </Sheet>
        )}
        <button
          className="r-btn r-btn--outline r-btn--full"
          onClick={() => navigate("/retail/reports/stock")}
        >
          View Stock Report
        </button>
        {canAdd &&
          locations.filter((l) => l.branch_id === branch).length > 1 && (
            <button
              className="r-btn r-btn--primary r-w-full"
              onClick={() => setTransfer(true)}
            >
              Transfer Stock
            </button>
          )}
        {stock && (
          <section className="r-card">
            <h2>Stock in Selected Location</h2>
            {stock.length ? (
              stock.map((s, i) => (
                <p key={i}>
                  {s.item} · {s.quantity}
                </p>
              ))
            ) : (
              <p>No stock in this location.</p>
            )}
            <button className="r-btn" onClick={() => setStock(null)}>
              Close Stock View
            </button>
          </section>
        )}
        {transfer && (
          <StockTransferSheet
            close={() => setTransfer(false)}
            locations={locations.filter((l) => l.branch_id === branch)}
            onSaved={() => {
              setStock(null);
              void load();
            }}
          />
        )}
      </main>
    </>
  );
}
