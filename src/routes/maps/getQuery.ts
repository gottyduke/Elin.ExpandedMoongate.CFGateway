import { json } from "../../utils/response";
import { logInfo } from "../../utils/logger";

export async function handleGetMapsQuery(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const m = path.match(/^\/maps\/query\/([^\/]+)$/);
  if (!m || method !== "GET") return null;

  const mapId = decodeURIComponent(m[1]);
  logInfo(requestId, "route.maps.query.hit", { mapId });

  const map = await env.DB.prepare(
    `
    SELECT
      id AS Id, 
      author AS Author, 
      title AS Title, 
      lang AS Lang, 
      cat AS Cat, 
      created_at AS CreatedAt, 
      version AS Version, 
      tag AS Tag, 
      is_official AS IsOfficial,
      visit_count AS VisitCount, 
      rating_count AS RatingCount, 
      rating_average AS RatingAverage, 
      file_key AS FileKey, 
      file_size AS FileSize
    FROM maps
    WHERE id = ?
  `,
  )
    .bind(mapId)
    .first<{ [key: string]: any }>();

  if (!map) {
    logInfo(requestId, "route.maps.query.not_found", { mapId });
    return json({ found: false }, 404);
  }

  const obj = await env.R2.head(map.FileKey);
  if (!obj) {
    logInfo(requestId, "route.maps.query.not_found", {
      mapId,
      fileKey: map.FileKey,
      reason: "r2 object missing",
    });
    return json({ found: false }, 404);
  }

  logInfo(requestId, "route.maps.query.found", {
    mapId,
    fileKey: map.FileKey,
    version: map.Version,
  });

  return json(map, 200);
}
