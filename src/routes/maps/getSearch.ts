import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { MapDbRecordWithRating } from "../../types";
import { buildSharedQuery } from "./buildSharedQuery";
import { getClientIp } from "../../utils/request";

export async function handleGetMapsSearch(
  request: Request,
  env: Env,
  requestId: string,
  bypass = false,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (!bypass) {
    const ip = getClientIp(request);
    const success = await env.RL.limit({ key: `search:${ip}` });

    if (!success) {
      return bad("Frequent search", 429);
    }
  }

  const query = url.searchParams.get("query")?.trim();
  const userId = url.searchParams.get("userId");

  if (!query) {
    return json([]);
  }

  const versionParam = url.searchParams.get("version");
  const { filters, binds } = buildSharedQuery(versionParam, null, null, null);

  const whereBase = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  // view id direct access
  if (query.length === 12) {
    const sql = userId
      ? `
        SELECT
          m.*,
          r.map_id AS rating_map_id, r.user_id AS rating_user_id,
          r.rated_at, r.visited_at
        FROM maps m
        LEFT JOIN ratings r
          ON m.id = r.map_id AND r.user_id = ?
        ${whereBase ? whereBase + " AND" : "WHERE"}
          m.view_id = ?
        LIMIT 1
        `
      : `
        SELECT m.*
        FROM maps m
        ${whereBase ? whereBase + " AND" : "WHERE"}
          m.view_id = ?
        LIMIT 1
        `;

    const finalBinds = userId
      ? [userId, ...binds, query]
      : [...binds, query];

    const result = await env.DB.prepare(sql)
      .bind(...finalBinds)
      .all<MapDbRecordWithRating>();

    if (!result || !result.success) {
      logWarn(requestId, "route.maps.search.db_error", { error: result.error });
      return bad("Database error", 500);
    }

    if (result.results.length > 0) {
      return json(result.results);
    }
  }

  // string query
  const likeQuery = `%${query}%`;

  const sql = userId
    ? `
      SELECT
        m.*,
        r.map_id AS rating_map_id, r.user_id AS rating_user_id,
        r.rated_at, r.visited_at
      FROM maps_latest m
      LEFT JOIN ratings r
        ON m.id = r.map_id AND r.user_id = ?
      ${whereBase ? whereBase + " AND" : "WHERE"}
        (m.title LIKE ? OR m.author LIKE ?)
      ORDER BY m.created_at DESC
      LIMIT 25
      `
    : `
      SELECT m.*
      FROM maps_latest m
      ${whereBase ? whereBase + " AND" : "WHERE"}
        (m.title LIKE ? OR m.author LIKE ?)
      ORDER BY m.created_at DESC
      LIMIT 25
      `;

  const finalBinds = userId
    ? [userId, ...binds, likeQuery, likeQuery]
    : [...binds, likeQuery, likeQuery];

  const result = await env.DB.prepare(sql)
    .bind(...finalBinds)
    .all<any>();

  if (!result || !result.success) {
    logWarn(requestId, "route.maps.search.db_error", { error: result.error });
    return bad("Database error", 500);
  }

  logInfo(requestId, "route.maps.search.ok", {
    query,
    count: result.results.length,
  });

  return json(result.results);
}
