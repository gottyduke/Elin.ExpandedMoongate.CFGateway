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

  if (path !== "/maps/top" || method !== "GET") return null;

  const sortParam = url.searchParams.get("sort");
  const limitParam = url.searchParams.get("limit");
  const pageParam = url.searchParams.get("page");
  const versionParam = url.searchParams.get("version");

  const validSorts = new Set(["created", "rating", "visits"]);

  const sort = validSorts.has(sortParam ?? "")
    ? (sortParam as "created" | "rating" | "visits")
    : "created";

  const limit = Math.min(
    Math.max(parseInt(limitParam ?? "30", 10) || 30, 10),
    300,
  );
  const page = Math.max(parseInt(pageParam ?? "0", 10) || 0, 0);
  const offset = limit * page;

  const version = parseInt(versionParam ?? "1000000", 10) || 1000000;

  logInfo(requestId, "route.maps.top.hit", {
    sort,
    limit,
    page,
    offset,
    version,
  });

  if (sort === "rating") {
    const minVotes = 20;
    const global = await env.DB.prepare(
      `
      SELECT AVG(score) as c 
      FROM ratings
      `,
    ).first<{ c: number | null }>();
    const C = global?.c ?? 3.5;

    const { results } = await env.DB.prepare(
      `
      SELECT m.*,
      (((rating_count * rating_average) + (? * ?)) / (rating_count + ?)) AS weighted_rating
      FROM maps m
      INNER JOIN (
        SELECT id, MAX(created_at) AS max_created
        FROM maps
        GROUP BY id
      ) latest
      ON m.id = latest.id AND m.created_at = latest.max_created
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
    SELECT m.*
    FROM maps m
    INNER JOIN (
        SELECT id, MAX(created_at) AS max_created
        FROM maps
        GROUP BY id
    ) latest
    ON m.id = latest.id AND m.created_at = latest.max_created
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
