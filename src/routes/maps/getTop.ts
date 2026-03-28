import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { MapDbRecordWithRating } from "../../types";

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
  const countParam = url.searchParams.get("count");
  const pageParam = url.searchParams.get("page");
  const langParam = url.searchParams.get("lang");
  const tagParam = url.searchParams.get("noTags");
  const versionParam = url.searchParams.get("version");
  const userId = url.searchParams.get("userId");

  const validSorts = new Set(["created", "rating", "visits"]);

  const sort = validSorts.has(sortParam ?? "")
    ? (sortParam as "created" | "rating" | "visits")
    : "created";

  const count = Math.min(Math.max(Number(countParam) || 30, 10), 300);
  const page = Math.max(Number(pageParam) || 0, 0);
  const offset = count * page;
  const version = Number(versionParam) || 1000000;

  logInfo(requestId, "route.maps.top.hit", {
    sort,
    count,
    page,
    offset,
    version,
    userId,
  });

  const filters: string[] = ["version <= ?"];
  const binds: any[] = [version];

  if (langParam?.trim() && langParam.trim() !== "All") {
    filters.push("language = ?");
    binds.push(langParam.trim());
  }

  if (tagParam?.trim()) {
    tagParam
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((tag) => {
        filters.push("(',' || tag || ',') NOT LIKE ?");
        binds.push(`%${tag}%`);
      });
  }

  const where = `WHERE ${filters.join(" AND ")}`;
  const sortMap: Record<string, string> = {
    rating: "rating_count",
    visits: "visit_count",
    created: "created_at",
  };
  const sortOrder = sortMap[sort] || "created_at";

  const sql = userId
    ? `
      SELECT 
        m.file_key, m.id, m.author, m.title, m.language, m.category, m.created_at,
        m.version, m.tag, m.rating_count, m.visit_count, m.preview_key, m.file_size,
        r.map_id as rating_map_id, r.user_id as rating_user_id, r.rated_at, r.visited_at
      FROM maps_latest m
      LEFT JOIN ratings r 
        ON m.id = r.map_id AND r.user_id = ?
      ${where}
      ORDER BY ${sortOrder} DESC
      LIMIT ? OFFSET ?
      `
    : `
      SELECT 
        m.file_key, m.id, m.author, m.title, m.language, m.category, m.created_at,
        m.version, m.tag, m.rating_count, m.visit_count, m.preview_key, m.file_size
      FROM maps_latest m
      ${where}
      ORDER BY ${sortOrder} DESC
      LIMIT ? OFFSET ?
      `;

  const finalBinds = userId
    ? [userId, ...binds, count, offset]
    : [...binds, count, offset];

  const result = await env.DB.prepare(sql)
    .bind(...finalBinds)
    .all<any>();

  if (!result || !result.success) {
    logWarn(requestId, "route.maps.top.db_error", { error: result.error });
    return bad("Database error", 500);
  }

  const maps: MapDbRecordWithRating[] = result.results.map((r: any) => {
    const map: MapDbRecordWithRating = {
      file_key: r.file_key,
      id: r.id,
      author: r.author,
      title: r.title,
      language: r.language,
      category: r.category,
      created_at: r.created_at,
      version: r.version,
      tag: r.tag,
      rating_count: r.rating_count,
      visit_count: r.visit_count,
      preview_key: r.preview_key,
      file_size: r.file_size,
    };
    if (userId && r.rating_map_id) {
      map.user_rating = {
        map_id: r.rating_map_id,
        user_id: r.rating_user_id,
        rated_at: r.rated_at,
        visited_at: r.visited_at,
      };
    }
    return map;
  });

  logInfo(requestId, "route.maps.top.ok", { fetched: maps });
  return json(maps);
}