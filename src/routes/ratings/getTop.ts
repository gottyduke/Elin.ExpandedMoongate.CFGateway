import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { RatingDbRecord } from "../../types";

export async function handleGetRatingsTop(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const m = path.match(/^\/ratings\/top\/([^\/]+)$/);
  if (!m || method !== "GET") return null;

  const mapId = decodeURIComponent(m[1])?.trim();
  const limitParam = url.searchParams.get("limit");
  const pageParam = url.searchParams.get("page");

  const limit = Math.min(
    Math.max(parseInt(limitParam ?? "30", 10) || 30, 30),
    100,
  );
  const page = Math.max(parseInt(pageParam ?? "0", 10) || 0, 0);
  const offset = limit * page;

  logInfo(requestId, "route.ratings.top.hit", {
    mapId,
    limit,
    page,
    offset,
  });

  if (!mapId) {
    logWarn(requestId, "route.ratings.top.bad_request", {
      reason: "map id missing",
    });
    return bad("map id missing");
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
    logWarn(requestId, "route.ratings.top.not_found", { mapId });
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

  logInfo(requestId, "route.ratings.top.ok", {
    mapId,
    limit,
    page,
    offset,
    count: results.length,
  });

  return json(results);
}
