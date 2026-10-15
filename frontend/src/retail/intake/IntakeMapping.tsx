import { trackExperience } from "../experience/experienceEvents";
import { useState } from "react";
import { MobileSelect, Sheet } from "../components/MobileControls";
import { ui } from "../../i18n";
import api, { getApiErrorMessage } from "../../shared/api";
import { fieldLabels } from "./intakeCopy";
export default function IntakeMapping({
  job,
  onClose,
  onSaved,
}: {
  job: any;
  onClose: () => void;
  onSaved: (data: any) => void;
}) {
  const [mapping, setMapping] = useState<Record<string, string>>(
      job.configuration.mapping || {},
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Sheet open title="Check your columns" onClose={onClose}>
      <p className="xp-muted">
        {ui(
          "We matched familiar headings. Choose what the other columns mean.",
        )}
      </p>
      {job.configuration.headers.map((column: string) => (
        <div className="r-input-group" key={column}>
          <label htmlFor={"map-" + column}>{column}</label>
          <MobileSelect
            id={"map-" + column}
            title={column}
            value={
              Object.entries(mapping).find(([, v]) => v === column)?.[0] || ""
            }
            onChange={(e) =>
              setMapping((old) => {
                const next = Object.fromEntries(
                  Object.entries(old).filter(
                    ([k, v]) => v !== column && k !== e.target.value,
                  ),
                );
                if (e.target.value) next[e.target.value] = column;
                return next;
              })
            }
          >
            <option value="">{ui("Ignore")}</option>
            {Object.entries(fieldLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {ui(label)}
              </option>
            ))}
          </MobileSelect>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
      <button
        className="r-btn r-btn--primary r-w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            onSaved(
              (
                await api.post(
                  "/retail/account/intake/" + job.id + "/mapping",
                  { mapping },
                )
              ).data,
            );
            trackExperience("excel_mapping_reviewed", { workflow: "INTAKE" });
            onClose();
          } catch (e) {
            setError(getApiErrorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {ui(busy ? "Checking…" : "Continue")}
      </button>
    </Sheet>
  );
}
