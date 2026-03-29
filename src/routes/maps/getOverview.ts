import { json } from "../../utils/response";
import { logInfo } from "../../utils/logger";
import { MapsOverviewBody } from "../../types";
import { buildSharedQuery } from "./buildSharedQuery";

export async function handleGetMapsOverview(
  request: Request,
  env: Env,
  requestId: string,
  bypass = false,
): Promise<Response | null> {
  const url = new URL(request.url);

  const langParam = url.searchParams.get("lang");
  const tagParam = url.searchParams.get("noTags");
  const versionParam = url.searchParams.get("version");
  const daysParam = url.searchParams.get("days");

  const { filters, binds } = buildSharedQuery(
    versionParam,
    langParam,
    tagParam,
    daysParam,
  );

  const where = `WHERE ${filters.join(" AND ")}`;

  const row = await env.DB.prepare(
    `
    SELECT
      (SELECT COUNT(*) FROM maps_latest m ${where}) AS maps_count,

      (SELECT SUM(m.visit_count) FROM maps_latest m ${where}) AS visits_count,

      (SELECT SUM(m.rating_count) FROM maps_latest m ${where}) AS ratings_count,

      (SELECT COUNT(*)
      FROM maps_latest m
      ${where} AND m.created_at >= datetime('now', '-1 day')
      ) AS maps_today,

      (SELECT COUNT(*)
      FROM ratings r
      JOIN maps_latest m ON m.id = r.map_id
      ${where} AND r.visited_at >= datetime('now', '-1 day')
      ) AS visits_today,

      (SELECT COUNT(*)
      FROM ratings r
      JOIN maps_latest m ON m.id = r.map_id
      ${where} AND r.rated_at >= datetime('now', '-1 day')
      ) AS ratings_today
    `,
  )
    .bind(...[...binds, ...binds, ...binds, ...binds, ...binds, ...binds])
    .first<MapsOverviewBody>();

  const body: MapsOverviewBody = {
    maps_count: row?.maps_count ?? 0,
    visits_count: row?.visits_count ?? 0,
    ratings_count: row?.ratings_count ?? 0,
    maps_today: row?.maps_today ?? 0,
    visits_today: row?.visits_today ?? 0,
    ratings_today: row?.ratings_today ?? 0,
  };

  logInfo(requestId, "route.maps.overview.total", { result: body });

  return json(body);
}
