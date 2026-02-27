import { json } from "../utils/response";
import { logInfo } from "../utils/logger";

export async function handleMapsRatings(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const m = path.match(/^\/maps\/ratings\/([^\/]+)$/);
  if (!m || method !== "GET") return null;

  const id = decodeURIComponent(m[1]);
  logInfo(requestId, "route.maps.ratings.hit", { id });

  const { results } = await env.DB.prepare(`
    SELECT
      map_id AS MapId,
      user_id AS UserId,
      score AS Score,
      comment AS Comment,
      rated_at AS RatedAt
    FROM map_ratings
    WHERE map_id = ?
      AND comment IS NOT NULL
      AND TRIM(comment) <> ''
    ORDER BY rated_at DESC
    LIMIT 200
  `)
    .bind(id)
    .all();

  logInfo(requestId, "route.maps.ratings.ok", { id, resultCount: results.length });
  return json(results);
}