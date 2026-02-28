import type { RatingBody } from "../../types";
import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";

export async function handlePostMapsRating(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (!(path === "/ratings" && method === "POST")) return null;

  const body = (await request.json()) as RatingBody;
  logInfo(requestId, "route.ratings.post.hit", {
    mapId: body?.MapId,
    userIdLen: body?.UserId?.length ?? 0,
    score: body?.Score,
  });

  if (!body?.MapId || !body?.UserId) {
    logWarn(requestId, "route.ratings.post.bad_request", {
      reason: "mapId/userId missing",
    });
    return bad("mapId and userId are required");
  }

  if (!Number.isInteger(body.Score) || body.Score < 1 || body.Score > 5) {
    logWarn(requestId, "route.ratings.post.bad_request", {
      mapId: body.MapId,
      reason: "invalid score",
      score: body.Score,
    });
    return bad("score must be integer 1..5");
  }

  const mapExists = await env.DB.prepare(`SELECT 1 FROM maps WHERE id = ?`)
    .bind(body.MapId)
    .first();
  if (!mapExists) {
    logWarn(requestId, "route.ratings.post.not_found", { mapId: body.MapId });
    return bad("map not found", 404);
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  await env.DB.prepare(
    `
    INSERT INTO map_ratings (map_id, user_id, score, comment, rated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(map_id, user_id) DO UPDATE SET
      score = excluded.score,
      comment = excluded.comment,
      rated_at = excluded.rated_at
  `,
  )
    .bind(body.MapId, body.UserId, body.Score, body.Comment ?? null, now)
    .run();

  const agg = await env.DB.prepare(
    `
    SELECT COUNT(*) AS c, AVG(score) AS a
    FROM map_ratings
    WHERE map_id = ?
  `,
  )
    .bind(body.MapId)
    .first<{ c: number; a: number }>();

  await env.DB.prepare(
    `
    UPDATE maps
    SET rating_count = ?, rating_average = ?
    WHERE id = ?
  `,
  )
    .bind(agg?.c ?? 0, agg?.a ?? 0, body.MapId)
    .run();

  logInfo(requestId, "route.ratings.post.ok", {
    mapId: body.MapId,
    ratingCount: agg?.c ?? 0,
    ratingAverage: agg?.a ?? 0,
  });

  return json({ ok: true });
}
