import type { RatingBody, RouteContext } from "../../types";
import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";

export async function handlePostMapsRating({
  request,
  env,
  requestId,
  bypass,
  ctx,
}: RouteContext): Promise<Response | null> {
  const url = new URL(request.url);

  const mapId = url.searchParams.get("mapId")?.trim() ?? "";
  const body = (await request.json()) as RatingBody;

  if (body.map_id !== mapId) {
    logWarn(requestId, "route.ratings.post.bad_request", {
      reason: "map id in url and body do not match",
      urlMapId: mapId,
      bodyMapId: body.map_id,
    });
    return bad("Map id in url and body must match");
  }

  const liked = body.rated_at !== null;

  logInfo(requestId, "route.ratings.post.hit", {
    mapId,
    userId: body.user_id,
    liked,
  });

  const mapExists = await env.DB.prepare(
    `
    SELECT 1
    FROM maps_latest
    WHERE id = ?
    LIMIT 1
    `,
  )
    .bind(mapId)
    .first();
  if (!mapExists) {
    logWarn(requestId, "route.ratings.post.not_found", { mapId });
    return bad("Map not found", 404);
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const ratedAt = liked ? now : null;

  await env.DB.prepare(
    `
    INSERT INTO ratings (map_id, user_id, rated_at, visited_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(map_id, user_id)
    DO UPDATE SET
        rated_at = excluded.rated_at,
        visited_at = excluded.visited_at
    `,
  )
    .bind(mapId, body.user_id, ratedAt, now)
    .run();

  logInfo(requestId, "route.ratings.post.ok", {
    mapId: mapId,
    userId: body.user_id,
    liked,
  });

  return json({ ok: true });
}
