import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import type { MapDbRecord, RouteContext } from "../../types";

export async function handleGetMapsQuery({
  request,
  env,
  requestId,
  bypass,
  ctx,
}: RouteContext): Promise<Response | null> {
  const url = new URL(request.url);

  const mapId = url.searchParams.get("mapId")?.trim() ?? "";
  const viewId = url.searchParams.get("viewId")?.trim() ?? "";

  logInfo(requestId, "route.maps.query.hit", { mapId, viewId });

  if (!mapId && !viewId) {
    logWarn(requestId, "route.maps.query.bad_request", {
      reason: "invalid map id",
    });
    return bad("Invalid map id");
  }

  const db = viewId ? "maps" : "maps_latest";
  const column = viewId ? "view_id" : "id";
  const id = viewId ?? mapId;

  const map = await env.DB.prepare(
    `
    SELECT file_key, id, author, title, language, category, created_at,
        version, tag, rating_count, visit_count, preview_key, file_size, view_id
    FROM ${db}
    WHERE ${column} = ?
    `,
  )
    .bind(id)
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

  return json(map);
}
