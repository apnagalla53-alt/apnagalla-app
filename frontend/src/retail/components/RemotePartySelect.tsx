import { ui, useUiLanguage } from "../../i18n";
import { useEffect, useState } from "react";
import api, { getApiErrorMessage } from "../../shared/api";
import { MobileSelect, type MobileSelectProps } from "./MobileControls";
type Party = {
  id: string;
  name: string;
  mobile?: string;
  outstanding_amount: number;
  active: boolean;
  credit_allowed?: boolean;
};
export default function RemotePartySelect({
  supplier = false,
  records,
  onLoaded,
  filter,
  ...props
}: MobileSelectProps & {
  supplier?: boolean;
  records: Party[];
  onLoaded: (p: Party[]) => void;
  filter?: (p: Party) => boolean;
}) {
  useUiLanguage();
  const [query, setQuery] = useState(""),
    [rows, setRows] = useState<Party[]>(records),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await api.get(
          "/retail/" + (supplier ? "suppliers" : "customers"),
          { params: { search: query, offset, limit: 100 } },
        );
        if (active) {
          setRows((p) => (offset ? [...p, ...r.data] : r.data));
          setMore(r.data.length === 100);
          onLoaded(r.data);
          setError("");
        }
      } catch (e) {
        if (active) setError(getApiErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, offset, supplier, retry]);
  const current = records.find((p) => p.id === props.value),
    choices =
      current && !rows.some((p) => p.id === current.id)
        ? [current, ...rows]
        : rows;
  return (
    <MobileSelect
      {...props}
      onSearch={(s) => {
        setQuery(s);
        setOffset(0);
      }}
      loading={loading}
      error={error}
      onRetry={() => setRetry((n) => n + 1)}
      onMore={more && !loading ? () => setOffset((n) => n + 100) : undefined}
    >
      <option value="">{ui("Select")} {supplier ? "supplier" : "customer"}</option>
      {choices
        .filter((p) => p.id === props.value || p.active !== false && (!filter || filter(p)))
        .map((p) => (
          <option value={p.id} key={p.id}>
            {p.name}
            {p.mobile ? " · " + p.mobile : ""}
            {p.outstanding_amount
              ? " · ₹" + Number(p.outstanding_amount).toLocaleString("en-IN")
              : ""}
          </option>
        ))}
    </MobileSelect>
  );
}
