import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { MapDbRecord } from "../../types";

export async function handleGetMapsTop(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path !== "/maps/top" || method !== "GET") return null;

  const sortParam = url.searchParams.get("sort");
  const countParam = url.searchParams.get("count");
  const pageParam = url.searchParams.get("page");
  const langParam = url.searchParams.get("lang");
  const tagParam = url.searchParams.get("noTags");
  const versionParam = url.searchParams.get("version");

  const validSorts = new Set(["created", "rating", "visits"]);

  const sort = validSorts.has(sortParam ?? "")
    ? (sortParam as "created" | "rating" | "visits")
    : "created";

  const count = Math.min(Math.max(Number(countParam) || 30, 10), 300);
  const page = Math.max(Number(pageParam) || 0, 0);
  const offset = count * page;

  const version = Number(versionParam) || 1000000;

  logInfo(requestId, "route.maps.top.hit", {
    sort,
    count,
    page,
    offset,
    version,
  });

  const filters: string[] = ["version <= ?"];
  const binds: any[] = [version];

  if (langParam?.trim()) {
    filters.push("language = ?");
    binds.push(langParam.trim());
  }

  if (tagParam?.trim()) {
    tagParam
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((tag) => {
        filters.push("tag NOT LIKE ?");
        binds.push(`%${tag}%`);
      });
  }

  const where = `WHERE ${filters.join(" AND ")}`;
  const sortMap: Record<string, string> = {
    rating: "rating_count",
    visits: "visit_count",
    created: "created_at",
  };
  const sortOrder = sortMap[sort] || "created_at";

  const result = await env.DB.prepare(
    `
    SELECT *
    FROM maps_latest
    ${where}
    ORDER BY ${sortOrder} DESC
    LIMIT ? OFFSET ?
    `,
  )
    .bind(...binds, count, offset)
    .all<MapDbRecord>();

  if (!result || !result.success) {
    logWarn(requestId, "route.maps.top.db_error", {
      error: result.error,
    });
    return bad("Database error", 500);
  }

  logInfo(requestId, "route.maps.top.ok", {
    sort,
    count,
    page,
    offset,
    fetched: result.results.length,
  });
  return json(result.results);
}
