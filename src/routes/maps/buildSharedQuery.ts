export function buildSharedQuery(
  version: string | null,
  lang: string | null,
  noTags: string | null,
  days: string | null,
) {
  const filters: string[] = ["m.version <= ?"];
  const binds: any[] = [Number(version) || 1000000];

  if (lang?.trim() && lang.trim() !== "All") {
    filters.push("m.language = ?");
    binds.push(lang.trim());
  }

  if (noTags?.trim()) {
    noTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((tag) => {
        filters.push("(',' || m.tag || ',') NOT LIKE ?");
        binds.push(`%${tag}%`);
      });
  }

  if (days?.trim()) {
    const daysRange = Number(days);
    if (Number.isInteger(daysRange) && daysRange > 0) {
      filters.push("m.created_at >= datetime('now', ?)");
      binds.push(`-${daysRange} days`);
    }
  }

  return { filters, binds };
}
