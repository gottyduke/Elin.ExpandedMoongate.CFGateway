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
    mapId: body?.map_id,
    score: body?.score,
  });

  if (!body?.map_id) {
    logWarn(requestId, "route.ratings.post.bad_request", {
      reason: "map id missing",
    });
    return bad("map id is required");
  }

  if (!Number.isInteger(body.score) || body.score < 1 || body.score > 5) {
    logWarn(requestId, "route.ratings.post.bad_request", {
      mapId: body.map_id,
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
    .bind(body.map_id)
    .first();
  if (!mapExists) {
    logWarn(requestId, "route.ratings.post.not_found", { mapId: body.map_id });
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
    .bind(
      requestId,
      body.map_id,
      body.author,
      body.score,
      body.comment ?? null,
      now,
    )
    .run();

  const agg = await env.DB.prepare(
    `
    SELECT COUNT(*) AS c, AVG(score) AS a
    FROM ratings
    WHERE map_id = ?
  `,
  )
    .bind(body.map_id)
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
    .bind(agg?.c ?? 0, agg?.a ?? 0, body.map_id)
    .run();

  logInfo(requestId, "route.ratings.post.ok", {
    mapId: body.map_id,
    count: agg?.c ?? 0,
    average: agg?.a ?? 0,
  });

  return json({ ok: true });
}
