import { json } from "../../utils/response";
import { logInfo } from "../../utils/logger";
import { MapDbRecord } from "../../types";

export async function handleGetMapsTop(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const m = path.match(
    /^\/maps\/top\/(created|rating|visits)\/(\d+)(?:\/(\d+))?$/,
  );
  if (!m || method !== "GET") return null;

  const sort = m[1] as "created" | "rating" | "visits";
  const limit = Math.min(parseInt(m[2], 10), 200);
  const page = m[3] ? parseInt(m[3], 10) : 0;
  const offset = limit * page;

  logInfo(requestId, "route.maps.top.hit", { sort, limit, page, offset });

  if (sort === "rating") {
    const minVotes = 20;
    const global = await env.DB.prepare(
      `SELECT AVG(score) as c FROM ratings`,
    ).first<{ c: number | null }>();
    const C = global?.c ?? 3.5;

    const { results } = await env.DB.prepare(
      `
      SELECT file_key, id, author, title, language, category, created_at, version, tag, 
        visit_count, rating_count, rating_average, file_size, preview_key,
        (((rating_count * rating_average) + (? * ?)) / (rating_count + ?)) AS weighted_rating
      FROM maps
      ORDER BY weighted_rating DESC, rating_count DESC, created_at DESC
      LIMIT ? OFFSET ?
    `,
    )
      .bind(minVotes, C, minVotes, limit, offset)
      .all<MapDbRecord>();
    logInfo(requestId, "route.maps.top.ok", {
      sort,
      limit,
      page,
      offset,
      count: results.length,
    });
    return json(results);
  }

  const orderBy = sort === "created" ? "created_at DESC" : "visit_count DESC";
  const { results } = await env.DB.prepare(
    `
    SELECT file_key, id, author, title, language, category, created_at, version, tag, 
        visit_count, rating_count, rating_average, file_size, preview_key
    FROM maps
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `,
  )
    .bind(limit, offset)
    .all<MapDbRecord>();

  logInfo(requestId, "route.maps.top.ok", {
    sort,
    limit,
    page,
    offset,
    count: results.length,
  });
  return json(results);
}
