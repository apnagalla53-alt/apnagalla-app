import { useRetailEntitlements } from "../subscription/useRetailEntitlements";
export type BusinessPreset = {
  family: string;
  serviceCalculator?: boolean;
  serviceSuggestions?: string[];
  additionalBusinessTypes?: string[];
  intakeOrder?: string[];
  voiceExample?: string;
  key: string;
  displayName: string;
  recommendedUnits: string[];
  unitSuggestions: { code: string; name: string; selling_mode: string }[];
  recommendedCategories: {
    name: string;
    units: string[];
    capabilities?: string[];
    family?: string;
  }[];
  recommendedCapabilities: string[];
  itemPrompts: {
    variants: string;
    multiUnit: string;
    batch: string;
    measured: string;
  };
  defaultQuickActions: string[];
  terminology: { item: string; supplier: string };
  homePriority: string[];
  recommendationPriority: string[];
};
const fallback: BusinessPreset = {
  family: "OTHER",
  key: "OTHER",
  displayName: "Your shop",
  recommendedUnits: ["PCS", "PKT", "BOX", "KG", "LTR"],
  unitSuggestions: [],
  recommendedCategories: [],
  recommendedCapabilities: [],
  itemPrompts: {
    variants: "Different sizes or colours?",
    multiUnit: "Buy and sell in different packs?",
    batch: "Track batch & expiry?",
    measured: "How do you sell this item?",
  },
  defaultQuickActions: [
    "purchases",
    "receive",
    "needs",
    "suppliers",
    "expenses",
  ],
  terminology: { item: "Item", supplier: "Supplier" },
  homePriority: [],
  recommendationPriority: [],
};
export function useBusinessPreset(category?: string) {
  const access = useRetailEntitlements(),
    preset = access.data?.business_preset || fallback;
  const match = preset.recommendedCategories.find(
    (c) => c.name.toLowerCase() === (category || "").toLowerCase(),
  );
  return {
    ...preset,
    family: match?.family || preset.family,
    recommendedUnits: match?.units || preset.recommendedUnits,
    categoryCapabilities: match?.capabilities || [],
    isPersonalized: !!access.data?.business_type && preset.key !== "OTHER",
  };
}
