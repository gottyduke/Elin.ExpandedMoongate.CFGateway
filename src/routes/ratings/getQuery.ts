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

  if (path !== "/ratings" || method !== "GET") return null;

  const userId = url.searchParams.get("userId")?.trim() ?? "";
  const mapId = url.searchParams.get("mapId")?.trim() ?? "";

  logInfo(requestId, "route.ratings.get.hit", {
    mapId,
    userId,
  });

  if (!mapId || !userId) {
    logWarn(requestId, "route.ratings.get.bad_request", {
      reason: "map id or user id missing",
    });
    return bad("map id or user id missing");
  }

  const mapExists = await env.DB.prepare(
    `
    SELECT 1
    FROM maps_latest
    WHERE id = ?
    `,
  )
    .bind(mapId)
    .first();

  if (!mapExists) {
    logWarn(requestId, "route.ratings.get.not_found", { mapId });
    return bad("map not found", 404);
  }

  const rating = await env.DB.prepare(
    `
    SELECT map_id, user_id, rated_at, visited_at
    FROM ratings
    WHERE map_id = ? AND user_id = ?
    `,
  )
    .bind(mapId, userId)
    .first<RatingDbRecord>();

  logInfo(requestId, "route.ratings.get.ok", {
    mapId,
    userId,
    rating,
  });

  return json(rating);
}
