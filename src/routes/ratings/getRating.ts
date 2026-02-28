import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";

export async function handleGetMapsRating(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const m = path.match(/^\/ratings\/([^/]+)(?:\/([^/]+))?$/);
  if (!(method === "GET" && m)) return null;

  const mapId = decodeURIComponent(m[1] ?? "").trim();
  const userId = decodeURIComponent(m[2] ?? "").trim(); // optional

  logInfo(requestId, "route.ratings.get.hit", {
    mapId: mapId,
    userId: userId || null,
  });

  if (!mapId) {
    logWarn(requestId, "route.ratings.get.bad_request", {
      reason: "mapId missing",
    });
    return bad("mapId is required");
  }

  const mapExists = await env.DB.prepare(`SELECT 1 FROM maps WHERE id = ?`)
    .bind(mapId)
    .first();

  if (!mapExists) {
    logWarn(requestId, "route.ratings.get.not_found", { mapId });
    return bad("map not found", 404);
  }

  if (userId) {
    const rating = await env.DB.prepare(
      `
      SELECT 
        score AS Score,
        comment AS Comment,
        rated_at AS RatedAt
      FROM map_ratings
      WHERE map_id = ? AND user_id = ?
      LIMIT 1
    `,
    )
      .bind(mapId, userId)
      .first<{
        Score: number | null;
        Comment: string | null;
        RatedAt: string | null;
      }>();

    logInfo(requestId, "route.ratings.map.get.user.ok", {
      mapId,
      userId,
      rating,
    });

    return json(rating);
  }

  const rating = await env.DB.prepare(
    `
    SELECT 
        rating_count AS RatingCount, 
        rating_average AS RatingAverage
    FROM maps
    WHERE id = ?
  `,
  )
    .bind(mapId)
    .first<{ RatingCount: number | null; RatingAverage: number | null }>();

  logInfo(requestId, "route.ratings.get.ok", { mapId, rating });

  return json(rating);
}
