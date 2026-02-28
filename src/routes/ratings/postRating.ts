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

  const m = path.match(/^\/ratings\/([^\/]+)/);
  if (!m || method !== "POST") return null;

  const mapId = decodeURIComponent(m[1] ?? "")?.trim();
  const body = (await request.json()) as RatingBody;

  if (body.map_id !== mapId) {
    logWarn(requestId, "route.ratings.post.bad_request", {
      reason: "map id in url and body do not match",
      urlMapId: mapId,
      bodyMapId: body.map_id,
    });
    return bad("map id in url and body must match");
  }

  logInfo(requestId, "route.ratings.post.hit", {
    mapId: mapId,
    score: body?.score,
    comment: body?.comment,
    author: body?.author,
  });

  if (!Number.isInteger(body.score) || body.score < 1 || body.score > 5) {
    logWarn(requestId, "route.ratings.post.bad_request", {
      mapId: mapId,
      reason: "invalid score",
      score: body.score,
    });
    return bad("score must be integer 1..5");
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
    logWarn(requestId, "route.ratings.post.not_found", { mapId: mapId });
    return bad("map not found", 404);
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  await env.DB.prepare(
    `
    INSERT INTO ratings (uuid, map_id, author, score, comment, rated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(map_id, author) DO UPDATE SET
      score = excluded.score,
      comment = excluded.comment,
      rated_at = excluded.rated_at
  `,
  )
    .bind(requestId, mapId, body.author, body.score, body.comment ?? null, now)
    .run();

  const agg = await env.DB.prepare(
    `
    SELECT COUNT(*) AS c, AVG(score) AS a
    FROM ratings
    WHERE map_id = ?
  `,
  )
    .bind(mapId)
    .first<{ c: number; a: number }>();

  await env.DB.prepare(
    `
    UPDATE maps
    SET rating_count = ?, rating_average = ?
    WHERE id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `,
  )
    .bind(agg?.c ?? 0, agg?.a ?? 0, mapId)
    .run();

  logInfo(requestId, "route.ratings.post.ok", {
    mapId: mapId,
    count: agg?.c ?? 0,
    average: agg?.a ?? 0,
  });

  return json({ ok: true });
}
