import { json } from "../../utils/response";
import { logInfo } from "../../utils/logger";
import { MapsOverviewBody } from "../../types";

export async function handleGetMapsOverview(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path !== "/maps/overview" || request.method.toUpperCase() !== "GET") {
    return null;
  }

  const langParam = url.searchParams.get("lang");
  const tagParam = url.searchParams.get("noTags");
  const versionParam = url.searchParams.get("version");

  const version = Number(versionParam) || 1000000;

  logInfo(requestId, "route.maps.overview.hit");

  const filters: string[] = ["version <= ?"];
  const binds: any[] = [version];

  if (langParam?.trim() && langParam.trim() !== "All") {
    filters.push("language = ?");
    binds.push(langParam.trim());
  }

  if (tagParam?.trim()) {
    tagParam
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((tag) => {
        filters.push("(',' || tag || ',') NOT LIKE ?");
        binds.push(`%${tag}%`);
      });
  }

  const where = `WHERE ${filters.join(" AND ")}`;
  const totalsRow = await env.DB.prepare(
    `
    SELECT
        COUNT(*) AS maps_count,
        SUM(visit_count) AS visits_count,
        SUM(rating_count) AS ratings_count
    FROM maps_latest
    ${where}
    `,
  )
    .bind(...binds)
    .first<{
      maps_count: number;
      visits_count: number;
      ratings_count: number;
    }>();

  const last24hRow = await env.DB.prepare(
    `
    SELECT
        COUNT(*) AS maps_today,
        SUM(visit_count) AS visits_today,
        SUM(rating_count) AS ratings_today
    FROM maps_latest
    ${where} AND created_at >= datetime('now', '-1 day')
    `,
  )
    .bind(...binds)
    .first<{
      maps_today: number;
      visits_today: number;
      ratings_today: number;
    }>();

  const body: MapsOverviewBody = {
    maps_count: totalsRow?.maps_count ?? 0,
    visits_count: totalsRow?.visits_count ?? 0,
    ratings_count: totalsRow?.ratings_count ?? 0,
    maps_today: last24hRow?.maps_today ?? 0,
    visits_today: last24hRow?.visits_today ?? 0,
    ratings_today: last24hRow?.ratings_today ?? 0,
  };

  logInfo(requestId, "route.maps.overview.total", { result: body });

  return json(body);
}
