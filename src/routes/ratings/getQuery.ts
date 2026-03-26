import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { RatingDbRecord } from "../../types";

export async function handleGetRatingsQuery(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const m = path.match(/^\/ratings\/query\/([^\/]+)\/([^\/]+)$/);
  if (!m || method !== "GET") return null;

  const userId = decodeURIComponent(m[1] ?? "")?.trim();
  const mapId = decodeURIComponent(m[2] ?? "")?.trim();

  logInfo(requestId, "route.ratings.query.hit", {
    mapId,
    userId,
  });

  if (!mapId || !userId) {
    logWarn(requestId, "route.ratings.query.bad_request", {
      reason: "map id or user id missing",
    });
    return bad("map id or user id missing");
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
    logWarn(requestId, "route.ratings.query.not_found", { mapId });
    return bad("map not found", 404);
  }

  const rating = await env.DB.prepare(
    `
      SELECT uuid, map_id, author, score, comment, rated_at
      FROM ratings
      WHERE map_id = ? AND author = ?
      LIMIT 1
    `,
  )
    .bind(mapId, userId)
    .first<RatingDbRecord>();

  logInfo(requestId, "route.ratings.query.ok", {
    mapId,
    userId,
    rating,
  });

  return json(rating);
}
