import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { RatingDbRecord } from "../../types";

export async function handleGetMapsRating(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const m = path.match(/^\/ratings\/([^\/]+)\/(\d+)$/);
  if (!m || method !== "GET") return null;

  const mapId = decodeURIComponent(m[1] ?? "");
  const limit = Math.min(parseInt(m[2], 10), 100);

  logInfo(requestId, "route.ratings.get.hit", {
    mapId: mapId,
    limit: limit,
  });

  if (!mapId) {
    logWarn(requestId, "route.ratings.get.bad_request", {
      reason: "map id missing",
    });
    return bad("map id is required");
  }

  const mapExists = await env.DB.prepare(
    `
    SELECT 1 
    FROM maps 
    WHERE id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
    `,
  )
    .bind(mapId)
    .first();

  if (!mapExists) {
    logWarn(requestId, "route.ratings.get.not_found", { mapId });
    return bad("map not found", 404);
  }

  const { results } = await env.DB.prepare(
    `
      SELECT uuid, map_id, author, score, comment, rated_at
      FROM ratings
      WHERE map_id = ?
      ORDER BY rated_at DESC
      LIMIT ?
    `,
  )
    .bind(mapId, limit)
    .all<RatingDbRecord>();

  logInfo(requestId, "route.ratings.get.ok", {
    mapId,
    limit,
    count: results.length,
  });

  return json(results);
}
