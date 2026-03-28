import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { MapDbRecord } from "../../types";

export async function handleGetMapsQuery(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path !== "/maps/query" || method !== "GET") return null;

  const mapId = url.searchParams.get("mapId")?.trim() ?? "";

  logInfo(requestId, "route.maps.query.hit", { mapId });

  if (!mapId) {
    logWarn(requestId, "route.maps.query.bad_request", {
      reason: "invalid map id",
    });
    return bad("invalid map id");
  }

  const map = await env.DB.prepare(
    `
    SELECT file_key, id, author, title, language, category, created_at, 
        version, tag, rating_count, visit_count, preview_key, file_size
    FROM maps_latest
    WHERE id = ?
    `,
  )
    .bind(mapId)
    .first<MapDbRecord>();

  if (!map) {
    logInfo(requestId, "route.maps.query.not_found", { mapId });
    return json({ found: false }, 404);
  }

  const obj = await env.R2.head(map.file_key);
  if (!obj) {
    logInfo(requestId, "route.maps.query.not_found", {
      mapId,
      fileKey: map.file_key,
      reason: "r2 object missing",
    });
    return json({ found: false }, 404);
  }

  logInfo(requestId, "route.maps.query.found", {
    mapId,
    fileKey: map.file_key,
    version: map.version,
  });

  return json(map, 200);
}
