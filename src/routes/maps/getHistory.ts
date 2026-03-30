import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import type { MapDbRecordWithRating, RouteContext } from "../../types";

export async function handleGetMapsHistory({
  request,
  env,
  requestId,
  bypass,
  ctx,
}: RouteContext): Promise<Response | null> {
  const url = new URL(request.url);

  const userId = url.searchParams.get("userId");

  logInfo(requestId, "route.maps.history.hit", {
    userId,
  });

  const result = await env.DB.prepare(
    `
    SELECT
        m.file_key, m.id, m.author, m.title, m.language, m.category, m.created_at,
        m.version, m.tag, m.rating_count, m.visit_count, m.preview_key, m.file_size, m.view_id,
        r.map_id AS rating_map_id, r.user_id AS rating_user_id, r.rated_at, r.visited_at
    FROM maps_latest m
    INNER JOIN ratings r
        ON m.id = r.map_id
    WHERE r.user_id = ?
        AND r.visited_at IS NOT NULL
    ORDER BY r.visited_at DESC
    LIMIT 100
    `,
  )
    .bind(userId)
    .all<any>();

  if (!result || !result.success) {
    logWarn(requestId, "route.maps.history.db_error", { error: result.error });
    return bad("Database error", 500);
  }

  const maps: MapDbRecordWithRating[] = result.results.map((r: any) => {
    const map: MapDbRecordWithRating = {
      file_key: r.file_key,
      id: r.id,
      author: r.author,
      title: r.title,
      language: r.language,
      category: r.category,
      created_at: r.created_at,
      version: r.version,
      tag: r.tag,
      rating_count: r.rating_count,
      visit_count: r.visit_count,
      preview_key: r.preview_key,
      file_size: r.file_size,
      view_id: r.view_id,
    };
    if (userId && r.rating_map_id) {
      map.user_rating = {
        map_id: r.rating_map_id,
        user_id: r.rating_user_id,
        rated_at: r.rated_at,
        visited_at: r.visited_at,
      };
    }
    return map;
  });

  logInfo(requestId, "route.maps.history.ok", { fetched: maps });
  return json(maps);
}
