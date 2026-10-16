import { useEffect, useState } from "react";
import { getApiErrorMessage } from "../../shared/api";
import { readReport } from '../reports/reportReads';
import { useAuthStore } from "../../shared/store/authStore";
import type { ExperienceTone } from "./ExperienceCard";
export type HomeSuggestion = {
  id: string;
  kind: string;
  category: string;
  tone: ExperienceTone;
  title: string;
  description: string;
  why: string;
  action: { label: string; path: string };
  critical: boolean;
  facts: Record<string, string | number>;
};
export type HomeExperience = {
  maturity: "NEW" | "LEARNING" | "ACTIVE";
  activity: {
    sales: number;
    purchases: number;
    items: number | null;
    customers: number | null;
  };
  can: { sell: boolean; buy: boolean; receive: boolean; manageItems: boolean };
  suggestions: HomeSuggestion[];
};
export function useHomeExperience(retry: number) {
  const user = useAuthStore((s) => s.user),
    tenant = useAuthStore((s) => s.tenantContext),
    key = [
      "apna-suggestion-snooze",
      user?.id,
      tenant?.company_id,
      tenant?.branch_id,
    ].join(":");
  const [data, setData] = useState<HomeExperience | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    let hidden: Record<string, number> = {};
    try {
      hidden = JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      /* Empty preference if local storage is unavailable. */
    }
    const dismissed = Object.keys(hidden)
      .filter((id) => Number(hidden[id]) > Date.now())
      .slice(0, 100);
    readReport<HomeExperience>("/retail/account/experience", { dismissed: dismissed.join(",") })
      .then((r) => {
        if (alive) setData(r.data);
      })
      .catch((e) => {
        if (alive) setError(getApiErrorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [key, retry, revision]);
  function snooze(id: string) {
    try {
      const old = JSON.parse(localStorage.getItem(key) || "{}"),
        next: Record<string, number> = {};
      for (const [k, v] of Object.entries(old))
        if (typeof v === "number" && v > Date.now()) next[k] = v;
      next[id] = Date.now() + 7 * 86400000;
      localStorage.setItem(
        key,
        JSON.stringify(Object.fromEntries(Object.entries(next).slice(-100))),
      );
    } catch {
      return;
    }
    setRevision((n) => n + 1);
  }
  return { data, error, snooze };
}
