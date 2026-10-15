/** Transparent preset hints, using generic product words rather than claimed crowd data. */
export function categorySuggestion(
  name: string,
  categories: { name: string }[],
): string | undefined {
  const normalized = name.normalize("NFKC").toLowerCase();
  const groups = [
    [/\b(rice|wheat|atta|grain|dal|flour)\b/, "rice|grain|grocer"],
    [/\b(biscuit|cookie|cracker)\b/, "biscuit|snack"],
    [/\b(oil|ghee)\b/, "oil"],
    [/\b(milk|curd|paneer|cheese)\b/, "dairy|milk"],
    [/\b(shirt|kurta|trouser|jeans|dress|saree)\b/, "clothing|garment"],
    [/\b(tablet|capsule|syrup)\b/, "medicine|pharmacy"],
    [/\b(cable|wire|switch|socket)\b/, "electrical|cable|wire"],
    [/\b(shoe|shoes|sandal|sandals|slipper)\b/, "footwear"],
    [/\b(mobile|phone|tablet device)\b/, "mobile|device"],
    [/\b(tea|coffee|juice)\b/, "tea|drink"],
    [/\b(pen|pencil|notebook|paper)\b/, "stationery|paper|writing"],
  ] as const;
  for (const [pattern, category] of groups)
    if (pattern.test(normalized)) {
      const match = categories.find((c) =>
        new RegExp(category, "i").test(c.name),
      );
      if (match) return match.name;
    }
  return categories.find((c) => normalized.includes(c.name.toLowerCase()))
    ?.name;
}
