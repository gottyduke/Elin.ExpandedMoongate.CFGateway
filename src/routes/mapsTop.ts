import { json } from "../utils/response";
import { logInfo } from "../utils/logger";

export async function handleMapsTop(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const m = path.match(/^\/maps\/top\/(created|rating|visits)\/(\d+)$/);
  if (!m || method !== "GET") return null;

  const sort = m[1] as "created" | "rating" | "visits";
  const limit = Math.min(parseInt(m[2], 10), 200);

  logInfo(requestId, "route.maps.top.hit", { sort, limit });

  if (sort === "rating") {
    const minVotes = 20;
    const global = await env.DB.prepare(
      `SELECT AVG(score) as c FROM map_ratings`,
    ).first<{ c: number | null }>();
    const C = global?.c ?? 3.5;

    const stmt = env.DB.prepare(
      `
      SELECT
        id AS Id, 
        author AS Author, 
        title AS Title, 
        lang AS Lang, 
        cat AS Cat,
        created_at AS Date, 
        version AS Version, 
        tag AS Tag, 
        is_official AS IsOfficial,
        visit_count AS VisitCount, 
        rating_count AS RatingCount, 
        rating_average AS RatingAverage,
        file_size AS FileSize,
        (((rating_count * rating_average) + (? * ?)) / (rating_count + ?)) AS weighted_rating
      FROM maps
      ORDER BY weighted_rating DESC, rating_count DESC, created_at DESC
      LIMIT ?
    `,
    ).bind(minVotes, C, minVotes, limit);

    const { results } = await stmt.all();
    logInfo(requestId, "route.maps.top.ok", {
      sort,
      limit,
      resultCount: results.length,
    });
    return json(results);
  }

  const orderBy = sort === "created" ? "created_at DESC" : "total_visits DESC";
  const stmt = env.DB.prepare(
    `
    SELECT
      id AS Id, 
      author AS Author, 
      title AS Title, 
      lang AS Lang, 
      cat AS Cat,
      created_at AS Date, 
      version AS Version, 
      tag AS Tag, 
      is_official AS IsOfficial,
      visit_count AS VisitCount, 
      rating_count AS RatingCount, 
      rating_average AS RatingAverage,
      file_size AS FileSize
    FROM maps
    ORDER BY ${orderBy}
    LIMIT ?
  `,
  ).bind(limit);

  const { results } = await stmt.all();
  logInfo(requestId, "route.maps.top.ok", { sort, limit, resultCount: results.length });
  return json(results);
}